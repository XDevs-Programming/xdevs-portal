document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector("[data-menu-toggle]");
  const menu = document.querySelector("[data-nav-menu]");

  const setOpen = (open) => {
    menu?.classList.toggle("open", open);
    toggle?.setAttribute("aria-expanded", String(open));
    toggle?.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
  };

  toggle?.addEventListener("click", () => {
    setOpen(!menu?.classList.contains("open"));
  });

  menu?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });

  document.addEventListener("click", (event) => {
    if (!menu?.classList.contains("open")) return;
    if (menu.contains(event.target) || toggle?.contains(event.target)) return;
    setOpen(false);
  });
});
