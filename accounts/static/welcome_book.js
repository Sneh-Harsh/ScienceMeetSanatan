/* Adds the specular highlight to the homepage "Book a Pandit" button. The link works without it. */
(function () {
  "use strict";
  var el = document.getElementById("heroBookPandit");
  if (!el || !window.PsbSpecularButton) return;
  var phone = window.matchMedia && window.matchMedia("(max-width: 639px)").matches;
  try {
    window.PsbSpecularButton.attach(el, { size: "md", radius: phone ? 16 : 999, lineColor: "#fff3d6", baseColor: "#8a5a1f", textColor: "#1b1408", intensity: 1, idleIntensity: 0.5, shineSize: 12, shineFade: 40, thickness: 1.4, proximity: 240 });
  } catch (e) { /* plain link remains */ }
})();
