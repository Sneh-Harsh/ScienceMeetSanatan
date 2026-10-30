// Home page effects: the laser beam falls through the "Everything in one place" section onto the top of the Book a Pandit card, with a soft glow behind the cards from CSS,
// and the electric border around each Rashifal card.
(function () {
  var zone = document.getElementById("laserZone");

  function boot() {
    var grid = zone && zone.querySelector(".app-grid");
    var lead = grid && grid.querySelector(".app-tile--hero");
    if (lead && window.LaserFlow) {
      var coarse = window.matchMedia("(pointer: coarse)").matches;
      // where across the section the beam falls: the empty right end of the Book a Pandit card on desktop, the middle on phones
      var aim = function () {
        var z = zone.getBoundingClientRect(), c = lead.getBoundingClientRect();
        return z.width ? (c.left - z.left + c.width * (c.width > z.width * 0.9 ? 0.5 : 0.86)) / z.width : 0.5;
      };
      // Front layer: the beam lands on the top edge of the first row and its light spreads out across all of its cards.
      // where the light lands, in px inside the zone: the CSS "water" below spreads out from here
      var setHit = function () {
        var z = zone.getBoundingClientRect(), c = lead.getBoundingClientRect();
        zone.style.setProperty("--beam-x", (aim() * 100).toFixed(2) + "%");
        zone.style.setProperty("--hit-x", (aim() * z.width).toFixed(1) + "px");
        zone.style.setProperty("--hit-y", (c.top - z.top).toFixed(1) + "px");
      };
      setHit();
      // the cards slide in when they scroll into view, so measure again once they have settled
      setTimeout(setHit, 1200); window.addEventListener("resize", setHit);
      var front = window.LaserFlow.attach(zone, {
        canvasClass: "laser-flow-canvas--front",
        // the surface is the whole top row (Book a Pandit, Panchang, Library), so the light runs along the top of all of them
        surfaceBox: function () {
          var z = zone.getBoundingClientRect(), g = grid.getBoundingClientRect(), c = lead.getBoundingClientRect();
          return { left: g.left - z.left, right: g.right - z.left, top: c.top - z.top, bottom: c.bottom - z.top, radius: 22 };
        },
        beamPosition: aim(), color: "#3847ff", intensity: 1.5, flare: 1.3, spread: 3.4, spill: 0.8, fog: 0.2, dust: 1.6,
        beamWidth: 1.5, streaks: 1.5, dots: 1, pulse: 1.5, speed: 1.5, seed: 3, mouseInteraction: !coarse, intro: true,
        dpr: coarse ? 0.75 : 1
      });
      if ("ResizeObserver" in window) {
        new ResizeObserver(function () {
          var x = aim();
          setHit();
          if (front) front.update({ beamPosition: x });
        }).observe(zone);
      }
    }
    startRashiCircle();
    startHeroShards();
  }

  // ---- hero background: AeroShards (replaces the old looping video) ---------------------------------------------------------
  // The real React Bits component (WebGPU, run through a small hooks shim) is used where the browser supports WebGPU; the WebGL2
  // look-alike in aero-shards.js takes over everywhere else, and if the GPU version reports an error.
  var SHARD_PROPS = {
    shardColor: "#896ABD", accentColor: "#A855F7", placement: "full", material: "glass", markers: "sacred", count: 1300,
    depthOfField: 0.75, vignette: 0.3, mouseInteraction: true, pulseOnClick: true, holdToGather: true, lightMode: false,
    shardSize: 1, spread: 1, twist: 1, billow: 1, speed: 1, scale: 1, glow: 0.35, grain: 0.06, intro: true, mouseStrength: 0.6,
    parallax: 0.5, paused: false
  };

  function startHeroShards() {
    var art = document.getElementById("heroArt");
    var hero = art && art.closest(".hero-observatory");
    if (!art) return;
    var fallback = function () {
      if (!window.AeroShards || art.classList.contains("has-fallback")) return;
      var f = window.AeroShards.attach(art, Object.assign({ eventTarget: hero || art }, SHARD_PROPS));
      if (f) art.classList.add("has-shards", "has-fallback");
    };
    var tryGpu = function () {
      if (!window.AeroShardsGPU || !("gpu" in navigator)) { fallback(); return; }
      var mounted = null;
      mounted = window.AeroShardsGPU.mount(art, Object.assign({}, SHARD_PROPS, {
        onError: function (err) {
          if (window.console) console.warn("AeroShards (WebGPU) failed, using the WebGL version:", err && err.message);
          if (mounted) { mounted.destroy(); mounted = null; }
          art.classList.remove("has-shards");
          fallback();
        }
      }));
      art.classList.add("has-shards");
    };
    if (window.AeroShardsGPU || !document.querySelector('script[type="module"][src*="aero-shards-gpu"]')) tryGpu();
    else window.addEventListener("aeroshards-ready", tryGpu, { once: true });
    setTimeout(function () { if (!window.AeroShardsGPU && !art.classList.contains("has-shards")) fallback(); }, 4000);
  }

  // ---- Today's Rashifal: the real cards on a circular scroll, each with a live electric border ------------------------------
  // welcome.js renders the twelve cards into #raashiTrack (and re-renders them when fresh data arrives). CircularCards puts them
  // on the arc; ElectricBorder watches the track and draws its border on every card, old or new.
  var circle = null;

  function startRashiCircle() {
    var track = document.getElementById("raashiTrack");
    var stage = document.getElementById("raashiStage");
    if (!track || !stage) return;

    if (window.ElectricBorder) {
      window.ElectricBorder.watch(track, ".raashi-card", {
        color: "#7df9ff", speed: 1, chaos: 0.5, spread: 0.6, strands: 3, thickness: 1.5, borderRadius: 24
      });
    }

    var setup = function () {
      if (!window.CircularCards || !track.querySelector(".raashi-card")) return;
      if (circle) { circle.refresh(); return; }
      circle = window.CircularCards.attach(track, {
        selector: ":scope > .raashi-card", label: "Today’s rashifal for the twelve rashis",
        bend: 3, scrollEase: 0.05, gap: 0.26, wave: 1, fadeEdges: 0.12, scrollSpeed: 2, snap: true, openOnClick: true, intro: true,
        // on a phone the cards are narrower and curve more, so a slice of the neighbour on each side shows and it reads as a wheel, without the cards overlapping
        responsive: function (w) {
          return w < 700 ? { bend: 5, gap: 0.12, fadeEdges: 0.04, openScale: 1.4 } : { bend: 3, gap: 0.26, fadeEdges: 0.12, openScale: 1.3 };
        }
      });
      if (!circle) return;
      stage.classList.add("has-circle");
      stage.querySelectorAll("[data-circle-nav], .raashi-hint").forEach(function (n) { n.hidden = false; });
      stage.querySelectorAll("[data-circle-nav]").forEach(function (b) {
        b.addEventListener("click", function () { circle.next(b.classList.contains("raashi-nav--prev") ? -1 : 1); });
      });
    };
    if ("MutationObserver" in window) new MutationObserver(function () { setTimeout(setup, 30); }).observe(track, { childList: true });
    setup();
  }

  if (document.readyState === "complete") boot(); else window.addEventListener("load", boot);
})();
