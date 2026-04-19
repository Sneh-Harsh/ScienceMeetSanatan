(function () {
  const ROOT_SELECTOR = "main, .content, .app";
  const REVEAL_SELECTOR = [
    "main > section",
    "main > article",
    ".content > section",
    ".app > .screen > section",
    ".app > .screen > div",
    ".library-main > section",
    ".library-layout > aside",
    ".library-layout > .library-main",
    ".page-hero",
    ".hero-shell",
    ".glass-panel",
    ".glass-subpanel",
    ".p-card",
    ".calendar-wrap",
    ".k-card",
    ".k-panel",
    ".k-hero",
    ".k-workspace > *",
    ".profile-panel",
    ".profile-hero",
    ".names-controls",
    ".deity-card",
    ".name-card",
    ".pulse-card",
    ".bento-card",
    ".feature-pulse",
    ".raashi-pulse",
    ".festival-orbit",
    ".celestial-grid",
    ".leaderboard",
    ".leaderboard-cluster",
    ".daily-card",
    ".browse-row",
    ".section-card",
    ".result-card",
    ".book-card",
    ".library-card",
    ".audio-card",
    ".audio-track-card",
    ".reader-card",
    ".horoscope-card",
    ".oracle-shell",
  ].join(",");

  const EXCLUDE_SELECTOR = [
    ".header",
    ".site-footer",
    "footer",
    "script",
    "style",
    "canvas",
    "video",
    ".dropdown",
    ".profile-card",
    ".loc-prompt",
    ".login-popup",
    ".login-popup-modal",
    ".daanpatra",
    ".daanpatra-modal",
    ".review-shell",
    ".review-modal",
    ".mini-player",
    ".full-player",
    ".audio-player",
    "[data-no-scroll-reveal]",
  ].join(",");

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const seen = new WeakSet();
  let observer = null;

  function isExcluded(element) {
    return !element || element.matches(EXCLUDE_SELECTOR) || Boolean(element.closest(EXCLUDE_SELECTOR));
  }

  function directionClass(element, index) {
    const rect = element.getBoundingClientRect();
    if (rect.width < 220) return "sms-reveal-soft";
    if (index % 5 === 1) return "sms-reveal-left";
    if (index % 5 === 3) return "sms-reveal-right";
    return "";
  }

  function markElement(element, index) {
    if (!(element instanceof HTMLElement) || seen.has(element) || isExcluded(element)) return;
    if (!element.offsetParent && element.getClientRects().length === 0) return;

    seen.add(element);

    if (prefersReducedMotion || !observer) {
      element.classList.add("sms-reveal-visible");
      return;
    }

    element.classList.add("sms-reveal-ready");
    const direction = directionClass(element, index);
    if (direction) element.classList.add(direction);
    element.style.setProperty("--sms-reveal-delay", `${Math.min(index * 45, 240)}ms`);
    observer.observe(element);
  }

  function collect(root) {
    const scope = root instanceof Element ? root : document;
    const candidates = Array.from(scope.querySelectorAll(REVEAL_SELECTOR));
    candidates.forEach((element, index) => markElement(element, index));
  }

  function initObserver() {
    if (prefersReducedMotion || !("IntersectionObserver" in window)) return;
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("sms-reveal-visible");
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.1,
      rootMargin: "0px 0px -6% 0px",
    });
  }

  function initMutationObserver() {
    if (!("MutationObserver" in window)) return;
    const mutationObserver = new MutationObserver((mutations) => {
      window.requestAnimationFrame(() => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (!(node instanceof Element)) return;
            if (node.matches(REVEAL_SELECTOR)) markElement(node, 0);
            collect(node);
          });
        });
      });
    });

    document.querySelectorAll(ROOT_SELECTOR).forEach((root) => {
      mutationObserver.observe(root, { childList: true, subtree: true });
    });
  }

  function boot() {
    document.documentElement.classList.add("sms-scroll-reveal-enabled");
    initObserver();
    collect(document);
    initMutationObserver();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
