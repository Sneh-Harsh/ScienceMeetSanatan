/*!
 * Glass Surface: vanilla JavaScript adaptation for the Pandit navbar and Booking page.
 *
 * Adapted from the React Bits "Glass Surface" component (https://reactbits.dev/components/glass-surface),
 * Copyright (c) 2026 David Haz, MIT + Commons Clause License Condition v1.0
 * (https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md).
 *
 * This website is not a React application, so the SVG-displacement ("refractive") rendering path and the
 * frosted-glass fallback of the original are re-implemented here without React. The WebGL2 renderer and the
 * `shape` outline mode of the original are intentionally not ported. The code is used as part of this
 * website only and is not redistributed as a component.
 *
 * Usage: SmsGlassSurface.attach(element, { borderRadius: 28, ... }) -> { destroy() }
 * The element receives the classes `sms-glass` and `sms-glass--svg` (refractive) or `sms-glass--fallback`
 * (frosted). Styling for the navbar lives in header.css.
 */
(function (global) {
  "use strict";

  var DEFAULTS = {
    borderRadius: 28,
    borderWidth: 0.07,
    brightness: 50,
    opacity: 0.93,
    blur: 11,
    displace: 0.5,
    saturation: 1.15,
    distortionScale: -120,
    redOffset: 0,
    greenOffset: 10,
    blueOffset: 20,
    xChannel: "R",
    yChannel: "G",
    mixBlendMode: "difference",
    backgroundOpacity: 0,
    svg: true
  };

  var counter = 0;

  function supportsSvgBackdrop(filterId) {
    var ua = navigator.userAgent;
    var isWebkit = /Safari/.test(ua) && !/Chrome/.test(ua) && !/Chromium/.test(ua);
    var isFirefox = /Firefox/.test(ua);
    if (isWebkit || isFirefox) return false;
    var probe = document.createElement("div");
    probe.style.backdropFilter = "url(#" + filterId + ")";
    return probe.style.backdropFilter !== "";
  }

  function displacementMap(el, o, ids) {
    var rect = el.getBoundingClientRect();
    var w = rect.width || 400;
    var h = rect.height || 200;
    var edge = Math.min(w, h) * (o.borderWidth * 0.5);
    var svg =
      '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" +
      '<linearGradient id="' + ids.red + '" x1="100%" y1="0%" x2="0%" y2="0%"><stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="red"/></linearGradient>' +
      '<linearGradient id="' + ids.blue + '" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="blue"/></linearGradient>' +
      '<filter id="' + ids.soft + '" filterUnits="userSpaceOnUse" x="0" y="0" width="' + w + '" height="' + h + '" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="' + o.blur + '" /></filter>' +
      "</defs>" +
      '<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="black"></rect>' +
      '<rect x="0" y="0" width="' + w + '" height="' + h + '" rx="' + o.borderRadius + '" fill="url(#' + ids.red + ')" />' +
      '<rect x="0" y="0" width="' + w + '" height="' + h + '" rx="' + o.borderRadius + '" fill="url(#' + ids.blue + ')" style="mix-blend-mode: ' + o.mixBlendMode + '" />' +
      '<rect x="' + edge + '" y="' + edge + '" width="' + (w - edge * 2) + '" height="' + (h - edge * 2) + '" rx="' + o.borderRadius + '" fill="hsl(0 0% ' + o.brightness + "% / " + o.opacity + ')" filter="url(#' + ids.soft + ')" />' +
      "</svg>";
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  function buildFilter(id) {
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "sms-glass__filter");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.innerHTML =
      '<defs><filter id="' + id + '" color-interpolation-filters="sRGB" x="0%" y="0%" width="100%" height="100%">' +
      '<feImage x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="map" id="' + id + '-r" result="dispRed"/>' +
      '<feColorMatrix in="dispRed" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="map" id="' + id + '-g" result="dispGreen"/>' +
      '<feColorMatrix in="dispGreen" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="map" id="' + id + '-b" result="dispBlue"/>' +
      '<feColorMatrix in="dispBlue" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue"/>' +
      '<feBlend in="red" in2="green" mode="screen" result="rg"/>' +
      '<feBlend in="rg" in2="blue" mode="screen" result="output"/>' +
      '<feGaussianBlur in="output" stdDeviation="0.7" id="' + id + '-blur"/>' +
      "</filter></defs>";
    return svg;
  }

  function attach(el, options) {
    if (!el) return { destroy: function () {} };
    var o = Object.assign({}, DEFAULTS, options || {});
    var uid = "sms-glass-" + ++counter;
    var ids = { filter: uid, red: uid + "-red", blue: uid + "-blue", soft: uid + "-soft" };
    var refractive = o.svg !== false && supportsSvgBackdrop(uid);

    el.classList.add("sms-glass", refractive ? "sms-glass--svg" : "sms-glass--fallback");
    el.style.setProperty("--sms-glass-radius", o.borderRadius + "px");
    el.style.setProperty("--sms-glass-saturation", String(o.saturation));
    el.style.setProperty("--sms-glass-filter", "url(#" + uid + ")");
    el.style.setProperty("--sms-glass-bg", String(o.backgroundOpacity));

    var filterSvg = null;
    var sheen = document.createElement("span");
    sheen.className = "sms-glass__sheen";
    sheen.setAttribute("aria-hidden", "true");
    var rim = document.createElement("span");
    rim.className = "sms-glass__rim";
    rim.setAttribute("aria-hidden", "true");
    el.insertBefore(rim, el.firstChild);
    el.insertBefore(sheen, el.firstChild);

    var observer = null;
    function update() {
      if (!filterSvg) return;
      var feImage = filterSvg.querySelector("feImage");
      feImage.setAttribute("href", displacementMap(el, o, ids));
    }

    if (refractive) {
      filterSvg = buildFilter(uid);
      el.insertBefore(filterSvg, el.firstChild);
      [["r", o.redOffset], ["g", o.greenOffset], ["b", o.blueOffset]].forEach(function (pair) {
        var node = filterSvg.querySelector("#" + uid + "-" + pair[0]);
        node.setAttribute("scale", String(o.distortionScale + pair[1]));
        node.setAttribute("xChannelSelector", o.xChannel);
        node.setAttribute("yChannelSelector", o.yChannel);
      });
      filterSvg.querySelector("#" + uid + "-blur").setAttribute("stdDeviation", String(o.displace));
      update();
      if ("ResizeObserver" in window) {
        observer = new ResizeObserver(function () { update(); });
        observer.observe(el);
      } else {
        window.addEventListener("resize", update);
      }
    }

    return {
      refractive: refractive,
      destroy: function () {
        if (observer) observer.disconnect();
        else window.removeEventListener("resize", update);
        if (filterSvg && filterSvg.parentNode) filterSvg.parentNode.removeChild(filterSvg);
        if (sheen.parentNode) sheen.parentNode.removeChild(sheen);
        if (rim.parentNode) rim.parentNode.removeChild(rim);
        el.classList.remove("sms-glass", "sms-glass--svg", "sms-glass--fallback");
      }
    };
  }

  global.SmsGlassSurface = { attach: attach };
})(window);
