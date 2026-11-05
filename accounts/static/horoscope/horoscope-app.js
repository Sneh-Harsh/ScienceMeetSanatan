/* Horoscope page — app layer: live sky background, section dock, jump-to-results.
   Pure progressive enhancement; page.js owns all data and rendering. */
(function () {
  "use strict";

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var body = document.body;

  /* ---------- time-of-day tint ---------- */
  function tod(h) {
    if (h >= 5 && h < 9) return "dawn";
    if (h >= 9 && h < 16) return "day";
    if (h >= 16 && h < 20) return "dusk";
    return "night";
  }
  body.setAttribute("data-tod", tod(new Date().getHours()));

  /* ---------- dock ---------- */
  var dock = document.getElementById("hsDock");
  var results = document.getElementById("horoscopeResults");
  var wantJump = false;

  function resultsReady() { return results && !results.hidden; }

  function syncDock() {
    if (!dock) return;
    var ready = resultsReady();
    dock.setAttribute("data-ready", ready ? "1" : "0");
    dock.querySelectorAll("[data-needs=results]").forEach(function (a) {
      if (ready) a.removeAttribute("aria-disabled"); else a.setAttribute("aria-disabled", "true");
    });
  }

  function offsetTop() { return window.innerWidth < 760 ? 76 : 92; }

  function goTo(id, smooth) {
    var el = document.getElementById(id);
    if (!el) return;
    var y = el.getBoundingClientRect().top + window.scrollY - offsetTop();
    window.scrollTo({ top: Math.max(0, y), behavior: smooth === false || reduce ? "auto" : "smooth" });
  }

  if (dock) {
    dock.addEventListener("click", function (e) {
      var a = e.target.closest(".hs-dock__item");
      if (!a) return;
      e.preventDefault();
      if (a.getAttribute("aria-disabled") === "true") {
        a.classList.remove("is-nudge"); void a.offsetWidth; a.classList.add("is-nudge");
        goTo("secBirth");
        var d = document.getElementById("hDate");
        if (d && !d.value) { try { d.focus({ preventScroll: true }); } catch (_) {} }
        return;
      }
      goTo(a.getAttribute("data-target"));
    });

    var items = Array.prototype.slice.call(dock.querySelectorAll(".hs-dock__item"));
    var visible = {};
    function setActive(id) {
      items.forEach(function (a) {
        var on = a.getAttribute("data-target") === id;
        a.classList.toggle("is-active", on);
        if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
      });
    }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
        var order = items.map(function (a) { return a.getAttribute("data-target"); });
        for (var i = order.length - 1; i >= 0; i--) {
          if (visible[order[i]]) { setActive(order[i]); return; }
        }
      }, { rootMargin: "-35% 0px -55% 0px", threshold: 0 });
      items.forEach(function (a) {
        var t = document.getElementById(a.getAttribute("data-target"));
        if (t) io.observe(t);
      });
    }

    /* tuck the dock away only while the on-screen keyboard is actually open */
    var vv = window.visualViewport;
    function syncTyping() {
      var a = document.activeElement;
      var field = a && a.matches && a.matches("input, textarea");
      var kb = vv ? vv.height < window.innerHeight - 140 : false;
      body.classList.toggle("hs-typing", !!(field && kb && window.innerWidth < 760));
    }
    document.addEventListener("focusin", function () { setTimeout(syncTyping, 250); });
    document.addEventListener("focusout", function () { setTimeout(syncTyping, 100); });
    if (vv) vv.addEventListener("resize", syncTyping);
  }

  /* ---------- jump to results after generating ---------- */
  var gen = document.getElementById("generateHoroscopeBtn");
  if (gen) gen.addEventListener("click", function () { wantJump = true; });

  if (results && "MutationObserver" in window) {
    var wasReady = resultsReady();
    new MutationObserver(function () {
      var now = resultsReady();
      syncDock();
      if (now && !wasReady && wantJump) {
        wantJump = false;
        setTimeout(function () { goTo("secOverview"); }, 120);
      }
      wasReady = now;
    }).observe(results, { attributes: true, attributeFilter: ["hidden"] });
  }
  syncDock();

  /* ---------- tiny life: greeting card tilts toward the pointer (desktop only) ---------- */
  if (!reduce && window.matchMedia && window.matchMedia("(hover:hover) and (pointer:fine)").matches) {
    var inst = document.getElementById("heroInstrument");
    if (inst) {
      inst.addEventListener("pointermove", function (e) {
        var r = inst.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        inst.style.transform = "perspective(900px) rotateY(" + x * 5 + "deg) rotateX(" + -y * 5 + "deg) translateY(-2px)";
      });
      inst.addEventListener("pointerleave", function () { inst.style.transform = ""; });
    }
  }
})();
