/*!
 * CircularCards: the circular scroll behaviour of the React Bits "Circular Gallery" (https://reactbits.dev/components/circular-gallery,
 * MIT + Commons Clause, David Haz) applied to ordinary HTML cards instead of images. The arc, tilt, wave, edge fade, snapping,
 * drag/swipe/keyboard input, endless loop, intro and open-on-click follow the original; the cards themselves stay live DOM
 * elements, so their text, styles and any effect drawn on them (such as the electric border) keep working. Used as part of this
 * website only; it is not redistributed as a component.
 *
 * Options may include `responsive(width) -> { bend, gap, fadeEdges, openScale }`, re-read on every layout.
 * CircularCards.attach(stage, { selector: ".card", ... }) -> { next(step), close(), refresh(), destroy() }
 * `stage` is a positioned element with a fixed height; its matching children are positioned by this script.
 */
(function (global) {
  "use strict";

  var WORLD_HEIGHT = 16.57;
  var INTRO_SECONDS = 1.4;
  var DEFAULTS = {
    selector: ":scope > *", bend: 3, scrollEase: 0.05, gap: 0.26, wave: 1, fadeEdges: 0.12, scrollSpeed: 2, snap: true,
    openOnClick: true, intro: true, openScale: 1.3, label: "Cards"
  };

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function ease(v) { return v * v * (3 - 2 * v); }
  function smoother(v) { v = clamp(v, 0, 1); return v * v * v * (v * (v * 6 - 15) + 10); }
  function wrap(v, n) { return ((v % n) + n) % n; }

  function attach(stage, options) {
    var s = Object.assign({}, DEFAULTS, options || {});
    var reduce = !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
    var state = {
      scroll: 0, target: 0, velocity: 0, open: 0, openTarget: 0, intro: s.intro && !reduce ? 0 : 1, waveTime: 0,
      drag: null, active: 0, spacing: 1, lastInput: 0
    };
    var cards = [], raf = 0, last = 0, visible = true, alive = true, snapTimer = 0;
    var view = { w: 1, h: 1 };

    stage.classList.add("is-circular");
    stage.setAttribute("role", "region");
    stage.setAttribute("aria-roledescription", "carousel");
    stage.setAttribute("aria-label", s.label);
    stage.tabIndex = 0;

    function collect() {
      cards = Array.prototype.slice.call(stage.querySelectorAll(s.selector));
      cards.forEach(function (c, i) {
        c.setAttribute("role", "group");
        c.setAttribute("aria-roledescription", "slide");
        c.setAttribute("aria-label", (i + 1) + " of " + cards.length);
        c._slot = i;
      });
    }

    function arcOf(x) {
      if (!s.bend) return { y: 0, angle: 0 };
      var depth = (Math.abs(s.bend) * view.h) / WORLD_HEIGHT;
      var half = Math.max(view.w, view.h * 1.9) / 2;
      var radius = (half * half + depth * depth) / (2 * depth);
      var reach = Math.min(Math.abs(x), half, radius * 0.999);
      var arc = radius - Math.sqrt(radius * radius - reach * reach);
      var angle = Math.sign(x) * Math.asin(reach / radius);
      // screen y grows downwards and CSS rotation is clockwise, so both flip against the GL original
      return s.bend > 0 ? { y: arc, angle: angle } : { y: -arc, angle: -angle };
    }

    function nearest() { return Math.round(state.target / Math.max(state.spacing, 1)); }

    function setSlot(slot) {
      state.target = slot * state.spacing;
      state.active = slot;
      wake();
    }

    function layout() {
      var n = cards.length;
      if (!n) return;
      view.w = Math.max(1, stage.clientWidth);
      view.h = Math.max(1, stage.clientHeight);
      if (s.responsive) Object.assign(s, s.responsive(view.w));   // e.g. a tighter, more curved wheel on phones
      var cw = cards[0].offsetWidth || 300, ch = cards[0].offsetHeight || 400;
      var before = state.spacing;
      state.spacing = cw * (1 + s.gap);
      if (before > 1 && Math.abs(state.spacing - before) > 0.5) {
        state.scroll = (state.scroll / before) * state.spacing;
        state.target = (state.target / before) * state.spacing;
      }
      var spacing = state.spacing;
      var introEase = 1 - Math.pow(1 - state.intro, 3);
      var scroll = state.scroll + (1 - introEase) * spacing * 1.6;
      var base = scroll / spacing;
      var activeSlot = nearest();
      var activeIndex = wrap(activeSlot, n);
      var speed = Math.min(Math.abs(state.velocity) / Math.max(spacing * 4, 1), 1);
      var range = view.w / 2 + spacing * 1.2;

      cards.forEach(function (card, i) {
        var k = Math.round((base - i) / n);
        var slot = i + k * n;
        card._slot = slot;
        var x = slot * spacing - scroll;
        var isActive = i === activeIndex;
        if (Math.abs(x) > range) {
          if (card._shown !== false) { card.style.visibility = "hidden"; card.setAttribute("aria-hidden", "true"); card._shown = false; }
          return;
        }
        if (card._shown !== true) { card.style.visibility = "visible"; card.removeAttribute("aria-hidden"); card._shown = true; }
        var arc = arcOf(x);
        var order = Math.abs(slot * spacing - state.scroll) / spacing;
        var shown = ease(clamp(state.intro * 2.2 - order * 0.22, 0, 1));
        // fade by the card's inner edge (the side facing the middle), so a card that is only half in view still shows its half;
        // the track's CSS mask then fades the very edge pixel by pixel
        var inner = Math.sign(x) * Math.max(Math.abs(x) - cw * 0.5, 0);
        var u = (view.w / 2 + inner) / view.w;
        var edge = s.fadeEdges > 0 ? smoother(u / s.fadeEdges) * smoother((1 - u) / s.fadeEdges) : 1;
        var focus = isActive ? ease(state.open) : 0;
        var alpha = shown * edge * (isActive ? 1 : mix(1, 0.14, ease(state.open)));
        var y = mix(arc.y, 0, focus) + (1 - shown) * ch * 0.18;
        var angle = arc.angle * (1 - focus);
        var skew = reduce ? 0 : Math.sin(state.waveTime + i * 0.9) * speed * s.wave * 6;
        card.style.transform = "translate3d(" + mix(x, 0, focus).toFixed(2) + "px," + y.toFixed(2) + "px,0) rotate(" + angle.toFixed(4) + "rad) skewY(" + skew.toFixed(2) + "deg)";
        card.style.opacity = alpha.toFixed(3);
        card.style.zIndex = String(isActive && state.open > 0.02 ? 2000 : 1000 - Math.round(Math.abs(x) / 4));
        card.style.scale = String(1 + (s.openScale - 1) * focus);
        card.style.pointerEvents = alpha < 0.08 ? "none" : "";
        card.tabIndex = isActive ? 0 : -1;
        card.classList.toggle("is-active", isActive);
      });
      state.activeIndex = activeIndex;
    }

    function frame(now) {
      raf = 0;
      if (!alive || !visible || document.hidden) return;
      var dt = last ? clamp((now - last) / 1000, 0.0005, 0.05) : 1 / 60;
      last = now;
      var follow = reduce ? 1 : 1 - Math.pow(1 - s.scrollEase, dt * 60);
      var before = state.scroll;
      state.scroll += (state.target - state.scroll) * follow;
      if (Math.abs(state.target - state.scroll) < 0.05) state.scroll = state.target;
      var velocity = (state.scroll - before) / dt;
      state.velocity += (velocity - state.velocity) * (1 - Math.exp(-dt / 0.08));
      if (Math.abs(state.velocity) < 0.5) state.velocity = 0;
      state.waveTime += dt * 2.4;
      state.open += (state.openTarget - state.open) * (reduce ? 1 : 1 - Math.exp(-dt / 0.14));
      if (Math.abs(state.openTarget - state.open) < 0.001) state.open = state.openTarget;
      if (state.intro < 1) state.intro = Math.min(1, state.intro + dt / INTRO_SECONDS);
      layout();
      var moving = state.scroll !== state.target || state.velocity !== 0 || state.open !== state.openTarget || state.intro < 1;
      if (moving) raf = requestAnimationFrame(frame); else last = 0;
    }
    function wake() { if (!raf && alive && visible && !document.hidden) raf = requestAnimationFrame(frame); }

    function snapNow() { if (s.snap || state.open > 0.5) setSlot(nearest()); }
    function openCard(slot) { setSlot(slot); state.openTarget = 1; stage.classList.add("is-open"); wake(); }
    function close() { state.openTarget = 0; stage.classList.remove("is-open"); wake(); }

    function cardAt(target) {
      var el = target && target.closest ? target.closest(s.selector.replace(":scope > ", "")) : null;
      return el && stage.contains(el) ? el : null;
    }

    function onPointerDown(e) {
      if (e.button !== 0 || e.target.closest("button, a")) return;
      state.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, start: state.target, moved: false, samples: [], card: cardAt(e.target) };
      state.lastInput = performance.now();
      wake();
    }
    function onPointerMove(e) {
      var d = state.drag;
      if (!d || d.id !== e.pointerId) return;
      var dx = e.clientX - d.x0, dy = e.clientY - d.y0;
      if (!d.moved && Math.hypot(dx, dy) > 6) {
        if (Math.abs(dy) > Math.abs(dx) && e.pointerType !== "mouse") { state.drag = null; return; }
        d.moved = true;
        if (stage.setPointerCapture) stage.setPointerCapture(e.pointerId);
        stage.setAttribute("data-dragging", "");
      }
      if (d.moved) {
        state.target = d.start - dx * (s.scrollSpeed / 2);
        d.samples.push({ x: e.clientX, t: performance.now() });
        if (d.samples.length > 6) d.samples.shift();
        wake();
      }
    }
    function onPointerUp(e) {
      var d = state.drag;
      if (!d || d.id !== e.pointerId) return;
      state.drag = null;
      stage.removeAttribute("data-dragging");
      if (stage.hasPointerCapture && stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
      if (d.moved) {
        var sm = d.samples;
        if (sm.length > 1) {
          var a = sm[0], b = sm[sm.length - 1];
          state.target -= ((b.x - a.x) / Math.max(b.t - a.t, 16)) * 1000 * 0.18 * (s.scrollSpeed / 2);
        }
        snapNow();
        return;
      }
      if (!d.card) { if (state.open > 0.5) close(); return; }
      if (!s.openOnClick) { setSlot(d.card._slot); return; }
      if (state.open > 0.5 && d.card._slot === nearest()) close(); else openCard(d.card._slot);
    }
    function onPointerCancel(e) {
      if (state.drag && state.drag.id === e.pointerId) { state.drag = null; stage.removeAttribute("data-dragging"); snapNow(); }
    }
    // Only sideways wheel/trackpad motion (or Shift+wheel) moves the cards; a plain vertical wheel keeps scrolling the page.
    function onWheel(e) {
      var horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!horizontal && !e.shiftKey) return;
      var unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? view.h : 1;
      var delta = horizontal ? e.deltaX : e.deltaY;
      if (!delta) return;
      e.preventDefault();
      state.target += delta * unit * (s.scrollSpeed / 2);
      clearTimeout(snapTimer);
      snapTimer = setTimeout(snapNow, 140);
      wake();
    }
    function onKeyDown(e) {
      var step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (step) { e.preventDefault(); setSlot(nearest() + step); return; }
      if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        var n = cards.length, base = nearest() - wrap(nearest(), n);
        setSlot(e.key === "Home" ? base : base + n - 1);
        return;
      }
      if (e.key === "Escape" && state.openTarget > 0) { e.preventDefault(); close(); return; }
      if ((e.key === "Enter" || e.key === " ") && cardAt(e.target)) { e.preventDefault(); if (state.open > 0.5) close(); else openCard(nearest()); }
    }
    function onVisibility() { last = 0; wake(); }

    var ro = new ResizeObserver(function () { wake(); layout(); });
    ro.observe(stage);
    var io = new IntersectionObserver(function (es) { visible = es.some(function (x) { return x.isIntersecting; }); if (visible) { last = 0; wake(); } });
    io.observe(stage);
    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", onPointerUp);
    stage.addEventListener("pointercancel", onPointerCancel);
    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibility);
    collect();
    layout();
    wake();

    return {
      next: function (step) { setSlot(nearest() + (step || 1)); },
      close: close,
      refresh: function () { collect(); layout(); wake(); },
      destroy: function () {
        alive = false;
        cancelAnimationFrame(raf);
        clearTimeout(snapTimer);
        ro.disconnect();
        io.disconnect();
        stage.removeEventListener("pointerdown", onPointerDown);
        stage.removeEventListener("pointermove", onPointerMove);
        stage.removeEventListener("pointerup", onPointerUp);
        stage.removeEventListener("pointercancel", onPointerCancel);
        stage.removeEventListener("wheel", onWheel);
        stage.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("visibilitychange", onVisibility);
        stage.classList.remove("is-circular", "is-open");
        cards.forEach(function (c) { c.style.cssText = ""; c.classList.remove("is-active"); c.removeAttribute("tabindex"); });
      }
    };
  }

  global.CircularCards = { attach: attach };
})(window);
