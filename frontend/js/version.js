(function () {
  "use strict";

  const config = window.APP_CONFIG || {};

  function populate() {
    document.querySelectorAll("[data-app-version]").forEach((element) => {
      element.textContent = config.VERSION ? `v${config.VERSION}` : "";
    });

    document.querySelectorAll("[data-release-date]").forEach((element) => {
      element.textContent = config.RELEASE_DATE || "";
    });

    document.querySelectorAll("[data-current-year]").forEach((element) => {
      element.textContent = String(new Date().getFullYear());
    });

    document.querySelectorAll("[data-legal-contact]").forEach((element) => {
      if (config.LEGAL_CONTACT_EMAIL) {
        const link = document.createElement("a");
        link.href = `mailto:${config.LEGAL_CONTACT_EMAIL}`;
        link.textContent = config.LEGAL_CONTACT_EMAIL;
        element.replaceChildren(link);
      } else {
        element.textContent = "the contact method published on the XDevs Programming website";
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", populate);
  } else {
    populate();
  }
})();
