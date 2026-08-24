document.addEventListener("DOMContentLoaded", async () => {
  const user = await XDevsAuth.requireAuth(["client"]);
  if (!user) return;

  bindSidebar();
  bindClientTabs();
  bindClientNotifications();
  bindUser(user);
  bindModals();
  bindForms();
  showPaymentReturnMessage();
  await XDevsChat.init("client");
  await Promise.all([loadCommissions(), loadPayments(), loadClientInvoiceArchive(), loadPastWorks()]);
  bindClientFiles();
  bindClientInvoiceArchive();
});

let clientCommissions = [];
let clientPayments = [];

function bindUser(user) {
  document.querySelectorAll("[data-user-name]").forEach((element) => {
    element.textContent = user.username;
  });
  document.querySelectorAll("[data-user-avatar]").forEach((image) => {
    image.src = user.avatar || "../../assets/favicon.svg";
    image.alt = `${user.username}'s avatar`;
  });
  document.querySelector("[data-logout]")?.addEventListener("click", XDevsAuth.logout);
}

function bindSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector("[data-sidebar-overlay]");
  const open = () => {
    sidebar?.classList.add("open");
    overlay?.classList.add("open");
    document.body.classList.add("sidebar-open");
  };
  const close = () => {
    sidebar?.classList.remove("open");
    overlay?.classList.remove("open");
    document.body.classList.remove("sidebar-open");
  };

  document.querySelector("[data-sidebar-toggle]")?.addEventListener("click", open);
  document.querySelector("[data-sidebar-close]")?.addEventListener("click", close);
  overlay?.addEventListener("click", close);
  document.querySelectorAll(".sidebar-link").forEach((item) => {
    item.addEventListener("click", () => {
      if (window.innerWidth <= 980) close();
    });
  });
}

function bindModals() {
  document.querySelectorAll("[data-open-dialog]").forEach((button) => {
    button.addEventListener("click", () => document.getElementById(button.dataset.openDialog)?.showModal());
  });
  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog")?.close());
  });
}

function bindForms() {
  document.getElementById("commission-form")?.addEventListener("submit", submitCommission);
  document.getElementById("review-form")?.addEventListener("submit", submitReview);
}

function showPaymentReturnMessage() {
  const params = new URLSearchParams(location.search);
  const state = params.get("payment");
  if (!state) return;
  const banner = document.getElementById("payment-banner");
  banner.hidden = false;
  banner.textContent = state === "success"
    ? "Payment submitted successfully. Stripe confirmation may take a few seconds to appear."
    : "Payment was cancelled. Your payment request remains available.";
  history.replaceState({}, "", location.pathname);
}

async function loadCommissions() {
  const list = document.getElementById("commission-list");
  try {
    const result = await XDevsAuth.apiFetch("/api/commissions/mine");
    clientCommissions = result.commissions;
    renderCommissions();
    updateStats();
    populateReviewOptions();
    populateClientFileCommissions();
  } catch (error) {
    list.innerHTML = `<p class="notice">${escapeHtml(error.message)}</p>`;
  }
}

async function loadPayments() {
  const list = document.getElementById("client-payment-list");
  try {
    const result = await XDevsAuth.apiFetch("/api/payments/mine");
    clientPayments = result.payments;
    renderPayments();
    updatePaymentStats();
  } catch (error) {
    list.innerHTML = `<p class="notice">${escapeHtml(error.message)}</p>`;
  }
}

function renderCommissions() {
  const list = document.getElementById("commission-list");
  if (!clientCommissions.length) {
    list.innerHTML = '<p class="notice">You have not submitted any commissions yet.</p>';
    return;
  }
  list.innerHTML = clientCommissions.map((item) => `
    <article class="commission-card">
      <div class="commission-header"><div><h3>${escapeHtml(item.title)}</h3><div class="commission-meta">${escapeHtml(item.category)} · ${formatDate(item.createdAt)}</div></div><span class="status">${escapeHtml(item.status)}</span></div>
      <p class="commission-description">${escapeHtml(item.description)}</p>
      <div class="commission-meta">Budget: ${escapeHtml(item.budget)}${item.deadline ? ` · Deadline: ${formatDate(item.deadline)}` : ""}</div>
      ${item.adminNotes ? `<p class="notice">Admin note: ${escapeHtml(item.adminNotes)}</p>` : ""}
    </article>`).join("");
}

