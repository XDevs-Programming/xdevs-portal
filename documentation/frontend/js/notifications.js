(function () {
  "use strict";

  let timer = null;
  let seen = new Set();
  let onUpdate = null;

  async function requestPermission() {
    if (!("Notification" in window)) {
      throw new Error("This browser does not support desktop notifications.");
    }
    const permission = await Notification.requestPermission();
    localStorage.setItem("xdevs_notification_permission", permission);
    return permission;
  }

  function showDesktop(item) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    if (document.visibilityState === "visible") return;

    const notification = new Notification(item.title, {
      body: item.message,
      icon: "/assets/favicon.svg",
      tag: item._id
    });

    notification.onclick = () => {
      window.focus();
      if (item.link) window.location.assign(item.link);
      notification.close();
    };
  }

  async function poll() {
    try {
      const result = await XDevsAuth.apiFetch("/api/notifications/mine?limit=50");
      const fresh = result.notifications.filter((item) => !seen.has(item._id));
      fresh.reverse().forEach(showDesktop);
      result.notifications.forEach((item) => seen.add(item._id));
      onUpdate?.(result);
    } catch (error) {
      console.warn("Notification polling failed:", error.message);
    }
  }

  async function markRead(id) {
    await XDevsAuth.apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    await poll();
  }

  async function markAllRead() {
    await XDevsAuth.apiFetch("/api/notifications/read-all", { method: "PATCH" });
    await poll();
  }

  async function start(callback) {
    onUpdate = callback;
    const first = await XDevsAuth.apiFetch("/api/notifications/mine?limit=50");
    first.notifications.forEach((item) => seen.add(item._id));
    onUpdate?.(first);
    timer = window.setInterval(poll, 15000);
  }

  function stop() {
    if (timer) clearInterval(timer);
  }

  window.XDevsNotifications = Object.freeze({
    requestPermission,
    start,
    stop,
    markRead,
    markAllRead
  });
})();
