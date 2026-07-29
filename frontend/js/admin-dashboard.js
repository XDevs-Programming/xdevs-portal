document.addEventListener("DOMContentLoaded", async () => {
  const user = await XDevsAuth.requireAuth(["admin"]);
  if (!user) return;

  bindSidebar();
  bindUser(user);
  bindTabs();
  await Promise.all([loadCommissions(), loadReviews()]);
});

let allCommissions = [];
let allReviews = [];

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
  const sidebar = document.querySelector(".sidebar");

  document
    .querySelector("[data-sidebar-toggle]")
    ?.addEventListener("click", () => sidebar.classList.toggle("open"));
}

function bindTabs() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.view;

      document.querySelectorAll("[data-view]").forEach((item) => {
        item.classList.toggle("active", item === button);
      });

      document.querySelectorAll("[data-section]").forEach((section) => {
        section.hidden = section.dataset.section !== target;
      });
    });
  });
}

async function loadCommissions() {
  const list = document.getElementById("admin-commission-list");

  try {
    const result = await XDevsAuth.apiFetch("/api/commissions");
    allCommissions = result.commissions;
    renderCommissions();
    updateStats();
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