function renderPayments() {
  const list = document.getElementById("client-payment-list");
  if (!clientPayments.length) {
    list.innerHTML = '<p class="notice">No payment requests yet.</p>';
    return;
  }
  list.innerHTML = clientPayments.map((payment) => `
    <article class="payment-card">
      <div class="commission-header"><div><h3>${escapeHtml(payment.commission?.title || "Commission payment")}</h3><div class="commission-meta">Requested ${formatDate(payment.createdAt)}</div></div><span class="payment-status ${payment.status}">${escapeHtml(payment.status)}</span></div>
      <div class="payment-amount">${formatMoney(payment.amount, payment.currency)}</div>
      ${payment.description ? `<p class="commission-description">${escapeHtml(payment.description)}</p>` : ""}
      <div class="commission-meta">Invoice ${escapeHtml(payment.invoiceNumber || "Pending number")}</div>
      ${payment.status === "pro_bono" ? '<p class="notice">This commission is pro bono. No payment is required.</p>' : ""}
      ${payment.paidAt && payment.status !== "pro_bono" ? `<div class="commission-meta">Paid ${formatDate(payment.paidAt)}</div>` : ""}
      <div class="card-actions">
        <button class="button secondary" type="button" data-invoice-id="${payment._id}">Download invoice PDF</button>
        ${payment.status === "pending" ? `<button class="button" type="button" data-pay-id="${payment._id}">Pay securely with Stripe</button>` : ""}
      </div>
    </article>`).join("");
  list.querySelectorAll("[data-pay-id]").forEach((button) => button.addEventListener("click", () => beginCheckout(button)));
  list.querySelectorAll("[data-invoice-id]").forEach((button) => button.addEventListener("click", () => downloadInvoice(button)));
}

async function beginCheckout(button) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Opening secure checkout…";
  try {
    const result = await XDevsAuth.apiFetch(`/api/payments/${button.dataset.payId}/checkout`, { method: "POST" });
    window.location.assign(result.checkoutUrl);
  } catch (error) {
    alert(error.message);
    button.disabled = false;
    button.textContent = original;
  }
}

