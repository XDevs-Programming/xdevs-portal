document.addEventListener("DOMContentLoaded", async () => {
  const user = await XDevsAuth.requireAuth(["admin"]);
  if (!user) return;

  bindSidebar();
  bindUser(user);
  bindTabs();
  bindCompletionForm();
  bindAdminNotifications();
  await XDevsChat.init("admin");
  document.getElementById("payment-form")?.addEventListener("submit", createPaymentRequest);
  document.getElementById("payment-billing-type")?.addEventListener("change", updateBillingFields);
  updateBillingFields();
  document.querySelectorAll("[data-open-dialog]").forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.openDialog)?.showModal()));
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog")?.close()));
  await Promise.all([loadCommissions(), loadReviews(), loadPayments(), loadAdminInvoiceArchive()]);
  bindAdminInvoiceArchive();
  bindAdminFiles();
});

let allCommissions = [];
let allReviews = [];
let allPayments = [];

function bindUser(user) {
  document.querySelectorAll("[data-user-name]").forEach((element) => {
    element.textContent = user.username;
  });

  document.querySelectorAll("[data-user-avatar]").forEach((image) => {
    image.src = user.avatar || "../../assets/favicon.svg";
  });

  document
    .querySelector("[data-logout]")
    ?.addEventListener("click", XDevsAuth.logout);
}

function bindSidebar() {
  bindMobileSidebar();
}

function bindMobileSidebar() {
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

function bindTabs() {
  const show = (target) => {
    document.querySelectorAll("[data-view]").forEach((item) => {
      item.classList.toggle("active", item.dataset.view === target);
    });

    document.querySelectorAll("[data-section]").forEach((section) => {
      section.hidden = section.dataset.section !== target;
    });
  };

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.view;
      show(target);
      history.replaceState({}, "", `#${target}`);
    });
  });

  const hashTarget = window.location.hash.replace("#", "");
  const valid = ["overview", "commissions", "payments", "invoices", "files", "chat", "notifications", "reviews"];
  show(valid.includes(hashTarget) ? hashTarget : "overview");
}

async function loadCommissions() {
  const list = document.getElementById("admin-commission-list");

  try {
    const result = await XDevsAuth.apiFetch("/api/commissions");
    allCommissions = result.commissions;
    renderCommissions();
    updateStats();
    populatePaymentCommissionOptions();
    populateAdminFileCommissions();
  } catch (error) {
    list.innerHTML = `<p class="notice">${escapeHtml(error.message)}</p>`;
  }
}

function renderCommissions() {
  const list = document.getElementById("admin-commission-list");

  if (!allCommissions.length) {
    list.innerHTML = '<p class="notice">No commissions found.</p>';
    return;
  }

  list.innerHTML = allCommissions
    .map(
      (item) => `
        <article class="commission-card" data-commission-id="${item._id}">
          <div class="commission-header">
            <div>
              <h3>${escapeHtml(item.title)}</h3>
              <div class="commission-meta">
                ${escapeHtml(item.client?.username || "Unknown client")} ·
                ${escapeHtml(item.category)} · ${formatDate(item.createdAt)}
              </div>
            </div>
            <span class="status">${escapeHtml(item.status)}</span>
          </div>

          <p class="commission-description">${escapeHtml(item.description)}</p>

          <div class="commission-meta">
            Budget: ${escapeHtml(item.budget)}
          </div>

          <div class="form-row" style="margin-top: .9rem;">
            <label>
              Status
              <select data-status>
                ${statusOptions(item.status)}
              </select>
            </label>

            <label>
              Admin note
              <input data-notes value="${escapeAttribute(item.adminNotes || "")}">
            </label>
          </div>

          <div class="card-actions">
            <button class="button small" data-save>Save update</button>
            <button class="button small secondary" data-complete>Complete & archive</button>
            <button class="button small danger" data-delete>Delete</button>
          </div>
        </article>
      `
    )
    .join("");

  list.querySelectorAll("[data-save]").forEach((button) => {
    button.addEventListener("click", () => updateCommission(button));
  });

  list.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteCommission(button));
  });
  list.querySelectorAll("[data-complete]").forEach((button) => {
    button.addEventListener("click", () => openCompletionDialog(button));
  });
}

