const deityGrid = document.querySelector("#deityGrid");
const toggleButtons = document.querySelectorAll(".toggle-btn");
const namesDataEl = document.querySelector("#babyNamesData");

let currentGender = "girl";

let babyNamesData = {};
if(namesDataEl){
try{
babyNamesData = JSON.parse(namesDataEl.textContent || "{}");
}catch{
babyNamesData = {};
}
}

const deityCards = [
{
deity:"Lord Shiva",
video:"/static/baby_names_assets/shiva.mp4",
fallback:{girl:"Shivani",boy:"Shivansh"}
},
{
deity:"Lord Vishnu",
video:"/static/baby_names_assets/vishnu.mp4",
fallback:{girl:"Vaishnavi",boy:"Vihaan"}
},
{
deity:"Maa Durga",
video:"/static/baby_names_assets/durga.mp4",
fallback:{girl:"Durga",boy:"Aditya"}
},
{
deity:"Lord Ganesha",
video:"/static/baby_names_assets/ganesha.mp4",
fallback:{girl:"Ganishka",boy:"Ganesh"}
},
{
deity:"Lord Ram",
video:"/static/baby_names_assets/ram.mp4",
fallback:{girl:"Ramya",boy:"Ramit"}
},
{
deity:"Lord Hanuman",
video:"/static/baby_names_assets/hanuman.mp4",
fallback:{girl:"Anjani",boy:"Hanumant"}
},
{
deity:"Lord Krishna",
video:"/static/baby_names_assets/krishna.mp4",
fallback:{girl:"Krishika",boy:"Krish"}
},
{
deity:"Maa Saraswati",
video:"/static/baby_names_assets/saraswati.mp4",
fallback:{girl:"Saras",boy:"Vedant"}
},
{
deity:"Maa Laxmi",
video:"/static/baby_names_assets/laxmi.mp4",
fallback:{girl:"Lakshita",boy:"Laksh"}
}
];

const ALPHABETS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function getDeityLetterMap(deityName, gender){
return babyNamesData?.[gender]?.[deityName] || {};
}

function getDeityKey(deity){
return deity?.sheet || deity?.deity || "";
}

function getFeaturedName(deity, gender){
const letterMap = getDeityLetterMap(getDeityKey(deity), gender);
const preferred = letterMap?.A;
if(Array.isArray(preferred) && preferred.length) return preferred[0].name;

for(const letter of ALPHABETS){
const list = letterMap?.[letter];
if(Array.isArray(list) && list.length) return list[0].name;
}

return deity.fallback?.[gender] || "—";
}

function renderCards(){

if(!deityGrid) return;

deityGrid.innerHTML="";

deityCards.forEach((deity, index)=>{

const pickedName = getFeaturedName(deity, currentGender);

const cardElement = document.createElement("article");

cardElement.className="deity-card";
cardElement.dataset.deityIndex = String(index);

cardElement.innerHTML=`

<video src="${deity.video}" muted loop playsinline></video>

<div class="card-label">
<h3>${deity.deity}</h3>
<p>${pickedName}</p>
</div>

`;

const video = cardElement.querySelector("video");

cardElement.addEventListener("mouseenter",()=>{
video.play();
});

cardElement.addEventListener("mouseleave",()=>{
video.pause();
video.currentTime=0;
});

cardElement.addEventListener("click",()=>{
openDeityModal(index);
});

deityGrid.appendChild(cardElement);

});

}

function buildDeityModal(){
if(document.querySelector("#deityModal")) return;

const modal = document.createElement("div");
modal.id = "deityModal";
modal.className = "deity-modal";
modal.setAttribute("aria-hidden","true");

modal.innerHTML = `
  <div class="deity-modal__backdrop" data-close="1"></div>
  <div class="deity-modal__panel" role="dialog" aria-modal="true" aria-label="Deity baby names">
    <video class="deity-modal__bgvideo" muted loop playsinline></video>
    <div class="deity-modal__shade" aria-hidden="true"></div>
    <button class="deity-modal__close" type="button" aria-label="Close" data-close="1">✕</button>
    <div class="deity-modal__content">
      <div class="deity-modal__hero">
        <div class="deity-modal__hero-overlay">
          <h2 class="deity-modal__title"></h2>
          <div class="gender-toggle deity-modal__toggle">
            <button class="toggle-btn" type="button" data-gender="girl">Girl Names</button>
            <button class="toggle-btn" type="button" data-gender="boy">Boy Names</button>
          </div>
        </div>
      </div>
      <div class="deity-modal__alpha" aria-label="Filter by starting letter"></div>
      <div class="deity-modal__list-wrap">
        <ul class="deity-modal__list"></ul>
        <p class="deity-modal__empty" hidden>No names found for this letter.</p>
      </div>
    </div>
  </div>
`;

document.body.appendChild(modal);

modal.addEventListener("click",(event)=>{
const target = event.target;
if(!(target instanceof HTMLElement)) return;
if(target.dataset.close) closeDeityModal();
});

modal.addEventListener("click",(event)=>{
const target = event.target;
if(!(target instanceof HTMLElement)) return;
const btn = target.closest(".name-card__reveal");
if(!btn) return;
event.preventDefault();
event.stopPropagation();
const card = btn.closest(".name-card");
if(!card) return;
const willReveal = !card.classList.contains("is-revealed");
card.classList.toggle("is-revealed", willReveal);
btn.setAttribute("aria-expanded", willReveal ? "true" : "false");
});

document.addEventListener("keydown",(event)=>{
if(event.key !== "Escape") return;
const isOpen = document.body.classList.contains("deity-modal-open");
if(isOpen) closeDeityModal();
});
}

let openDeityIndex = null;
let modalGender = "girl";
let selectedLetter = "A";

