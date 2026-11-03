// Home page effects: the laser beam falls through the "Everything in one place" section onto the top of the Book a Pandit card, with a soft glow behind the cards from CSS,
// and the electric border around each Rashifal card.
(function () {
  var zone = document.getElementById("laserZone");

  // Heavy effects are separate files that are fetched and started only when their section is about to be seen, so the first
  // screen is not competing with effects that are still far down the page. File URLs come from the page (fx-assets).
  var ASSETS = {};
  try { ASSETS = JSON.parse(document.getElementById("fx-assets").textContent); } catch (e) { /* the page still works without them */ }
  var loading = {};
  function loadScript(key) {
    if (!ASSETS[key]) return Promise.reject(new Error("missing asset " + key));
    if (!loading[key]) {
      loading[key] = new Promise(function (resolve, reject) {
        var tag = document.createElement("script");
        tag.src = ASSETS[key];
        tag.async = true;
        tag.onload = resolve;
        tag.onerror = reject;
        document.head.appendChild(tag);
      });
    }
    return loading[key];
  }
  function whenNear(el, margin, fn) {
    if (!el) return;
    if (!("IntersectionObserver" in window)) { fn(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); fn(); }
    }, { rootMargin: margin });
    io.observe(el);
  }
  var coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  var conn = navigator.connection || {};
  var saveData = !!conn.saveData;
  var weakDevice = saveData || (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

  function startLaser() {
    var grid = zone && zone.querySelector(".app-grid");
    var lead = grid && grid.querySelector(".app-tile--hero");
    if (lead && window.LaserFlow) {
      var coarse = coarsePointer;
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
        dpr: coarse ? 0.6 : weakDevice ? 0.8 : 1, maxFps: coarse || weakDevice ? 30 : 60
      });
      if ("ResizeObserver" in window) {
        new ResizeObserver(function () {
          var x = aim();
          setHit();
          if (front) front.update({ beamPosition: x });
        }).observe(zone);
      }
    }
  }

  function boot() {
    // laser beam: only once the feature section is within a screen or so of the viewport
    if (zone && !(saveData && coarsePointer)) whenNear(zone, "900px 0px", function () { loadScript("laser").then(startLaser).catch(function () {}); });
    // rashifal carousel + its electric borders
    whenNear(document.getElementById("raashiStage"), "700px 0px", function () {
      Promise.all([loadScript("electric"), loadScript("circular")]).then(startRashiCircle).catch(function () {});
    });
  }

  // ---- hero background: AeroShards (replaces the old looping video) ---------------------------------------------------------
  // The real React Bits component (WebGPU, run through a small hooks shim) is used where the browser supports WebGPU; the WebGL2
  // look-alike in aero-shards.js takes over everywhere else, and if the GPU version reports an error.
  var small = window.innerWidth < 700;
  var SHARD_PROPS = {
    shardColor: "#896ABD", accentColor: "#A855F7", placement: "full", material: "glass", markers: "sacred",
    count: weakDevice ? 380 : small ? 560 : 1000,
    depthOfField: 0.75, vignette: 0.3, mouseInteraction: !coarsePointer, pulseOnClick: true, holdToGather: true, lightMode: false,
    shardSize: 1, spread: 1, twist: 1, billow: 1, speed: 1, scale: 1, glow: 0.35, grain: 0.06, intro: true, mouseStrength: 0.6,
    parallax: coarsePointer ? 0 : 0.5, paused: false,
    dpr: small || weakDevice ? 1.25 : 1.5
  };

  function startHeroShards() {
    var art = document.getElementById("heroArt");
    var hero = art && art.closest(".hero-observatory");
    if (!art || saveData) return;       // data-saver: the still picture behind the hero is enough
    // the page already shows a poster of this scene, so the live version simply fades in over it once it has drawn
    var reveal = function () { setTimeout(function () { art.classList.add("shards-ready"); }, 900); };
    var fallback = function () {
      if (art.classList.contains("has-fallback")) return;
      loadScript("shardsFallback").then(function () {
        var f = window.AeroShards && window.AeroShards.attach(art, Object.assign({ eventTarget: hero || art }, SHARD_PROPS));
        if (f) { art.classList.add("has-shards", "has-fallback"); reveal(); }
      }).catch(function () {});
    };
    var tryGpu = function () {
      if (!window.AeroShardsGPU || !("gpu" in navigator)) { fallback(); return; }
      var mounted = null;
      mounted = window.AeroShardsGPU.mount(art, Object.assign({}, SHARD_PROPS, {
        onError: function (err) {
          if (window.console) console.warn("AeroShards (WebGPU) failed, using the WebGL version:", err && err.message);
          if (mounted) { mounted.destroy(); mounted = null; }
          art.classList.remove("has-shards", "shards-ready");
          fallback();
        }
      }));
      art.classList.add("has-shards");
      reveal();
    };
    if (window.AeroShardsGPU) tryGpu();
    else if (!("gpu" in navigator) || !ASSETS.gpuModule) fallback();
    else {
      // loaded with import() so that it never holds up the page's own start-up; the file was already fetched by modulepreload
      import(ASSETS.gpuModule).then(tryGpu).catch(fallback);
    }
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
        bend: 3, scrollEase: 0.13, gap: 0.26, wave: 1, fadeEdges: 0.12, scrollSpeed: 2, snap: true, openOnClick: true, intro: true,
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

  startHeroShards();     // right away: the poster is already on screen, so there is no reason to wait for the load event
  if (document.readyState === "complete") boot(); else window.addEventListener("load", boot);
})();