async function updateCommission(button) {
  const card = button.closest("[data-commission-id]");
  const id = card.dataset.commissionId;
  const status = card.querySelector("[data-status]").value;
  const adminNotes = card.querySelector("[data-notes]").value;

  try {
    await XDevsAuth.apiFetch(`/api/commissions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, adminNotes })
    });

    await loadCommissions();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteCommission(button) {
  const card = button.closest("[data-commission-id]");
  const id = card.dataset.commissionId;

  if (!confirm("Delete this commission permanently?")) return;

  try {
    await XDevsAuth.apiFetch(`/api/commissions/${id}`, {
      method: "DELETE"
    });

    await loadCommissions();
  } catch (error) {
    alert(error.message);
  }
}

async function loadReviews() {
  const list = document.getElementById("admin-review-list");

  try {
    const result = await XDevsAuth.apiFetch("/api/reviews");
    allReviews = result.reviews;
    renderReviews();
  } catch (error) {
    list.innerHTML = `<p class="notice">${escapeHtml(error.message)}</p>`;
  }
}

function renderReviews() {
  const list = document.getElementById("admin-review-list");

  if (!allReviews.length) {
    list.innerHTML = '<p class="notice">No reviews found.</p>';
    return;
  }

  list.innerHTML = allReviews
    .map(
      (review) => `
        <article class="review-admin-card" data-review-id="${review._id}">
          <div class="commission-header">
            <div>
              <h3>${escapeHtml(review.client?.username || "Client")}</h3>
              <div class="commission-meta">
                ${escapeHtml(review.commission?.title || "Commission")} ·
                ${"★".repeat(review.rating)}
              </div>
            </div>
            <span class="status">${review.approved ? "Approved" : "Pending"}</span>
          </div>

          <p class="commission-description">${escapeHtml(review.content)}</p>

          <div class="card-actions">
            <button class="button small" data-review-action="approve">
              ${review.approved ? "Unapprove" : "Approve"}
            </button>
            <button class="button small secondary" data-review-action="feature">
              ${review.featured ? "Unfeature" : "Feature"}
            </button>
            <button class="button small danger" data-review-action="hide">
              ${review.hidden ? "Show" : "Hide"}
            </button>
          </div>
        </article>
      `
    )
    .join("");

  list.querySelectorAll("[data-review-action]").forEach((button) => {
    button.addEventListener("click", () => moderateReview(button));
  });
}

async function moderateReview(button) {
  const card = button.closest("[data-review-id]");
  const review = allReviews.find((item) => item._id === card.dataset.reviewId);
  const action = button.dataset.reviewAction;

  const body =
    action === "approve"
      ? { approved: !review.approved }
      : action === "feature"
      ? { featured: !review.featured }
      : { hidden: !review.hidden };

  try {
    await XDevsAuth.apiFetch(`/api/reviews/${review._id}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    });

    await loadReviews();
  } catch (error) {
    alert(error.message);
  }
}


async function loadPayments() {
  const list = document.getElementById("admin-payment-list");
  try {
    const result = await XDevsAuth.apiFetch("/api/payments");
    allPayments = result.payments;
    renderPayments();
    updatePaymentStats();
  } catch (error) {
    if (list) list.innerHTML = `<p class="notice">${escapeHtml(error.message)}</p>`;
  }
}

function renderPayments() {
  const list = document.getElementById("admin-payment-list");
  if (!list) return;
  if (!allPayments.length) {
    list.innerHTML = '<p class="notice">No payment requests found.</p>';
    return;
  }
  list.innerHTML = allPayments.map((payment) => `
    <article class="payment-card" data-payment-id="${payment._id}">
      <div class="commission-header">
        <div><h3>${escapeHtml(payment.commission?.title || "Commission payment")}</h3>
        <div class="commission-meta">${escapeHtml(payment.client?.username || "Client")} · ${escapeHtml(payment.client?.email || "")} · ${formatDate(payment.createdAt)}</div></div>
        <span class="payment-status ${payment.status}">${escapeHtml(payment.status)}</span>
      </div>
      <div class="payment-amount">${formatMoney(payment.amount, payment.currency)}</div>
      ${payment.description ? `<p class="commission-description">${escapeHtml(payment.description)}</p>` : ""}
      <div class="commission-meta">Invoice ${escapeHtml(payment.invoiceNumber || "Pending number")}</div>
      ${payment.paidAt && payment.status !== "pro_bono" ? `<div class="commission-meta">Paid ${formatDate(payment.paidAt)}</div>` : ""}
      <div class="card-actions">
        <button class="button small secondary" data-invoice-id="${payment._id}">Download invoice PDF</button>
        ${payment.status === "pending" ? '<button class="button small danger" data-cancel-payment>Cancel request</button>' : ""}
      </div>
    </article>`).join("");
  list.querySelectorAll("[data-cancel-payment]").forEach((button) => button.addEventListener("click", () => cancelPayment(button)));
  list.querySelectorAll("[data-invoice-id]").forEach((button) => button.addEventListener("click", () => downloadInvoice(button)));
}

