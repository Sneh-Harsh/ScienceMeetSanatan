/* Homepage app-style tab bar: "More" opens the existing menu; the Home tab highlights; links stay plain links. */
(function () {
  "use strict";
  var more = document.getElementById("appTabMore");
  var header = document.querySelector(".header");
  if (more && header) {
    more.addEventListener("click", function () {
      var btn = header.querySelector(".mobile-menu-btn");
      if (btn) btn.click();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
  // Pause the hero background video while it is off screen (saves battery and keeps scrolling smooth).
  var video = document.getElementById("heroVideo");
  if (video && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { var p = video.play(); if (p && p.catch) p.catch(function () {}); } else video.pause();
      });
    }, { threshold: 0 }).observe(video);
  }
})();
