document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector("[data-menu-toggle]");
  const menu = document.querySelector("[data-nav-menu]");

  toggle?.addEventListener("click", () => {
    menu?.classList.toggle("open");
  });

  menu?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => menu.classList.remove("open"));
  });
});