async function createPaymentRequest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const endpoint = data.billingType === "pro_bono" ? "/api/payments/pro-bono" : "/api/payments";
  if (data.billingType === "pro_bono") delete data.amount;
  delete data.billingType;

  try {
    await XDevsAuth.apiFetch(endpoint, { method: "POST", body: JSON.stringify(data) });
    form.reset();
    updateBillingFields();
    form.closest("dialog").close();
    await loadPayments();
  } catch (error) { alert(error.message); }
}

function updateBillingFields() {
  const type = document.getElementById("payment-billing-type")?.value || "paid";
  const amount = document.getElementById("payment-amount");
  const label = document.getElementById("payment-amount-label");
  if (!amount || !label) return;
  const proBono = type === "pro_bono";
  amount.disabled = proBono;
  amount.required = !proBono;
  label.hidden = proBono;
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

async function cancelPayment(button) {
  if (!confirm("Cancel this outstanding payment request?")) return;
  const id = button.closest("[data-payment-id]").dataset.paymentId;
  try {
    await XDevsAuth.apiFetch(`/api/payments/${id}/cancel`, { method: "PATCH" });
    await loadPayments();
  } catch (error) { alert(error.message); }
}

function populatePaymentCommissionOptions() {
  const select = document.getElementById("payment-commission");
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Choose a commission</option>' + allCommissions
    .filter((item) => item.status !== "Rejected")
    .map((item) => `<option value="${item._id}">${escapeHtml(item.client?.username || "Client")} — ${escapeHtml(item.title)}</option>`).join("");
  select.value = current;
}

function updatePaymentStats() {
  const paid = allPayments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  const outstanding = allPayments.filter((p) => p.status === "pending").reduce((sum, p) => sum + p.amount, 0);
  setText("stat-revenue", formatMoney(paid, "gbp"));
  setText("stat-outstanding", formatMoney(outstanding, "gbp"));
  setText("stat-payments", allPayments.filter((p) => p.status === "paid").length);
}

function formatMoney(pence, currency = "gbp") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format((Number(pence) || 0) / 100);
}

function updateStats() {
  setText("stat-total", allCommissions.length);
  setText(
    "stat-pending",
    allCommissions.filter((item) =>
      ["Pending", "Reviewing"].includes(item.status)
    ).length
  );
  setText(
    "stat-active",
    allCommissions.filter((item) =>
      ["Accepted", "In Progress", "Testing"].includes(item.status)
    ).length
  );
  setText(
    "stat-completed",
    allCommissions.filter((item) => item.status === "Completed").length
  );
}