async function downloadInvoice(button) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Generating PDF…";
  try {
    const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/api/payments/${button.dataset.invoiceId}/invoice`, {
      headers: { Authorization: `Bearer ${XDevsAuth.getToken()}` }
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || "Could not generate invoice.");
    }
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] || "XDevs-Invoice.pdf";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function updateStats() {
  setText("stat-total", clientCommissions.length);
  setText("stat-active", clientCommissions.filter((i) => ["Accepted", "In Progress", "Testing"].includes(i.status)).length);
  setText("stat-pending", clientCommissions.filter((i) => ["Pending", "Reviewing"].includes(i.status)).length);
  setText("stat-completed", clientCommissions.filter((i) => i.status === "Completed").length);
}

function updatePaymentStats() {
  const due = clientPayments.filter((p) => p.status === "pending").reduce((sum, p) => sum + p.amount, 0);
  const paid = clientPayments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  setText("stat-amount-due", formatMoney(due, "gbp"));
  setText("stat-amount-paid", formatMoney(paid, "gbp"));
}

function populateReviewOptions() {
  const select = document.getElementById("review-commission");
  const completed = clientCommissions.filter((item) => item.status === "Completed");
  select.innerHTML = '<option value="">Choose a completed commission</option>' + completed.map((item) => `<option value="${item._id}">${escapeHtml(item.title)}</option>`).join("");
}

async function submitCommission(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  try {
    await XDevsAuth.apiFetch("/api/commissions", { method: "POST", body: JSON.stringify(data) });
    form.reset(); form.closest("dialog").close(); await loadCommissions();
  } catch (error) { alert(error.message); }
}

async function submitReview(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form)); data.rating = Number(data.rating);
  try {
    await XDevsAuth.apiFetch("/api/reviews", { method: "POST", body: JSON.stringify(data) });
    form.reset(); form.closest("dialog").close(); alert("Review submitted for approval.");
  } catch (error) { alert(error.message); }
}

function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }
function formatDate(value) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value)); }
function formatMoney(pence, currency = "gbp") { return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format((Number(pence) || 0) / 100); }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }


function bindClientFiles() {
  const select = document.getElementById("client-file-commission");
  select?.addEventListener("change", loadClientFiles);
  document.getElementById("client-file-upload")?.addEventListener("click", uploadClientFile);
}

function populateClientFileCommissions() {
  const select = document.getElementById("client-file-commission");
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Choose a commission</option>' + clientCommissions
    .filter((item) => item.status !== "Rejected")
    .map((item) => `<option value="${item._id}">${escapeHtml(item.title)}</option>`).join("");
  select.value = current;
}

async function loadClientFiles() {
  const commissionId = document.getElementById("client-file-commission")?.value;
  const list = document.getElementById("client-file-list");
  if (!commissionId) {
    list.innerHTML = '<p class="notice">Choose a commission to view files.</p>';
    return;
  }
  try {
    const result = await XDevsAuth.apiFetch(`/api/files/commission/${commissionId}`);
    renderClientFiles(result.files);
  } catch (error) { list.innerHTML = `<p class="notice">${escapeHtml(error.message)}</p>`; }
}

function renderClientFiles(files) {
  const list = document.getElementById("client-file-list");
  if (!files.length) {
    list.innerHTML = '<p class="notice">No files have been shared for this commission.</p>';
    return;
  }
  list.innerHTML = files.map((file) => `
    <article class="file-card">
      <div class="file-details">
        <div class="file-name">${escapeHtml(file.originalName)}</div>
        <div class="file-badges">
          <span class="file-badge">${escapeHtml(file.category)}</span>
          <span class="file-badge">v${file.version}</span>
          <span class="file-badge">${formatFileSize(file.size)}</span>
          <span class="file-badge">Uploaded by ${escapeHtml(file.uploadedBy?.username || "User")}</span>
        </div>
      </div>
      <div class="card-actions">
        <button class="button small" data-file-download="${file._id}">Download</button>
        ${file.uploadedBy?._id === JSON.parse(localStorage.getItem("xdevs_user") || "{}").id ? `<button class="button small danger" data-file-delete="${file._id}">Delete</button>` : ""}
      </div>
    </article>`).join("");
  list.querySelectorAll("[data-file-download]").forEach((button) => button.addEventListener("click", () => openSecureDownload(button.dataset.fileDownload)));
  list.querySelectorAll("[data-file-delete]").forEach((button) => button.addEventListener("click", () => deleteClientFile(button.dataset.fileDelete)));
}

async function uploadClientFile() {
  const button = document.getElementById("client-file-upload");
  button.disabled = true;
  try {
    await secureUpload({
      commissionId: document.getElementById("client-file-commission").value,
      file: document.getElementById("client-file-input").files[0],
      category: "reference",
      progressElement: document.getElementById("client-upload-progress")
    });
    document.getElementById("client-file-input").value = "";
    await loadClientFiles();
  } catch (error) { alert(error.message); }
  finally { button.disabled = false; }
}

async function deleteClientFile(id) {
  if (!confirm("Delete this file permanently?")) return;
  try {
    await XDevsAuth.apiFetch(`/api/files/${id}`, { method: "DELETE" });
    await loadClientFiles();
  } catch (error) { alert(error.message); }
}

function formatFileSize(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}

async function secureUpload({ commissionId, file, category, progressElement }) {
  if (!commissionId) throw new Error("Choose a commission first.");
  if (!file) throw new Error("Choose a file first.");

  const request = await XDevsAuth.apiFetch("/api/files/request-upload", {
    method: "POST",
    body: JSON.stringify({
      commissionId,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      category
    })
  });

  progressElement.hidden = false;
  const bar = progressElement.querySelector("span");
  bar.style.width = "0%";

  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", request.uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) bar.style.width = `${Math.round((event.loaded / event.total) * 100)}%`;
    });
    xhr.addEventListener("load", () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Storage upload failed.")));
    xhr.addEventListener("error", () => reject(new Error("Storage upload failed.")));
    xhr.send(file);
  });

  await XDevsAuth.apiFetch(`/api/files/${request.file.id}/complete`, { method: "POST" });
  bar.style.width = "100%";
  setTimeout(() => { progressElement.hidden = true; bar.style.width = "0%"; }, 700);
}

async function openSecureDownload(fileId) {
  const result = await XDevsAuth.apiFetch(`/api/files/${fileId}/download`);
  window.location.assign(result.downloadUrl);
}


let clientInvoiceArchive = [];

function bindClientInvoiceArchive() {
  ["client-invoice-search", "client-invoice-status", "client-invoice-sort"].forEach((id) => {
    document.getElementById(id)?.addEventListener(id.includes("search") ? "input" : "change", renderClientInvoiceArchive);
  });
  document.getElementById("client-invoice-csv")?.addEventListener("click", () => downloadInvoiceExport("csv", false));
  document.getElementById("client-invoice-zip")?.addEventListener("click", () => downloadInvoiceExport("zip", false));
}

async function loadClientInvoiceArchive() {
  const list = document.getElementById("client-invoice-list");
  if (!list) return;
  try {
    const result = await XDevsAuth.apiFetch("/api/payments/invoices/mine");
    clientInvoiceArchive = result.invoices || [];
    renderClientInvoiceArchive();
  } catch (error) {
    list.innerHTML = `<p class="notice">${escapeHtml(error.message)}</p>`;
  }
}

function renderClientInvoiceArchive() {
  const list = document.getElementById("client-invoice-list");
  if (!list) return;
  const search = document.getElementById("client-invoice-search")?.value.trim().toLowerCase() || "";
  const status = document.getElementById("client-invoice-status")?.value || "all";
  const oldest = document.getElementById("client-invoice-sort")?.value === "oldest";
  const invoices = clientInvoiceArchive
    .filter((item) => status === "all" || item.status === status)
    .filter((item) => !search || [item.invoiceNumber, item.commissionSnapshot?.title, item.commission?.title, item.description].some((value) => String(value || "").toLowerCase().includes(search)))
    .sort((a, b) => (new Date(a.invoiceIssuedAt) - new Date(b.invoiceIssuedAt)) * (oldest ? 1 : -1));
  if (!invoices.length) {
    list.innerHTML = '<p class="notice">No invoices match these filters.</p>';
    return;
  }
  list.innerHTML = invoices.map(invoiceArchiveCard).join("");
  list.querySelectorAll("[data-archive-invoice-id]").forEach((button) => button.addEventListener("click", () => downloadInvoice({
    dataset: { invoiceId: button.dataset.archiveInvoiceId },
    disabled: false,
    textContent: button.textContent
  })));
}

function invoiceArchiveCard(item) {
  const title = item.commissionSnapshot?.title || item.commission?.title || "Commission";
  return `<article class="invoice-card">
    <div class="invoice-card-main">
      <div><span class="invoice-number">${escapeHtml(item.invoiceNumber)}</span><h3>${escapeHtml(title)}</h3><div class="commission-meta">Issued ${formatDate(item.invoiceIssuedAt || item.createdAt)}</div></div>
      <div class="invoice-card-total"><strong>${formatMoney(item.amount, item.currency)}</strong><span class="payment-status ${item.status}">${escapeHtml(item.status.replaceAll("_", " "))}</span></div>
    </div>
    <div class="card-actions"><button class="button secondary small" type="button" data-archive-invoice-id="${item._id}">Download PDF</button></div>
  </article>`;
}

async function downloadInvoiceExport(type, admin) {
  const endpoint = type === "zip" ? "/api/payments/invoices/export.zip" : "/api/payments/invoices/export.csv";
  try {
    const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}${endpoint}`, { headers: { Authorization: `Bearer ${XDevsAuth.getToken()}` } });
    if (!response.ok) throw new Error("Could not export invoices.");
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = type === "zip" ? "xdevs-invoice-archive.zip" : "xdevs-invoice-archive.csv";
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(link.href);
  } catch (error) { alert(error.message); }
}


