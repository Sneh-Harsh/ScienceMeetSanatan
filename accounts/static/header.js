document.querySelectorAll(".header").forEach((header) => {
  const menuButton = header.querySelector(".mobile-menu-btn");
  const navShell = header.querySelector(".nav-shell");

  menuButton?.addEventListener("click", () => {
    const isOpen = header.classList.toggle("menu-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
    navShell?.setAttribute("aria-hidden", String(!isOpen));
  });

  header.querySelectorAll(".explore-wrap > .nav-link").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      if (window.innerWidth > 900) return;
      const wrap = trigger.closest(".explore-wrap");
      if (!wrap) return;
      event.preventDefault();
      wrap.classList.toggle("open");
    });
  });

  const profileTrigger = header.querySelector(".profile-trigger");
  const profileWrap = header.querySelector(".profile-wrap");
  profileTrigger?.addEventListener("click", () => {
    if (window.innerWidth > 900) return;
    profileWrap?.classList.toggle("open");
  });
});
