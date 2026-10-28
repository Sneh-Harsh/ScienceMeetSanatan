/* Pandit Booking page only: scroll reveal, pointer tilt with glare, hero depth, embers and a scroll progress bar.
   No dependencies. Disabled for reduced-motion users; tilt is mouse/pen only (never on touch). */
(function () {
  "use strict";
  var root = document.querySelector(".psb");
  if (!root) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  var phone = window.matchMedia("(max-width: 639px)").matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  document.documentElement.classList.add("psb-anim");
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- scroll progress ---------- */
  var bar = document.createElement("div");
  bar.className = "psb-progress"; bar.setAttribute("aria-hidden", "true");
  document.body.appendChild(bar);
  var ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      var h = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = "scaleX(" + (h > 0 ? Math.min(1, scrollY / h) : 0) + ")";
      var hero = $(".psb-hero__copy");
      if (hero && scrollY < innerHeight * 1.2) hero.style.transform = "translate3d(0," + (scrollY * 0.12).toFixed(1) + "px,0)";
      ticking = false;
    });
  }
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- hero: embers + orbit ---------- */
  var bg = $("#psbHeroBg");
  if (bg && !saveData) {
    var embers = document.createElement("div"); embers.className = "psb-embers"; embers.setAttribute("aria-hidden", "true");
    var n = phone ? 8 : 16, html = "";
    for (var i = 0; i < n; i++) {
      var r = function (a, b) { return (a + Math.random() * (b - a)).toFixed(2); };
      html += '<span class="psb-ember" style="--l:' + r(2, 98) + '%;--s:' + r(3, 8) + 'px;--t:' + r(9, 18) + 's;--dl:-' + r(0, 14) + 's;--dx:' + r(-60, 60) + 'px"></span>';
    }
    embers.innerHTML = html; bg.appendChild(embers);
    var orbit = document.createElement("div"); orbit.className = "psb-orbit"; orbit.setAttribute("aria-hidden", "true");
    var rings = ""; for (var k = 1; k <= 6; k++) rings += '<i style="--k:' + k + '"></i>';
    orbit.innerHTML = rings; bg.appendChild(orbit);
  }

  /* ---------- reveal on scroll ---------- */
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { var t = e.target; t.classList.add("is-in"); io.unobserve(t); setTimeout(function () { t.style.setProperty("--d", "0ms"); }, 1500); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }) : null;

  function reveal(el, delay, kind) {
    if (el.hasAttribute("data-rv-done")) return;
    el.setAttribute("data-rv-done", "1");
    el.setAttribute("data-rv", kind || "up");
    if (delay) el.style.setProperty("--d", delay + "ms");
    if (io) io.observe(el); else el.classList.add("is-in");
  }
  function revealGroup(sel, step, kind, ctx) {
    $$(sel, ctx).forEach(function (el, i) { reveal(el, Math.min(i, 8) * step, kind); });
  }
  revealGroup(".psb-head", 0);
  revealGroup(".psb-puja", 55, "up", $("#psbPujas"));
  revealGroup(".psb-steps li", 140);
  revealGroup(".psb-faq details", 70);
  revealGroup(".psb-final__row", 0, "zoom");
  revealGroup(".psb-legend li", 80);

  /* ---------- pointer tilt with glare (mouse / pen only) ---------- */
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  function makeTilt(el, max) {
    if (el.__tilt) return; el.__tilt = true;
    el.classList.add("psb-tilt");
    var glare = document.createElement("span"); glare.className = "psb-glare"; glare.setAttribute("aria-hidden", "true");
    el.appendChild(glare);
    var raf = 0;
    el.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      var b = el.getBoundingClientRect(), px = (e.clientX - b.left) / b.width, py = (e.clientY - b.top) / b.height;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        el.style.setProperty("--ty", ((px - 0.5) * 2 * max).toFixed(2) + "deg");
        el.style.setProperty("--tx", ((0.5 - py) * 2 * max).toFixed(2) + "deg");
        el.style.setProperty("--gx", (px * 100).toFixed(1) + "%"); el.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
        el.classList.add("is-tilting");
      });
    });
    el.addEventListener("pointerleave", function () {
      if (raf) cancelAnimationFrame(raf);
      el.classList.remove("is-tilting");
      el.style.setProperty("--tx", "0deg"); el.style.setProperty("--ty", "0deg");
    });
  }
  if (fine) {
    $$(".psb-puja, .psb-steps li").forEach(function (el) { makeTilt(el, 8); });
    var lib = $("#poojaLibrary");
    function wireCards() { $$(".pr-card", lib).forEach(function (el, i) { makeTilt(el, 5); reveal(el, Math.min(i, 6) * 60); }); }
    if (lib) { wireCards(); new MutationObserver(wireCards).observe(lib, { childList: true, subtree: true }); }

    /* hero card: gentle tilt toward the pointer, paused while the user is typing in it */
    var card = $(".psb-hero__card"), hero = $(".psb-hero");
    if (card && hero) {
      var g = document.createElement("span"); g.className = "psb-glare"; g.setAttribute("aria-hidden", "true"); card.appendChild(g);
      var raf2 = 0;
      hero.addEventListener("pointermove", function (e) {
        if (card.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
        var b = hero.getBoundingClientRect(), px = (e.clientX - b.left) / b.width, py = (e.clientY - b.top) / b.height;
        if (raf2) cancelAnimationFrame(raf2);
        raf2 = requestAnimationFrame(function () {
          card.classList.add("is-live");
          card.style.setProperty("--ty", ((px - 0.5) * 7).toFixed(2) + "deg");
          card.style.setProperty("--tx", ((0.5 - py) * 5).toFixed(2) + "deg");
          var cb = card.getBoundingClientRect();
          card.style.setProperty("--gx", Math.max(0, Math.min(100, ((e.clientX - cb.left) / cb.width) * 100)).toFixed(1) + "%");
          card.style.setProperty("--gy", Math.max(0, Math.min(100, ((e.clientY - cb.top) / cb.height) * 100)).toFixed(1) + "%");
        });
      });
      hero.addEventListener("pointerleave", function () { card.classList.remove("is-live"); card.style.setProperty("--tx", "0deg"); card.style.setProperty("--ty", "0deg"); });
    }

    /* magnetic primary buttons */
    $$(".psb-cta--primary, .psb-cta--secondary").forEach(function (b) {
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        b.style.translate = ((e.clientX - r.left - r.width / 2) * 0.12).toFixed(1) + "px " + ((e.clientY - r.top - r.height / 2) * 0.2).toFixed(1) + "px";
      });
      b.addEventListener("pointerleave", function () { b.style.translate = ""; });
    });
  } else {
    var lib2 = $("#poojaLibrary");
    function wire2() { $$(".pr-card", lib2).forEach(function (el, i) { reveal(el, Math.min(i, 4) * 50); }); }
    if (lib2) { wire2(); new MutationObserver(wire2).observe(lib2, { childList: true, subtree: true }); }
  }
})();
