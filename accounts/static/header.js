document.querySelectorAll(".header").forEach((header) => {
  const menuButton = header.querySelector(".mobile-menu-btn");
  const navShell = header.querySelector(".nav-shell");
  const mobileBreakpoint = 1120;
  const closeMenu = () => {
    header.classList.remove("menu-open");
    menuButton?.setAttribute("aria-expanded", "false");
    navShell?.setAttribute("aria-hidden", "true");
    header.querySelectorAll(".explore-wrap.open, .profile-wrap.open").forEach((node) => {
      node.classList.remove("open");
    });
  };

  menuButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const isOpen = header.classList.toggle("menu-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
    navShell?.setAttribute("aria-hidden", String(!isOpen));
  });

  header.querySelectorAll(".explore-wrap > .nav-link").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      if (window.innerWidth > mobileBreakpoint) return;
      const wrap = trigger.closest(".explore-wrap");
      if (!wrap) return;
      event.preventDefault();
      event.stopPropagation();
      wrap.classList.toggle("open");
    });
  });

  const profileTrigger = header.querySelector(".profile-trigger");
  const profileWrap = header.querySelector(".profile-wrap");
  profileTrigger?.addEventListener("click", (event) => {
    if (window.innerWidth > mobileBreakpoint) return;
    event.preventDefault();
    event.stopPropagation();
    profileWrap?.classList.toggle("open");
  });

  header.querySelectorAll(".nav-link, .quiz-link, .dropdown a, .profile-link, .logout-btn").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= mobileBreakpoint) {
        closeMenu();
      }
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > mobileBreakpoint) {
      closeMenu();
    }
  });

  document.addEventListener("click", (event) => {
    if (window.innerWidth > mobileBreakpoint || !header.classList.contains("menu-open")) return;
    const clickedInsideShell = navShell?.contains(event.target);
    const clickedMenuButton = menuButton?.contains(event.target);
    if (!clickedInsideShell && !clickedMenuButton) {
      closeMenu();
    }
  });
});