function statusOptions(selected) {
  return [
    "Pending",
    "Reviewing",
    "Accepted",
    "In Progress",
    "Testing",
    "Completed",
    "Rejected"
  ]
    .map(
      (status) =>
        `<option ${status === selected ? "selected" : ""}>${status}</option>`
    )
    .join("");
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium"
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


function bindAdminFiles() {
  document.getElementById("admin-file-commission")?.addEventListener("change", loadAdminFiles);
  document.getElementById("admin-file-upload")?.addEventListener("click", uploadAdminFile);
}

function populateAdminFileCommissions() {
  const select = document.getElementById("admin-file-commission");
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Choose a commission</option>' + allCommissions
    .filter((item) => item.status !== "Rejected")
    .map((item) => `<option value="${item._id}">${escapeHtml(item.client?.username || "Client")} — ${escapeHtml(item.title)}</option>`).join("");
  select.value = current;
}

async function loadAdminFiles() {
  const commissionId = document.getElementById("admin-file-commission")?.value;
  const list = document.getElementById("admin-file-list");
  if (!commissionId) {
    list.innerHTML = '<p class="notice">Choose a commission to view files.</p>';
    return;
  }
  try {
    const result = await XDevsAuth.apiFetch(`/api/files/commission/${commissionId}`);
    renderAdminFiles(result.files);
  } catch (error) { list.innerHTML = `<p class="notice">${escapeHtml(error.message)}</p>`; }
}

function renderAdminFiles(files) {
  const list = document.getElementById("admin-file-list");
  if (!files.length) {
    list.innerHTML = '<p class="notice">No files are stored for this commission.</p>';
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
          <span class="file-badge">${escapeHtml(file.mimeType)}</span>
          <span class="file-badge">Uploaded by ${escapeHtml(file.uploadedBy?.username || "User")}</span>
        </div>
      </div>
      <div class="card-actions">
        <button class="button small" data-file-download="${file._id}">Download</button>
        <button class="button small danger" data-file-delete="${file._id}">Delete</button>
      </div>
    </article>`).join("");
  list.querySelectorAll("[data-file-download]").forEach((button) => button.addEventListener("click", () => openSecureDownload(button.dataset.fileDownload)));
  list.querySelectorAll("[data-file-delete]").forEach((button) => button.addEventListener("click", () => deleteAdminFile(button.dataset.fileDelete)));
}

async function uploadAdminFile() {
  const button = document.getElementById("admin-file-upload");
  button.disabled = true;
  try {
    await secureUpload({
      commissionId: document.getElementById("admin-file-commission").value,
      file: document.getElementById("admin-file-input").files[0],
      category: document.getElementById("admin-file-category").value,
      progressElement: document.getElementById("admin-upload-progress")
    });
    document.getElementById("admin-file-input").value = "";
    await loadAdminFiles();
  } catch (error) { alert(error.message); }
  finally { button.disabled = false; }
}

async function deleteAdminFile(id) {
  if (!confirm("Delete this stored file permanently?")) return;
  try {
    await XDevsAuth.apiFetch(`/api/files/${id}`, { method: "DELETE" });
    await loadAdminFiles();
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


let adminInvoiceArchive = [];
let adminInvoiceSummary = {};
let invoiceFilterTimer;

function bindAdminInvoiceArchive() {
  const instant = ["admin-invoice-status", "admin-invoice-from", "admin-invoice-to", "admin-invoice-sort"];
  instant.forEach((id) => document.getElementById(id)?.addEventListener("change", loadAdminInvoiceArchive));
  document.getElementById("admin-invoice-search")?.addEventListener("input", () => {
    clearTimeout(invoiceFilterTimer);
    invoiceFilterTimer = setTimeout(loadAdminInvoiceArchive, 250);
  });
  document.getElementById("admin-invoice-csv")?.addEventListener("click", () => downloadAdminInvoiceExport("csv"));
  document.getElementById("admin-invoice-zip")?.addEventListener("click", () => downloadAdminInvoiceExport("zip"));
}

function adminInvoiceQuery() {
  const params = new URLSearchParams();
  const fields = {
    search: document.getElementById("admin-invoice-search")?.value.trim(),
    status: document.getElementById("admin-invoice-status")?.value,
    from: document.getElementById("admin-invoice-from")?.value,
    to: document.getElementById("admin-invoice-to")?.value,
    sort: document.getElementById("admin-invoice-sort")?.value
  };
  Object.entries(fields).forEach(([key, value]) => { if (value && value !== "all" && value !== "newest") params.set(key, value); });
  return params.toString();
}

async function loadAdminInvoiceArchive() {
  const list = document.getElementById("admin-invoice-list");
  if (!list) return;
  try {
    const query = adminInvoiceQuery();
    const result = await XDevsAuth.apiFetch(`/api/payments/invoices/archive${query ? `?${query}` : ""}`);
    adminInvoiceArchive = result.invoices || [];
    adminInvoiceSummary = result.summary || {};
    renderAdminInvoiceArchive();
    setText("invoice-total", adminInvoiceSummary.totalInvoices || 0);
    setText("invoice-revenue", formatMoney(adminInvoiceSummary.revenue || 0, "gbp"));
    setText("invoice-outstanding", formatMoney(adminInvoiceSummary.outstanding || 0, "gbp"));
    setText("invoice-pro-bono", adminInvoiceSummary.proBonoCount || 0);
  } catch (error) {
    list.innerHTML = `<p class="notice">${escapeHtml(error.message)}</p>`;
  }
}

function renderAdminInvoiceArchive() {
  const list = document.getElementById("admin-invoice-list");
  if (!adminInvoiceArchive.length) {
    list.innerHTML = '<p class="notice">No invoices match these filters.</p>';
    return;
  }
  list.innerHTML = adminInvoiceArchive.map((item) => {
    const client = item.clientSnapshot?.username || item.client?.username || "Client";
    const email = item.clientSnapshot?.email || item.client?.email || "";
    const title = item.commissionSnapshot?.title || item.commission?.title || "Commission";
    return `<article class="invoice-card">
      <div class="invoice-card-main">
        <div><span class="invoice-number">${escapeHtml(item.invoiceNumber)}</span><h3>${escapeHtml(title)}</h3><div class="commission-meta">${escapeHtml(client)}${email ? ` · ${escapeHtml(email)}` : ""} · Issued ${formatDate(item.invoiceIssuedAt || item.createdAt)}</div></div>
        <div class="invoice-card-total"><strong>${formatMoney(item.amount, item.currency)}</strong><span class="payment-status ${item.status}">${escapeHtml(item.status.replaceAll("_", " "))}</span></div>
      </div>
      <div class="card-actions"><button class="button secondary small" type="button" data-admin-archive-invoice="${item._id}">Download / regenerate PDF</button></div>
    </article>`;
  }).join("");
  list.querySelectorAll("[data-admin-archive-invoice]").forEach((button) => button.addEventListener("click", () => downloadInvoice({
    dataset: { invoiceId: button.dataset.adminArchiveInvoice }, disabled: false, textContent: button.textContent
  })));
}

async function downloadAdminInvoiceExport(type) {
  const query = adminInvoiceQuery();
  const path = type === "zip" ? "/api/payments/invoices/export.zip" : "/api/payments/invoices/export.csv";
  try {
    const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}${path}${query ? `?${query}` : ""}`, { headers: { Authorization: `Bearer ${XDevsAuth.getToken()}` } });
    if (!response.ok) throw new Error("Could not export invoice archive.");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = type === "zip" ? "xdevs-invoice-archive.zip" : "xdevs-invoice-archive.csv";
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  } catch (error) { alert(error.message); }
}


