const {
  createState,
  verifyState,
  findOrCreateOAuthUser,
  completeLogin,
  failLogin,
  fetchJson
} = require("../utils/oauth");

function startDiscord(req, res) {
  const state = createState(res, "discord");

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    response_type: "code",
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    scope: "identify email",
    state,
    prompt: "consent"
  });

  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
}

async function finishDiscord(req, res) {
  try {
    const { code, state, error } = req.query;

    if (error) return failLogin(res, "Discord sign-in was cancelled.");

    if (!code || !verifyState(req, res, "discord", state)) {
      return failLogin(res, "Discord sign-in could not be verified.");
    }

    const tokenData = await fetchJson(
      "https://discord.com/api/v10/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: process.env.DISCORD_REDIRECT_URI
        })
      }
    );

    const profile = await fetchJson(
      "https://discord.com/api/v10/users/@me",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`
        }
      }
    );

    const avatar = profile.avatar
      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=256`
      : null;

    const user = await findOrCreateOAuthUser({
      provider: "discord",
      providerId: profile.id,
      username: profile.global_name || profile.username,
      email: profile.email || null,
      emailVerified: profile.verified === true,
      avatar
    });

    return completeLogin(res, user, "discord");
  } catch (error) {
    console.error("Discord OAuth error:", error);
    return failLogin(res, "Discord sign-in failed.");
  }
}

function startGoogle(req, res) {
  const state = createState(res, "google");

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    access_type: "online"
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

async function finishGoogle(req, res) {
  try {
    const { code, state, error } = req.query;

    if (error) return failLogin(res, "Google sign-in was cancelled.");

    if (!code || !verifyState(req, res, "google", state)) {
      return failLogin(res, "Google sign-in could not be verified.");
    }

    const tokenData = await fetchJson(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI
        })
      }
    );

    const profile = await fetchJson(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`
        }
      }
    );

    const user = await findOrCreateOAuthUser({
      provider: "google",
      providerId: profile.sub,
      username: profile.name || profile.email?.split("@")[0],
      email: profile.email || null,
      emailVerified: profile.email_verified === true,
      avatar: profile.picture || null
    });

    return completeLogin(res, user, "google");
  } catch (error) {
    console.error("Google OAuth error:", error);
    return failLogin(res, "Google sign-in failed.");
  }
}

function currentUser(req, res) {
  res.json({
    success: true,
    user: req.user.toSafeObject()
  });
}

function logout(req, res) {
  res.json({
    success: true,
    message: "Signed out."
  });
}

module.exports = {
  startDiscord,
  finishDiscord,
  startGoogle,
  finishGoogle,
  currentUser,
  logout
};
