/* Kundali page polish: cursor spotlight on glass panels and a smooth hand-off to the chart once it is ready. */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;


  // living background: slowly turning astrolabe rings, breathing glows, twinkling stars and drifting embers
  var bg = document.querySelector(".kx-bg");
  if (bg) {
    var small = window.matchMedia("(max-width: 640px)").matches;
    var VS = "\uFE0E"; // force the plain text glyph, not the coloured emoji
    var Z = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"].map(function (g) { return g + VS; }), P = ["☉", "☽", "♂", "☿", "♃", "♀", "♄", "☊", "☋"].map(function (g) { return g + VS; });
    function ringSvg(kind) {
      var out = '<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g fill="none" stroke="#e6b95a" stroke-linecap="round">';
      out += '<circle cx="500" cy="500" r="494" stroke-width="3"/><circle cx="500" cy="500" r="470" stroke-width="1.2"/><circle cx="500" cy="500" r="478" stroke-width="6" stroke-dasharray="1.6 11.4"/>';
      out += '<g class="kx-spin' + (kind === "b" ? " kx-spin--rev" : "") + '"><circle cx="500" cy="500" r="395" stroke-width="1.4"/><circle cx="500" cy="500" r="330" stroke-width="1"/>';
      for (var i = 0; i < 12; i++) {
        var a = i * 30, rad = a * Math.PI / 180;
        out += '<line x1="' + (500 + 330 * Math.sin(rad)).toFixed(1) + '" y1="' + (500 - 330 * Math.cos(rad)).toFixed(1) + '" x2="' + (500 + 470 * Math.sin(rad)).toFixed(1) + '" y2="' + (500 - 470 * Math.cos(rad)).toFixed(1) + '" stroke-width="1.4"/>';
      }
      out += "</g></g>";
      out += '<g class="kx-spin' + (kind === "b" ? " kx-spin--rev" : "") + '" fill="#e6b95a" font-size="54" text-anchor="middle" font-family="serif">';
      for (var j = 0; j < 12; j++) {
        var ang = (j * 30 + 15) * Math.PI / 180;
        out += '<text x="' + (500 + 432 * Math.sin(ang)).toFixed(1) + '" y="' + (500 - 432 * Math.cos(ang) + 18).toFixed(1) + '">' + Z[j] + "</text>";
      }
      out += "</g>";
      out += '<g class="kx-spin kx-spin--slow' + (kind === "b" ? "" : " kx-spin--rev") + '" fill="#e6b95a" font-size="40" text-anchor="middle" font-family="serif" stroke="none">';
      for (var k = 0; k < 9; k++) {
        var an = k * 40 * Math.PI / 180;
        out += '<text x="' + (500 + 262 * Math.sin(an)).toFixed(1) + '" y="' + (500 - 262 * Math.cos(an) + 14).toFixed(1) + '">' + P[k] + "</text>";
      }
      out += '</g><g class="kx-spin kx-spin--slow" fill="none" stroke="#e6b95a" stroke-width="1.2"><circle cx="500" cy="500" r="190"/><circle cx="500" cy="500" r="150" stroke-dasharray="3 9"/><path d="M500 310 L546 454 L690 500 L546 546 L500 690 L454 546 L310 500 L454 454Z"/></g></svg>';
      return out;
    }
    var h = '<div class="kx-glow kx-glow--1"></div><div class="kx-glow kx-glow--2"></div>' +
      '<div class="kx-ring kx-ring--a">' + ringSvg("a") + '</div><div class="kx-ring kx-ring--b">' + ringSvg("b") + '</div><div class="kx-shoot"></div>';
    var stars = small ? 22 : 46, embers = small ? 12 : 26, i;
    for (i = 0; i < stars; i++) h += '<i class="kx-star" style="left:' + (Math.random() * 100).toFixed(1) + "%;top:" + (Math.random() * 100).toFixed(1) + "%;--t:" + (2.5 + Math.random() * 5).toFixed(1) + "s;animation-delay:-" + (Math.random() * 6).toFixed(1) + 's"></i>';
    for (i = 0; i < embers; i++) h += '<i class="kx-ember" style="left:' + (Math.random() * 100).toFixed(1) + "%;--s:" + (2 + Math.random() * 4).toFixed(1) + "px;--dur:" + (14 + Math.random() * 16).toFixed(1) + "s;--del:-" + (Math.random() * 20).toFixed(1) + "s;--dx:" + (Math.round(Math.random() * 120) - 60) + 'px"></i>';
    bg.insertAdjacentHTML("afterbegin", h);
    if (!reduce) {
      var sy = 0, ticking = false;
      window.addEventListener("scroll", function () {
        sy = window.scrollY;
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () { bg.style.setProperty("--sy", sy); ticking = false; });
      }, { passive: true });
    }
  }

  // 3D chart plate: gently floats, and tilts toward the pointer while you hover over it
  var plates = document.querySelectorAll(".north-chart, .south-chart");
  plates.forEach(function (el) { if (!reduce) el.classList.add("is-floating"); });
  var shell = document.querySelector(".chart-shell");
  if (shell && !reduce && window.matchMedia("(hover: hover)").matches) {
    var idle = 0;
    shell.addEventListener("pointermove", function (e) {
      var r = shell.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      plates.forEach(function (el) {
        el.classList.remove("is-floating");
        el.style.setProperty("--ry", (x * 22).toFixed(1) + "deg");
        el.style.setProperty("--rx", (12 - y * 16).toFixed(1) + "deg");
      });
      clearTimeout(idle);
    });
    shell.addEventListener("pointerleave", function () {
      idle = setTimeout(function () {
        plates.forEach(function (el) { el.style.removeProperty("--ry"); el.style.removeProperty("--rx"); el.classList.add("is-floating"); });
      }, 2500);
    });
  }

  // spotlight: expose the pointer position to CSS (--mx / --my) for the panel under the cursor
  if (!reduce && window.matchMedia("(hover: hover)").matches) {
    var raf = 0;
    document.addEventListener("pointermove", function (e) {
      var panel = e.target.closest && e.target.closest(".kx .glass-panel");
      if (!panel || raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        var r = panel.getBoundingClientRect();
        panel.style.setProperty("--mx", (e.clientX - r.left) + "px");
        panel.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    }, { passive: true });
  }

  // after the visitor presses Generate, bring the fresh chart into view (the page also draws a sample chart on load,
  // which must not move the page)
  var out = document.getElementById("kOutput");
  var btn = document.getElementById("generateBtn");
  var want = false;
  function reveal() {
    var target = document.querySelector(".kx-summary") || out;
    if (!target) return;
    var top = target.getBoundingClientRect().top + window.scrollY - 92;
    window.scrollTo({ top: top, behavior: reduce ? "auto" : "smooth" });
  }
  if (btn) {
    btn.addEventListener("click", function () {
      want = true;
      setTimeout(function () { want = false; }, 15000);
    });
  }
  var loading = document.getElementById("kLoading");
  if (loading && "MutationObserver" in window) {
    new MutationObserver(function () {
      if (loading.hidden && want) { want = false; setTimeout(reveal, 150); }
    }).observe(loading, { attributes: true, attributeFilter: ["hidden"] });
  }
})();