function openDeityModal(index){
buildDeityModal();

const deity = deityCards[index];
if(!deity) return;

openDeityIndex = index;
modalGender = currentGender;
selectedLetter = "A";

const modal = document.querySelector("#deityModal");
const panel = modal.querySelector(".deity-modal__panel");

// Set FLIP start rect from clicked card
const sourceCard = document.querySelector(`.deity-card[data-deity-index="${index}"]`);
if(sourceCard){
const rect = sourceCard.getBoundingClientRect();
panel.style.top = `${rect.top}px`;
panel.style.left = `${rect.left}px`;
panel.style.width = `${rect.width}px`;
panel.style.height = `${rect.height}px`;
panel.style.borderRadius = "14px";
}

modal.setAttribute("aria-hidden","false");
document.body.classList.add("deity-modal-open");

hydrateModal(deity);

// Next frame: expand
requestAnimationFrame(()=>{
modal.classList.add("is-open");
panel.classList.add("is-expanded");
panel.style.top = "0px";
panel.style.left = "0px";
panel.style.width = "100vw";
panel.style.height = "100vh";
panel.style.borderRadius = "0px";
});
}

function closeDeityModal(){
const modal = document.querySelector("#deityModal");
if(!modal) return;
const panel = modal.querySelector(".deity-modal__panel");
const video = modal.querySelector(".deity-modal__bgvideo");

modal.classList.remove("is-open");
panel.classList.remove("is-expanded");
if(video) video.pause();

// Animate back to source card if present
if(openDeityIndex !== null){
const sourceCard = document.querySelector(`.deity-card[data-deity-index="${openDeityIndex}"]`);
if(sourceCard){
const rect = sourceCard.getBoundingClientRect();
panel.style.top = `${rect.top}px`;
panel.style.left = `${rect.left}px`;
panel.style.width = `${rect.width}px`;
panel.style.height = `${rect.height}px`;
panel.style.borderRadius = "14px";
}
}

window.setTimeout(()=>{
modal.setAttribute("aria-hidden","true");
document.body.classList.remove("deity-modal-open");
openDeityIndex = null;
}, 420);
}

function hydrateModal(deity){
const modal = document.querySelector("#deityModal");
if(!modal) return;

const title = modal.querySelector(".deity-modal__title");
const video = modal.querySelector(".deity-modal__bgvideo");
const alphaWrap = modal.querySelector(".deity-modal__alpha");
const list = modal.querySelector(".deity-modal__list");
const empty = modal.querySelector(".deity-modal__empty");

title.textContent = deity.deity;
video.src = deity.video;
video.currentTime = 0;
video.play().catch(()=>{});

// Toggle buttons inside modal
const modalToggles = modal.querySelectorAll(".deity-modal__toggle .toggle-btn");
modalToggles.forEach((btn)=>{
btn.classList.toggle("active", btn.dataset.gender === modalGender);
btn.onclick = ()=>{
modalGender = btn.dataset.gender;
modalToggles.forEach((b)=>b.classList.toggle("active", b.dataset.gender === modalGender));
selectedLetter = "A";
renderAlpha(alphaWrap);
renderNamesList(list, empty, deity);
};
});

renderAlpha(alphaWrap);
renderNamesList(list, empty, deity);

const closeBtn = modal.querySelector(".deity-modal__close");
if(closeBtn) closeBtn.focus();
}

function renderAlpha(alphaWrap){
alphaWrap.innerHTML = "";
const deity = openDeityIndex === null ? null : deityCards[openDeityIndex];
const letterMap = deity ? getDeityLetterMap(getDeityKey(deity), modalGender) : {};
ALPHABETS.forEach((letter)=>{
const btn = document.createElement("button");
btn.type = "button";
btn.className = "alpha-btn";
btn.textContent = letter;
btn.setAttribute("aria-pressed", letter === selectedLetter ? "true" : "false");
btn.classList.toggle("active", letter === selectedLetter);
const hasNames = Array.isArray(letterMap?.[letter]) && letterMap[letter].length > 0;
btn.classList.toggle("is-empty", !hasNames);
btn.addEventListener("click",()=>{
selectedLetter = letter;
renderAlpha(alphaWrap);
const deity = openDeityIndex === null ? null : deityCards[openDeityIndex];
if(!deity) return;
const modal = document.querySelector("#deityModal");
const list = modal.querySelector(".deity-modal__list");
const empty = modal.querySelector(".deity-modal__empty");
renderNamesList(list, empty, deity);
});
alphaWrap.appendChild(btn);
});
}

function renderNamesList(list, empty, deity){
const letterMap = getDeityLetterMap(getDeityKey(deity), modalGender);
const filtered = Array.isArray(letterMap?.[selectedLetter]) ? letterMap[selectedLetter] : [];

list.innerHTML = "";

if(filtered.length === 0){
empty.hidden = false;
return;
}

empty.hidden = true;
filtered.forEach((item)=>{
const li = document.createElement("li");
li.className = "name-row";
li.innerHTML = `
  <div class="name-card" role="group">
    <div class="name-card__name">
      <div class="baby-name">${item.name}</div>
    </div>
    <div class="name-card__meaning">
      <div class="baby-meaning">${item.meaning || ""}</div>
    </div>
    <button class="name-card__reveal" type="button" aria-label="Reveal meaning" aria-expanded="false">i</button>
  </div>
`;
list.appendChild(li);
});
}

toggleButtons.forEach((btn)=>{

btn.addEventListener("click",()=>{

currentGender = btn.dataset.gender;

toggleButtons.forEach((b)=>{
b.classList.remove("active");
});

btn.classList.add("active");

renderCards();

});

});

renderCards();
