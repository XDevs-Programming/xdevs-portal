(function () {
  "use strict";

  const config = window.APP_CONFIG;
  const TOKEN_KEY = "xdevs_access_token";
  const USER_KEY = "xdevs_user";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function loginWith(provider) {
    window.location.assign(
      `${config.API_BASE_URL}/api/auth/${provider}`
    );
  }

  async function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = getToken();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    if (
      options.body &&
      !(options.body instanceof FormData) &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${config.API_BASE_URL}${path}`, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      clearAuth();
    }

    if (!response.ok) {
      throw new Error(data.message || `Request failed: ${response.status}`);
    }

    return data;
  }

  async function currentUser() {
    const result = await apiFetch("/api/auth/me");
    setUser(result.user);
    return result.user;
  }

  function dashboardFor(user) {
    return user.role === "admin"
      ? config.ADMIN_DASHBOARD
      : config.CLIENT_DASHBOARD;
  }

  async function requireAuth(roles = []) {
    if (!getToken()) {
      window.location.replace(config.LOGIN_PAGE);
      return null;
    }

    try {
      const user = await currentUser();

      if (roles.length && !roles.includes(user.role)) {
        window.location.replace(dashboardFor(user));
        return null;
      }

      return user;
    } catch {
      clearAuth();
      window.location.replace(config.LOGIN_PAGE);
      return null;
    }
  }

  async function logout() {
    try {
      await fetch(`${config.API_BASE_URL}/api/auth/logout`, {
        method: "POST"
      });
    } finally {
      clearAuth();
      window.location.replace(config.LOGIN_PAGE);
    }
  }

  window.XDevsAuth = Object.freeze({
    getToken,
    setToken,
    clearAuth,
    loginWith,
    apiFetch,
    currentUser,
    dashboardFor,
    requireAuth,
    logout
  });
})();
