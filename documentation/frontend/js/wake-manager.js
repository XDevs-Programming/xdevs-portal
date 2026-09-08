(function () {
  "use strict";

  const config = window.APP_CONFIG || {};
  const healthPath = config.WAKE_HEALTH_PATH || "/api/health";
  const totalTimeout = Number(config.WAKE_TIMEOUT_MS) || 90000;
  const requestTimeout = Number(config.WAKE_REQUEST_TIMEOUT_MS) || 12000;
  const retryDelay = Number(config.WAKE_RETRY_DELAY_MS) || 2500;

  let ready = false;
  let activeWake = null;
  let socketClientPromise = null;
  let overlay = null;
  let statusText = null;
  let progressText = null;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function ensureOverlay() {
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.className = "wake-screen";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="wake-card" role="status" aria-live="polite">
        <div class="wake-brand"><span class="wake-mark">X</span><span>XDevs Programming</span></div>
        <div class="wake-orbit" aria-hidden="true"><span></span></div>
        <p class="wake-eyebrow">SECURE PORTAL STARTUP</p>
        <h1>Preparing your workspace…</h1>
        <p class="wake-copy">Our secure backend is waking from standby. This normally takes less than a minute.</p>
        <div class="wake-progress" aria-hidden="true"><span></span></div>
        <div class="wake-status-row"><span class="wake-status-dot"></span><span data-wake-status>Connecting to XDevs services</span></div>
        <small data-wake-progress>Starting secure services…</small>
      </div>`;
    document.body.appendChild(overlay);
    statusText = overlay.querySelector("[data-wake-status]");
    progressText = overlay.querySelector("[data-wake-progress]");
    return overlay;
  }

  function showOverlay(message) {
    ensureOverlay();
    if (message && statusText) statusText.textContent = message;
    overlay.hidden = false;
    document.body.classList.add("wake-active");
  }

  function hideOverlay() {
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove("wake-active");
  }

  function updateAttempt(attempt, elapsed) {
    if (!progressText) return;
    if (elapsed < 10000) progressText.textContent = "Starting secure services…";
    else if (elapsed < 30000) progressText.textContent = "Render is waking the API — almost there…";
    else progressText.textContent = `Still starting safely… check ${attempt}`;
  }

  async function healthCheck() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeout);
    try {
      const response = await fetch(`${config.API_BASE_URL}${healthPath}`, {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      if (!response.ok) return false;
      const payload = await response.json().catch(() => ({}));
      return payload.success !== false;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  async function runWake({ visible = false, message = "Connecting to XDevs services" } = {}) {
    if (ready) return true;
    if (visible) showOverlay(message);

    const started = Date.now();
    let attempt = 0;

    while (Date.now() - started < totalTimeout) {
      attempt += 1;
      const ok = await healthCheck();
      if (ok) {
        ready = true;
        if (statusText) statusText.textContent = "XDevs services are ready";
        if (progressText) progressText.textContent = "Connected securely ✓";
        if (visible) {
          await sleep(350);
          hideOverlay();
        }
        window.dispatchEvent(new CustomEvent("xdevs:backend-ready"));
        return true;
      }

      if (visible) {
        showOverlay(message);
        updateAttempt(attempt, Date.now() - started);
      }
      await sleep(retryDelay);
    }

    if (visible) {
      showOverlay("We couldn't start the portal yet");
      if (progressText) progressText.textContent = "Please wait a moment and try again.";
    }
    return false;
  }

  function ensureReady(options = {}) {
    if (ready) return Promise.resolve(true);
    if (!activeWake) {
      activeWake = runWake(options).finally(() => {
        if (!ready) activeWake = null;
      });
    } else if (options.visible) {
      showOverlay(options.message || "Connecting to XDevs services");
    }
    return activeWake;
  }

  function prewarm() {
    return ensureReady({ visible: false });
  }

  async function loginWith(provider) {
    showOverlay("Preparing secure sign-in");
    const ok = await ensureReady({ visible: true, message: "Preparing secure sign-in" });
    if (!ok) return false;
    window.location.assign(`${config.API_BASE_URL}/api/auth/${provider}`);
    return true;
  }

  async function loadSocketClient() {
    if (typeof window.io === "function") return true;
    if (socketClientPromise) return socketClientPromise;

    socketClientPromise = (async () => {
      const ok = await ensureReady({ visible: false });
      if (!ok) return false;

      await new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-xdevs-socket-client]');
        if (existing) {
          existing.addEventListener("load", resolve, { once: true });
          existing.addEventListener("error", reject, { once: true });
          if (typeof window.io === "function") resolve();
          return;
        }
        const script = document.createElement("script");
        script.src = `${config.API_BASE_URL}/socket.io/socket.io.js`;
        script.async = true;
        script.dataset.xdevsSocketClient = "true";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });

      return typeof window.io === "function";
    })().catch(() => false);

    return socketClientPromise;
  }

  window.XDevsWake = Object.freeze({
    ensureReady,
    prewarm,
    loginWith,
    loadSocketClient,
    isReady: () => ready,
    showOverlay,
    hideOverlay
  });
})();
