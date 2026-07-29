document.addEventListener("DOMContentLoaded", async () => {
  const container = document.querySelector("[data-review-container]");

  if (!container) return;

  try {
    const response = await fetch(
      `${APP_CONFIG.API_BASE_URL}/api/reviews/public`
    );

    const data = await response.json();

    if (!response.ok || !data.reviews?.length) {
      container.innerHTML =
        '<p class="empty-state">Client reviews will appear here after approval.</p>';
      return;
    }

    container.innerHTML = data.reviews
      .slice(0, 3)
      .map((review) => {
        const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
        const avatar =
          review.client?.avatar || "assets/favicon.svg";

        return `
          <article class="review-card">
            <div class="review-stars">${stars}</div>
            <p>${escapeHtml(review.content)}</p>
            <div class="review-meta">
              <img class="review-avatar" src="${avatar}" alt="">
              <div>
                <strong>${escapeHtml(review.client?.username || "Client")}</strong>
                <div>${escapeHtml(review.commission?.title || "Commission")}</div>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  } catch (error) {
    console.error(error);
    container.innerHTML =
      '<p class="empty-state">Reviews are temporarily unavailable.</p>';
  }
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
