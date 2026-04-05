const header = document.querySelector(".header");
const heroArt = document.querySelector("#heroArt");
const heroImage = document.querySelector("#heroImage");

const updateHeaderState = () => {
  if (!header) return;
  header.classList.toggle("scrolled", window.scrollY > 8);
};

window.addEventListener("scroll", updateHeaderState, { passive: true });
updateHeaderState();

const setHeroParallax = (clientX, clientY) => {
  if (!heroArt || !heroImage) return;
  const rect = heroArt.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = ((clientX - rect.left) / rect.width - 0.5) * 18;
  const y = ((clientY - rect.top) / rect.height - 0.5) * 18;
  heroImage.style.setProperty("--hero-x", `${x.toFixed(2)}px`);
  heroImage.style.setProperty("--hero-y", `${y.toFixed(2)}px`);
};

heroArt?.addEventListener("pointermove", (event) => {
  setHeroParallax(event.clientX, event.clientY);
});

heroArt?.addEventListener("pointerleave", () => {
  if (!heroImage) return;
  heroImage.style.setProperty("--hero-x", "0px");
  heroImage.style.setProperty("--hero-y", "0px");
});
