(function () {
  "use strict";

  let socket = null;
  let role = null;
  let conversations = [];
  let activeCommissionId = null;
  let activeMessages = [];
  let typingTimer = null;
  let typingSent = false;

  const els = {};

  function cacheElements() {
    els.layout = document.querySelector("[data-chat-layout]");
    els.list = document.querySelector("[data-chat-conversations]");
    els.window = document.querySelector("[data-chat-window]");
    els.empty = document.querySelector("[data-chat-empty]");
    els.active = document.querySelector("[data-chat-active]");
    els.title = document.querySelector("[data-chat-title]");
    els.meta = document.querySelector("[data-chat-meta]");
    els.messages = document.querySelector("[data-chat-messages]");
    els.typing = document.querySelector("[data-chat-typing]");
    els.form = document.querySelector("[data-chat-form]");
    els.input = document.querySelector("[data-chat-input]");
    els.status = document.querySelector("[data-chat-status]");
    els.unread = document.querySelector("[data-chat-unread]");
  }

  async function init(userRole) {
    role = userRole;
    cacheElements();

    if (!els.layout) return;

    els.form?.addEventListener("submit", sendMessage);
    els.input?.addEventListener("input", handleTyping);
    els.input?.addEventListener("keydown", handleKeydown);
    document.querySelector("[data-chat-refresh]")?.addEventListener("click", loadConversations);
    document.querySelector("[data-chat-back]")?.addEventListener("click", showConversationList);

    await loadConversations();
    await connectSocket();

    const hash = window.location.hash.replace("#", "");
    if (hash === "chat" && conversations.length) {
      await selectConversation(conversations[0].commission._id);
    }
  }

  async function loadConversations() {
    try {
      const result = await XDevsAuth.apiFetch("/api/chat/conversations");
      conversations = result.conversations || [];
      renderConversationList();
      updateUnreadBadge();

      if (activeCommissionId) {
        const stillExists = conversations.some((item) => item.commission._id === activeCommissionId);
        if (!stillExists) showConversationList();
      }
    } catch (error) {
      if (els.list) {
        els.list.innerHTML = `<p class="notice">${escapeHtml(error.message)}</p>`;
      }
    }
  }

  function renderConversationList() {
    if (!els.list) return;

    if (!conversations.length) {
      els.list.innerHTML = '<p class="notice">No commission conversations yet. A chat will appear when you submit a commission.</p>';
      return;
    }

    els.list.innerHTML = conversations.map((item) => {
      const commission = item.commission || {};
      const other = role === "admin"
        ? (item.client?.username || "Client")
        : "XDevs Programming";
      const preview = item.lastMessage?.body || "No messages yet — start the conversation.";
      const active = commission._id === activeCommissionId ? "active" : "";
      const unread = Number(item.unreadCount) || 0;

      return `
        <button class="chat-conversation ${active}" type="button" data-chat-commission="${commission._id}">
          <span class="chat-conversation-avatar">${escapeHtml((other || "?").slice(0, 1).toUpperCase())}</span>
          <span class="chat-conversation-copy">
            <strong>${escapeHtml(commission.title || "Commission")}</strong>
            <span>${escapeHtml(other)}</span>
            <small>${escapeHtml(preview)}</small>
          </span>
          ${unread ? `<span class="chat-unread-count">${unread > 99 ? "99+" : unread}</span>` : ""}
        </button>`;
    }).join("");

    els.list.querySelectorAll("[data-chat-commission]").forEach((button) => {
      button.addEventListener("click", () => selectConversation(button.dataset.chatCommission));
    });
  }

  async function selectConversation(commissionId) {
    const item = conversations.find((entry) => entry.commission._id === commissionId);
    if (!item) return;

    if (socket && activeCommissionId && socket.connected) {
      socket.emit("leave_commission", activeCommissionId);
    }

    activeCommissionId = commissionId;
    activeMessages = [];
    renderConversationList();

    els.empty.hidden = true;
    els.active.hidden = false;
    els.layout.classList.add("chat-mobile-active");

    els.title.textContent = item.commission.title || "Commission chat";
    els.meta.textContent = role === "admin"
      ? `${item.client?.username || "Client"} · ${item.commission.category || "Commission"}`
      : `${item.commission.category || "Commission"} · Private with XDevs`;

    els.messages.innerHTML = '<div class="chat-loading">Loading messages…</div>';

    try {
      const result = await XDevsAuth.apiFetch(`/api/chat/${commissionId}/messages?limit=200`);
      activeMessages = result.messages || [];
      renderMessages();
      markRead();

      if (socket?.connected) {
        joinActiveRoom();
      }
    } catch (error) {
      els.messages.innerHTML = `<div class="chat-error">${escapeHtml(error.message)}</div>`;
    }
  }

  async function connectSocket() {
    if (typeof window.io !== "function" && window.XDevsWake) {
      await window.XDevsWake.loadSocketClient();
    }

    if (typeof window.io !== "function") {
      setStatus("Chat unavailable");
      els.messages && (els.messages.innerHTML = '<div class="chat-error">Live chat could not load. Refresh the page and try again.</div>');
      return;
    }

    socket = window.io(window.APP_CONFIG.API_BASE_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: {
        token: XDevsAuth.getToken()
      }
    });

    socket.on("connect", () => {
      setStatus("Live");
      if (activeCommissionId) joinActiveRoom();
    });

    socket.on("disconnect", () => {
      setStatus("Reconnecting…");
    });

    socket.on("connect_error", () => {
      setStatus("Offline");
    });

    socket.on("chat_message", (message) => {
      if (!message || message.commission !== activeCommissionId) {
        loadConversations();
        return;
      }

      if (!activeMessages.some((item) => item._id === message._id)) {
        activeMessages.push(message);
      }

      renderMessages();
      markRead();
      loadConversations();
    });

    socket.on("typing", (payload) => {
      if (!payload || payload.commissionId !== activeCommissionId) return;
      if (!els.typing) return;

      els.typing.hidden = !payload.active;
      els.typing.textContent = payload.active
        ? `${payload.user?.username || "Someone"} is typing…`
        : "";
    });
  }

  function joinActiveRoom() {
    if (!socket?.connected || !activeCommissionId) return;

    socket.emit("join_commission", activeCommissionId, (result) => {
      if (!result?.success) {
        setStatus("Chat unavailable");
      }
    });
  }

  function renderMessages() {
    if (!els.messages) return;

    if (!activeMessages.length) {
      els.messages.innerHTML = `
        <div class="chat-empty chat-empty-small">
          <div class="chat-empty-icon">✦</div>
          <h3>No messages yet</h3>
          <p>Send the first message about this commission.</p>
        </div>`;
      return;
    }

    els.messages.innerHTML = activeMessages.map((message) => {
      const mine = String(message.sender?._id || message.sender) === String(getCurrentUserId());
      const sender = message.sender?.username || (mine ? "You" : "User");

      return `
        <div class="chat-message-row ${mine ? "mine" : "theirs"}">
          <article class="chat-message">
            <div class="chat-message-author">${escapeHtml(mine ? "You" : sender)}</div>
            <div class="chat-message-body">${formatMessage(message.body)}</div>
            <time datetime="${escapeAttribute(message.createdAt)}">${formatTime(message.createdAt)}</time>
          </article>
        </div>`;
    }).join("");

    els.messages.scrollTop = els.messages.scrollHeight;
  }

  async function sendMessage(event) {
    event.preventDefault();

    const body = els.input?.value.trim();
    if (!body || !activeCommissionId) return;

    const button = els.form.querySelector("button[type=submit]");
    button.disabled = true;

    try {
      if (socket?.connected) {
        await new Promise((resolve, reject) => {
          socket.emit("send_message", {
            commissionId: activeCommissionId,
            body
          }, (result) => {
            if (result?.success) resolve(result);
            else reject(new Error(result?.message || "Could not send message."));
          });
        });
      } else {
        const result = await XDevsAuth.apiFetch(`/api/chat/${activeCommissionId}/messages`, {
          method: "POST",
          body: JSON.stringify({ body })
        });

        if (!activeMessages.some((item) => item._id === result.message._id)) {
          activeMessages.push(result.message);
        }
        renderMessages();
      }

      els.input.value = "";
      sendTyping(false);
      await loadConversations();
    } catch (error) {
      alert(error.message);
    } finally {
      button.disabled = false;
      els.input?.focus();
    }
  }

  function handleKeydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      els.form?.requestSubmit();
    }
  }

  function handleTyping() {
    sendTyping(true);
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => sendTyping(false), 1000);
  }

  function sendTyping(active) {
    if (!socket?.connected || !activeCommissionId) return;

    if (typingSent === active) return;
    typingSent = active;

    socket.emit("typing", {
      commissionId: activeCommissionId,
      active
    });
  }

  function markRead() {
    if (socket?.connected && activeCommissionId) {
      socket.emit("mark_read", activeCommissionId);
    }
  }

  function showConversationList() {
    activeCommissionId = null;
    if (socket?.connected) {
      // The previous room is intentionally left by selectConversation; this is only UI state.
    }

    els.layout?.classList.remove("chat-mobile-active");
    if (els.active) els.active.hidden = true;
    if (els.empty) els.empty.hidden = false;
    if (els.typing) els.typing.hidden = true;
    renderConversationList();
  }

  function updateUnreadBadge() {
    const count = conversations.reduce((sum, item) => sum + (Number(item.unreadCount) || 0), 0);
    if (!els.unread) return;

    els.unread.hidden = count === 0;
    els.unread.textContent = count > 99 ? "99+" : String(count);
  }

  function setStatus(value) {
    if (!els.status) return;
    els.status.textContent = value;
    els.status.classList.toggle("online", value === "Live");
    document.querySelector(".chat-live-dot")?.classList.toggle("online", value === "Live");
  }

  function getCurrentUserId() {
    try {
      const raw = localStorage.getItem("xdevs_user");
      return raw ? JSON.parse(raw)?.id : null;
    } catch {
      return null;
    }
  }

  function formatMessage(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  function formatTime(value) {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
  }

  window.XDevsChat = Object.freeze({ init });
})();
