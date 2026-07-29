const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const STATE_TTL = 10 * 60 * 1000;

function production() {
  return process.env.NODE_ENV === "production";
}

function cookieName(provider) {
  return `xdevs_oauth_${provider}`;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: production(),
    sameSite: "lax",
    signed: true,
    maxAge: STATE_TTL,
    path: "/api/auth"
  };
}

function createState(res, provider) {
  const state = crypto.randomBytes(32).toString("hex");
  res.cookie(cookieName(provider), state, cookieOptions());
  return state;
}

function verifyState(req, res, provider, returnedState) {
  const expected = req.signedCookies[cookieName(provider)];

  res.clearCookie(cookieName(provider), {
    httpOnly: true,
    secure: production(),
    sameSite: "lax",
    signed: true,
    path: "/api/auth"
  });

  if (!expected || !returnedState) return false;

  const a = Buffer.from(expected);
  const b = Buffer.from(returnedState);

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
      issuer: "xdevs-portal-api",
      audience: "xdevs-portal"
    }
  );
}

async function uniqueUsername(preferred) {
  const base =
    String(preferred || "XDevs User")
      .replace(/[^\p{L}\p{N} _.-]/gu, "")
      .trim()
      .slice(0, 30) || "XDevs User";

  if (!(await User.exists({ username: base }))) return base;

  for (let i = 0; i < 25; i += 1) {
    const candidate = `${base.slice(0, 25)}-${crypto.randomInt(1000, 9999)}`;
    if (!(await User.exists({ username: candidate }))) return candidate;
  }

  return `XDevs-${crypto.randomUUID().slice(0, 8)}`;
}

async function findOrCreateOAuthUser(profile) {
  const providerField =
    profile.provider === "discord" ? "discordId" : "googleId";

  let user = await User.findOne({
    [providerField]: profile.providerId
  });

  if (!user && profile.email && profile.emailVerified) {
    user = await User.findOne({
      email: profile.email.toLowerCase()
    });
  }

  if (!user) {
    user = new User({
      username: await uniqueUsername(profile.username),
      email:
        profile.email && profile.emailVerified
          ? profile.email.toLowerCase()
          : undefined,
      avatar: profile.avatar || null,
      [providerField]: profile.providerId,
      lastLogin: new Date()
    });
  } else {
    user[providerField] = profile.providerId;
    user.lastLogin = new Date();

    if (!user.email && profile.email && profile.emailVerified) {
      user.email = profile.email.toLowerCase();
    }

    if (profile.avatar) user.avatar = profile.avatar;
  }

  await user.save();
  return user;
}

function callbackUrl(params) {
  const frontend = process.env.FRONTEND_URL.replace(/\/+$/, "");
  return `${frontend}/pages/auth/callback.html#${new URLSearchParams(params)}`;
}

function completeLogin(res, user, provider) {
  res.redirect(
    302,
    callbackUrl({
      token: createAccessToken(user),
      provider
    })
  );
}

function failLogin(res, message) {
  res.redirect(302, callbackUrl({ error: message }));
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      body.error_description ||
        body.message ||
        body.error ||
        `OAuth request failed with status ${response.status}.`
    );
  }

  return body;
}

module.exports = {
  createState,
  verifyState,
  findOrCreateOAuthUser,
  completeLogin,
  failLogin,
  fetchJson
};
