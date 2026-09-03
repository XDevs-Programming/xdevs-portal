(async () => {
  "use strict";

  const title = document.getElementById("status-title");
  const message = document.getElementById("status-message");
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get("token");
  const error = params.get("error");

  // Remove the token-bearing fragment from browser history immediately.
  history.replaceState({}, "", window.location.pathname);

  if (error || !token) {
    title.textContent = "Sign in failed";
    message.textContent = error || "No valid token was received.";

    setTimeout(() => {
      window.location.replace(
        `${APP_CONFIG.LOGIN_PAGE}?error=${encodeURIComponent(message.textContent)}`
      );
    }, 1200);
    return;
  }

  try {
    XDevsAuth.setToken(token);
    const user = await XDevsAuth.currentUser();
    window.location.replace(XDevsAuth.dashboardFor(user));
  } catch {
    XDevsAuth.clearAuth();
    title.textContent = "Sign in failed";
    message.textContent = "Your account could not be loaded.";

    setTimeout(() => {
      window.location.replace(APP_CONFIG.LOGIN_PAGE);
    }, 1200);
  }
})();
