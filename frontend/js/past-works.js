(function () {
  "use strict";

  const list = document.getElementById("public-past-works");

  if (!list) return;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeImageUrl(value) {
    if (!value) return "";

    try {
      const url = new URL(value, window.location.origin);

      if (!["http:", "https:"].includes(url.protocol)) {
        return "";
      }

      return url.href;
    } catch {
      return "";
    }
  }

  function renderUnavailable(message) {
    list.innerHTML = `<p class="notice">${escapeHtml(message)}</p>`;
  }

  function renderProjects(commissions) {
    if (!Array.isArray(commissions) || !commissions.length) {
      renderUnavailable("Public project showcases are coming soon.");
      return;
    }

    list.innerHTML = commissions
      .map((item) => {
        const completion = item?.completion || {};
        const videoId = String(completion.youtubeVideoId || "").trim();
        const thumbnail = safeImageUrl(completion.thumbnailUrl);

        let media = "";

        if (videoId) {
          media = `
            <iframe
              class="video-frame"
              src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}"
              title="${escapeHtml(item.title || "XDevs project video")}"
              loading="lazy"
              referrerpolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
            ></iframe>
          `;
        } else if (thumbnail) {
          media = `
            <img
              src="${escapeHtml(thumbnail)}"
              alt=""
              loading="lazy"
              style="width:100%;aspect-ratio:16/9;object-fit:cover"
            >
          `;
        }

        const technologies = Array.isArray(completion.technologies)
          ? completion.technologies
          : [];

        return `
          <article class="past-work-card">
            ${media}
            <div class="past-work-content">
              <span class="status">${escapeHtml(item.category)}</span>
              <h2 style="margin-top:.7rem">${escapeHtml(item.title)}</h2>
              <p class="commission-description">${escapeHtml(completion.summary || "")}</p>
              <div class="tech-list">
                ${technologies
                  .map((tech) => `<span class="tech-chip">${escapeHtml(tech)}</span>`)
                  .join("")}
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function loadPastWorks() {
    list.innerHTML = '<p class="notice">Loading projects…</p>';

    try {
      // If Render is asleep, allow the Smart Wake Scheduler to bring it online
      // before making the public Past Works request.
      if (window.XDevsWake?.ensureAwake) {
        await window.XDevsWake.ensureAwake({
          showOverlay: false
        });
      } else if (window.XDevsWake?.prewarm) {
        window.XDevsWake.prewarm();
      }

      const response = await fetch(
        `${APP_CONFIG.API_BASE_URL}/api/commissions/public/past-works`,
        {
          method: "GET",
          headers: {
            Accept: "application/json"
          },
          cache: "no-store"
        }
      );

      if (!response.ok) {
        throw new Error(`Past Works request failed with HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data?.success) {
        throw new Error(data?.message || "Past Works request was unsuccessful.");
      }

      renderProjects(data.commissions);
    } catch (error) {
      console.error("Past Works failed to load:", error);
      renderUnavailable("Past Works is temporarily unavailable. Please try again shortly.");
    }
  }

  loadPastWorks();
})();
