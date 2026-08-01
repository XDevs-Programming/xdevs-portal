document.addEventListener("DOMContentLoaded", async () => {
  const user = await XDevsAuth.requireAuth(["client"]);
  if (!user) return;

  bindSidebar();
  bindUser(user);
  bindModals();
  bindForms();
  showPaymentReturnMessage();
  await Promise.all([loadCommissions(), loadPayments()]);
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
  document.querySelector("[data-sidebar-toggle]")?.addEventListener("click", () => sidebar.classList.toggle("open"));
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