function bindClientTabs() {
  const show = (target) => {
    document.querySelectorAll("[data-client-section]").forEach((section) => {
      section.hidden = section.dataset.clientSection !== target;
    });
    document.querySelectorAll("[data-client-view]").forEach((button) => {
      button.classList.toggle("active", button.dataset.clientView === target);
    });
  };

  document.querySelectorAll("[data-client-view]").forEach((button) => {
    button.addEventListener("click", () => show(button.dataset.clientView));
  });

  const hashTarget = window.location.hash.replace("#", "");
  if (["overview", "commissions", "past-works", "payments", "invoices", "files", "chat"].includes(hashTarget)) {
    show(hashTarget);
  } else {
    show("overview");
  }
}

async function loadPastWorks() {
  const list = document.getElementById("client-past-works");
  if (!list) return;

  try {
    const result = await XDevsAuth.apiFetch("/api/commissions/mine/past-works");
    if (!result.commissions.length) {
      list.innerHTML = '<p class="notice">Completed projects will automatically appear here.</p>';
      return;
    }

    list.innerHTML = result.commissions.map((item) => {
      const completion = item.completion || {};
      const video = completion.youtubeVideoId
        ? `<iframe class="video-frame" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(completion.youtubeVideoId)}" title="${escapeHtml(item.title)} showcase" loading="lazy" allowfullscreen></iframe>`
        : completion.thumbnailUrl
        ? `<img src="${escapeAttribute(completion.thumbnailUrl)}" alt="" style="width:100%;aspect-ratio:16/9;object-fit:cover">`
        : "";

      return `
        <article class="past-work-card">
          ${video}
          <div class="past-work-content">
            <span class="status">Completed</span>
            <h3 style="margin-top:.7rem">${escapeHtml(item.title)}</h3>
            <div class="commission-meta">${escapeHtml(item.category)} · ${formatDate(completion.completedAt || item.updatedAt)}</div>
            <p class="commission-description">${escapeHtml(completion.summary || item.description)}</p>
            ${completion.clientNotes ? `<p class="notice">${escapeHtml(completion.clientNotes)}</p>` : ""}
            <div class="tech-list">${(completion.technologies || []).map((tech) => `<span class="tech-chip">${escapeHtml(tech)}</span>`).join("")}</div>
          </div>
        </article>`;
    }).join("");
  } catch (error) {
    list.innerHTML = `<p class="notice">${escapeHtml(error.message)}</p>`;
  }
}

