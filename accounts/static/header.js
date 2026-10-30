// Refractive glass (GlassSurface, vanilla port) for the navbar slab. Phones and touch devices keep the plain blur: the
// SVG displacement filter is re-rendered on every scroll frame, which is too costly there.
(function attachNavGlass() {
  const base = document.currentScript && document.currentScript.src;
  const header = document.querySelector(".header");
  if (!header || !base) return;
  const start = () => {
    if (!window.SmsGlassSurface || header.classList.contains("sms-glass")) return;
    const desktop = window.matchMedia("(min-width: 1121px) and (hover: hover)").matches;
    try {
      window.SmsGlassSurface.attach(header, {
        borderRadius: 26, distortionScale: -180, displace: 0.5, backgroundOpacity: 0.1, svg: desktop
      });
    } catch (e) { /* the CSS blur is already applied */ }
  };
  if (window.SmsGlassSurface) { start(); return; }
  const tag = document.createElement("script");
  tag.src = base.replace(/header\.js.*$/, "glass-surface.js?v=1");
  tag.onload = start;
  document.head.appendChild(tag);
})();

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
      const isOpen = wrap.classList.toggle("open");
      trigger.setAttribute("aria-expanded", String(isOpen));
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
    // Dropdown triggers only expand their submenu on mobile; closing here would collapse the menu before it can be used.
    if (link.matches(".explore-wrap > .nav-link")) return;
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

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && header.classList.contains("menu-open")) {
      closeMenu();
      menuButton?.focus();
    }
  });
});
