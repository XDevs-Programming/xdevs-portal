(function () {
  "use strict";

  const message = document.getElementById("login-message");
  const params = new URLSearchParams(window.location.search);

  if (params.get("error")) {
    message.textContent = params.get("error");
    message.hidden = false;
    history.replaceState({}, "", window.location.pathname);
  }

  async function beginLogin(provider, button) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Preparing secure sign-in…";

    try {
      const started = await XDevsAuth.loginWith(provider);

      // loginWith() normally navigates away when successful.
      // If it returns false, keep the button usable.
      if (started === false && document.visibilityState === "visible") {
        button.disabled = false;
        button.textContent = original;
      }
    } catch (error) {
      message.textContent =
        error?.message || "Secure sign-in could not be started. Please try again.";
      message.hidden = false;
      button.disabled = false;
      button.textContent = original;
    }
  }

  const discordButton = document.getElementById("discord-login");
  const googleButton = document.getElementById("google-login");

  discordButton?.addEventListener("click", (event) => {
    beginLogin("discord", event.currentTarget);
  });

  googleButton?.addEventListener("click", (event) => {
    beginLogin("google", event.currentTarget);
  });

  window.setTimeout(() => {
    window.XDevsWake?.prewarm();
  }, 300);

  (async () => {
    if (!XDevsAuth.getToken()) return;

    try {
      const user = await XDevsAuth.currentUser();
      window.location.replace(XDevsAuth.dashboardFor(user));
    } catch {
      XDevsAuth.clearAuth();
    }
  })();
})();