function openCompletionDialog(button) {
  const card = button.closest("[data-commission-id]");
  const commission = allCommissions.find((item) => item._id === card.dataset.commissionId);
  const dialog = document.getElementById("completion-dialog");
  const form = document.getElementById("completion-form");
  if (!commission || !dialog || !form) return;

  form.reset();
  form.commissionId.value = commission._id;
  form.summary.value = commission.completion?.summary || "";
  form.clientNotes.value = commission.completion?.clientNotes || "";
  form.youtubeUrl.value = commission.completion?.youtubeUrl || "";
  form.technologies.value = (commission.completion?.technologies || []).join(", ");
  form.thumbnailUrl.value = commission.completion?.thumbnailUrl || "";
  form.clientVisible.checked = commission.completion?.clientVisible !== false;
  form.publicPortfolio.checked = commission.completion?.publicPortfolio === true;
  dialog.showModal();
}

function bindCompletionForm() {
  document.getElementById("completion-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const id = form.commissionId.value;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Archiving…";

    try {
      await XDevsAuth.apiFetch(`/api/commissions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "Completed",
          completion: {
            summary: form.summary.value.trim(),
            clientNotes: form.clientNotes.value.trim(),
            youtubeUrl: form.youtubeUrl.value.trim(),
            technologies: form.technologies.value.split(",").map((item) => item.trim()).filter(Boolean),
            thumbnailUrl: form.thumbnailUrl.value.trim(),
            clientVisible: form.clientVisible.checked,
            publicPortfolio: form.publicPortfolio.checked
          }
        })
      });

      form.closest("dialog").close();
      await loadCommissions();
      showToast("Commission completed and added to Past Works.");
    } catch (error) {
      alert(error.message);
    } finally {
      button.disabled = false;
      button.textContent = "Complete and archive";
    }
  });
}

function bindAdminNotifications() {
  document.getElementById("enable-notifications")?.addEventListener("click", async () => {
    try {
      const permission = await XDevsNotifications.requestPermission();
      showToast(permission === "granted" ? "Desktop alerts enabled." : "Notification permission was not granted.");
    } catch (error) {
      alert(error.message);
    }
  });

  document.getElementById("mark-all-notifications-read")?.addEventListener("click", () => {
    XDevsNotifications.markAllRead();
  });

  XDevsNotifications.start(renderAdminNotifications);
}

function renderAdminNotifications(result) {
  const badge = document.getElementById("sidebar-notification-badge");
  if (badge) {
    badge.hidden = result.unread === 0;
    badge.textContent = result.unread;
  }

  const list = document.getElementById("admin-notification-list");
  const activity = document.getElementById("admin-activity-feed");
  const html = result.notifications.length
    ? result.notifications.map((item) => `
        <article class="notification-item ${item.read ? "" : "unread"}" data-notification-id="${item._id}" data-notification-link="${escapeAttribute(item.link || "")}">
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.message)}</p>
          <div class="notification-time">${formatDateTime(item.createdAt)}</div>
        </article>`).join("")
    : '<p class="notice">No notifications yet.</p>';

  if (list) list.innerHTML = html;
  if (activity) activity.innerHTML = html;

  document.querySelectorAll("[data-notification-id]").forEach((item) => {
    item.addEventListener("click", async () => {
      await XDevsNotifications.markRead(item.dataset.notificationId);
      if (item.dataset.notificationLink) window.location.assign(item.dataset.notificationLink);
    });
  });
}

function showToast(message) {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
