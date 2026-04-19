(function () {
  function initStarfield(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let stars = [];
    const STAR_COUNT = 180;

    function resize() {
      canvas.width = canvas.parentElement.offsetWidth;
      canvas.height = canvas.parentElement.offsetHeight;
      buildStars();
    }

    function buildStars() {
      stars = Array.from({ length: STAR_COUNT }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.2 + 0.2,
        alpha: Math.random() * 0.6 + 0.1,
        speed: Math.random() * 0.003 + 0.001,
        phase: Math.random() * Math.PI * 2,
      }));
    }

    function draw(t) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach((star) => {
        const alpha = star.alpha * (0.6 + 0.4 * Math.sin(t * star.speed + star.phase));
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(242,202,80,${alpha})`;
        ctx.fill();
      });
      window.requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener("resize", resize);
    window.requestAnimationFrame(draw);
  }

  function initReveal() {
    const elements = document.querySelectorAll(".reveal, .reveal-left, .reveal-right");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const delay = parseFloat(entry.target.style.transitionDelay || "0");
        window.setTimeout(() => entry.target.classList.add("visible"), delay * 1000);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });

    elements.forEach((element) => observer.observe(element));
  }

  function initHeroParallax() {
    const hero = document.querySelector("[data-about-hero]");
    const layer = document.getElementById("heroText");
    if (!hero || !layer || !window.matchMedia("(pointer: fine)").matches) return;

    hero.addEventListener("mousemove", (event) => {
      const rect = hero.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = (event.clientX - rect.left - cx) / cx;
      const dy = (event.clientY - rect.top - cy) / cy;
      layer.style.transform = `translate(${dx * 6}px, ${dy * 4}px)`;
    });

    hero.addEventListener("mouseleave", () => {
      layer.style.transform = "translate(0,0)";
      layer.style.transition = "transform 0.8s ease";
    });

    hero.addEventListener("mouseenter", () => {
      layer.style.transition = "transform 0.15s linear";
    });
  }

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", (event) => {
        const target = document.querySelector(anchor.getAttribute("href"));
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function initSparkle() {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    document.addEventListener("click", (event) => {
      const sparkle = document.createElement("div");
      sparkle.className = "sparkle";
      sparkle.style.left = `${event.clientX - 4}px`;
      sparkle.style.top = `${event.clientY - 4}px`;
      document.body.appendChild(sparkle);
      window.setTimeout(() => sparkle.remove(), 600);
    });
  }

  function initCardReveal(selector, gapMs) {
    document.querySelectorAll(selector).forEach((card, index) => {
      card.style.opacity = "0";
      card.style.transform = "translateY(20px)";
      card.style.transition = "opacity 0.7s ease, transform 0.7s ease, background 0.4s ease, box-shadow 0.4s ease";

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          window.setTimeout(() => {
            card.style.opacity = "1";
            card.style.transform = "translateY(0)";
          }, index * gapMs);
          observer.unobserve(card);
        });
      }, { threshold: 0.08 });
      observer.observe(card);
    });
  }

  function boot() {
    initStarfield("starfield");
    initStarfield("starfield2");
    initReveal();
    initHeroParallax();
    initSmoothScroll();
    initSparkle();
    initCardReveal(".platform-card", 70);
    initCardReveal(".diff-card", 80);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