function bindClientNotifications() {
  document.getElementById("enable-notifications")?.addEventListener("click", async () => {
    try {
      const permission = await XDevsNotifications.requestPermission();
      alert(permission === "granted" ? "Desktop alerts enabled." : "Notification permission was not granted.");
    } catch (error) {
      alert(error.message);
    }
  });

  XDevsNotifications.start(() => {});
}


/* XDevs V5 mobile sidebar controller */
(function () {
  "use strict";

  if (window.XDevsV5Sidebar) return;

  function init() {
    const sidebar = document.querySelector(".sidebar, .dashboard-sidebar, [data-sidebar]");
    const toggle = document.querySelector(".mobile-sidebar-toggle, [data-sidebar-toggle]");
    const overlay = document.querySelector("[data-sidebar-overlay], .dashboard-overlay");

    if (!sidebar || !toggle) return;

    const close = () => {
      sidebar.classList.remove("open", "active");
      overlay?.classList.remove("active", "open");
      document.body.classList.remove("sidebar-open");
      overlay?.setAttribute("aria-hidden", "true");
      toggle.setAttribute("aria-expanded", "false");
    };

    const open = () => {
      sidebar.classList.add("open");
      overlay?.classList.add("active");
      document.body.classList.add("sidebar-open");
      overlay?.setAttribute("aria-hidden", "false");
      toggle.setAttribute("aria-expanded", "true");
    };

    toggle.addEventListener("click", () => {
      sidebar.classList.contains("open") ? close() : open();
    });

    overlay?.addEventListener("click", close);

    sidebar.querySelectorAll("a, button").forEach((item) => {
      item.addEventListener("click", () => {
        if (window.innerWidth <= 767) close();
      });
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 767) close();
    });

    window.XDevsV5Sidebar = { open, close };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
