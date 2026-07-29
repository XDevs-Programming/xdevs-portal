document.addEventListener("DOMContentLoaded", async () => {
  const user = await XDevsAuth.requireAuth(["client"]);
  if (!user) return;

  bindSidebar();
  bindUser(user);
  bindModals();
  bindForms();
  await loadCommissions();
});

let clientCommissions = [];

function bindUser(user) {
  document.querySelectorAll("[data-user-name]").forEach((element) => {
    element.textContent = user.username;
  });

  document.querySelectorAll("[data-user-avatar]").forEach((image) => {
    image.src = user.avatar || "../../assets/favicon.svg";
    image.alt = `${user.username}'s avatar`;
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

function bindModals() {
  document
    .querySelectorAll("[data-open-dialog]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        document.getElementById(button.dataset.openDialog)?.showModal();
      });
    });

  document
    .querySelectorAll("[data-close-dialog]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        button.closest("dialog")?.close();
      });
    });
}

function bindForms() {
  document
    .getElementById("commission-form")
    ?.addEventListener("submit", submitCommission);

  document
    .getElementById("review-form")
    ?.addEventListener("submit", submitReview);
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

function renderCommissions() {
  const list = document.getElementById("commission-list");

  if (!clientCommissions.length) {
    list.innerHTML =
      '<p class="notice">You have not submitted any commissions yet.</p>';
    return;
  }

  list.innerHTML = clientCommissions
    .map(
      (item) => `
        <article class="commission-card">
          <div class="commission-header">
            <div>
              <h3>${escapeHtml(item.title)}</h3>
              <div class="commission-meta">
                ${escapeHtml(item.category)} · ${formatDate(item.createdAt)}
              </div>
            </div>
            <span class="status">${escapeHtml(item.status)}</span>
          </div>
          <p class="commission-description">${escapeHtml(item.description)}</p>
          <div class="commission-meta">
            Budget: ${escapeHtml(item.budget)}
            ${item.deadline ? ` · Deadline: ${formatDate(item.deadline)}` : ""}
          </div>
          ${
            item.adminNotes
              ? `<p class="notice">Admin note: ${escapeHtml(item.adminNotes)}</p>`
              : ""
          }
        </article>
      `
    )
    .join("");
}

function updateStats() {
  const total = clientCommissions.length;
  const active = clientCommissions.filter((item) =>
    ["Accepted", "In Progress", "Testing"].includes(item.status)
  ).length;
  const pending = clientCommissions.filter((item) =>
    ["Pending", "Reviewing"].includes(item.status)
  ).length;
  const completed = clientCommissions.filter(
    (item) => item.status === "Completed"
  ).length;

  setText("stat-total", total);
  setText("stat-active", active);
  setText("stat-pending", pending);
  setText("stat-completed", completed);
}

function populateReviewOptions() {
  const select = document.getElementById("review-commission");
  const completed = clientCommissions.filter(
    (item) => item.status === "Completed"
  );

  select.innerHTML =
    '<option value="">Choose a completed commission</option>' +
    completed
      .map(
        (item) =>
          `<option value="${item._id}">${escapeHtml(item.title)}</option>`
      )
      .join("");
}

async function submitCommission(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));

  try {
    await XDevsAuth.apiFetch("/api/commissions", {
      method: "POST",
      body: JSON.stringify(data)
    });

    form.reset();
    form.closest("dialog").close();
    await loadCommissions();
  } catch (error) {
    alert(error.message);
  }
}

async function submitReview(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  data.rating = Number(data.rating);

  try {
    await XDevsAuth.apiFetch("/api/reviews", {
      method: "POST",
      body: JSON.stringify(data)
    });

    form.reset();
    form.closest("dialog").close();
    alert("Review submitted for approval.");
  } catch (error) {
    alert(error.message);
  }
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
