const deityGrid = document.querySelector("#deityGrid");
const seg = document.querySelector(".bn-seg");
const toggleButtons = document.querySelectorAll(".bn-seg .toggle-btn");
const namesDataEl = document.querySelector("#babyNamesData");
const searchInput = document.querySelector("#bnSearch");
const searchClear = document.querySelector("#bnSearchClear");
const resultsSec = document.querySelector("#bnResults");
const resultsList = document.querySelector("#bnResultsList");
const resultsEmpty = document.querySelector("#bnResultsEmpty");
const resultsTitle = document.querySelector("#bnResultsTitle");
const browseSec = document.querySelector("#bnBrowse");
const savedBtn = document.querySelector("#bnSavedBtn");
const savedCount = document.querySelector("#bnSavedCount");

let currentGender = "girl";

let babyNamesData = {};
if(namesDataEl){
  try{ babyNamesData = JSON.parse(namesDataEl.textContent || "{}"); }catch{ babyNamesData = {}; }
}

const deityCards = [
{
deity:"Lord Shiva",
video:"https://res.cloudinary.com/dmnm8z8dc/video/upload/v1775370750/shiva_hzppal.mov",
fallback:{girl:"Shivani",boy:"Shivansh"}
},
{
deity:"Lord Vishnu",
video:"https://res.cloudinary.com/dmnm8z8dc/video/upload/v1775370751/vishnu_v8bq73.mov",
fallback:{girl:"Vaishnavi",boy:"Vihaan"}
},
{
deity:"Maa Durga",
video:"https://res.cloudinary.com/dmnm8z8dc/video/upload/v1775370745/durga_w8yixb.mov",
fallback:{girl:"Durga",boy:"Aditya"}
},
{
deity:"Lord Ganesha",
video:"https://res.cloudinary.com/dmnm8z8dc/video/upload/v1775370745/ganesha_uvxv3l.mov",
fallback:{girl:"Ganishka",boy:"Ganesh"}
},
{
deity:"Lord Ram",
video:"https://res.cloudinary.com/dmnm8z8dc/video/upload/v1775370750/ram_syoolb.mov",
fallback:{girl:"Ramya",boy:"Ramit"}
},
{
deity:"Lord Hanuman",
video:"https://res.cloudinary.com/dmnm8z8dc/video/upload/v1775370748/hanuman_pri6tb.mov",
fallback:{girl:"Anjani",boy:"Hanumant"}
},
{
deity:"Lord Krishna",
video:"https://res.cloudinary.com/dmnm8z8dc/video/upload/v1775370798/krishna_i5av0s.mp4",
fallback:{girl:"Krishika",boy:"Krish"}
},
{
deity:"Maa Saraswati",
video:"https://res.cloudinary.com/dmnm8z8dc/video/upload/v1775370752/saraswati_ccr76j.mov",
fallback:{girl:"Saras",boy:"Vedant"}
},
{
deity:"Maa Laxmi",
video:"https://res.cloudinary.com/dmnm8z8dc/video/upload/v1775370745/laxmi_oh9o9t.mov",
fallback:{girl:"Lakshita",boy:"Laksh"}
}
];

const ALPHABETS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function esc(v){
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function getDeityKey(deity){ return deity?.sheet || deity?.deity || ""; }
function getDeityLetterMap(deityName, gender){ return babyNamesData?.[gender]?.[deityName] || {}; }
function namesOf(deity, gender){
  const map = getDeityLetterMap(getDeityKey(deity), gender);
  return ALPHABETS.flatMap((l)=> (map[l] || []));
}
function getFeaturedName(deity, gender){
  const list = namesOf(deity, gender);
  return list.length ? list[0].name : (deity.fallback?.[gender] || "");
}

/* Cloudinary serves a smaller encode / still frame on request, so phones aren't sent 8 MB clips. */
const IS_PHONE = window.matchMedia("(max-width: 760px)").matches;
const SAVE_DATA = !!(navigator.connection && (navigator.connection.saveData || /(^|-)2g$/.test(String(navigator.connection.effectiveType || ""))));

function cdnVideo(url, transform){
  return String(url).replace("/video/upload/", `/video/upload/${transform}/`).replace(/\.(mov|mp4)$/i, ".mp4");
}

function cardVideoUrl(url){
  return IS_PHONE ? cdnVideo(url, "f_mp4,vc_h264,q_auto:low,w_540,br_600k") : url;
}

function modalVideoUrl(url){
  return IS_PHONE ? cdnVideo(url, "f_mp4,vc_h264,q_auto:low,w_720,br_900k") : url;
}

function videoPoster(url){
  return String(url).replace("/video/upload/", "/video/upload/so_0,w_480,q_auto,f_jpg/").replace(/\.(mov|mp4)$/i, ".jpg");
}


const cardVideoObserver = ("IntersectionObserver" in window)
  ? new IntersectionObserver((entries)=>{
      entries.forEach((entry)=>{
        const video = entry.target;
        if(entry.isIntersecting){
          if(!video.getAttribute("src") && !SAVE_DATA) video.src = video.dataset.src;
          if(video.getAttribute("src")) video.play().catch(()=>{});
        } else if(video.getAttribute("src")){
          video.pause();
        }
      });
    }, { rootMargin:"150px 0px" })
  : null;

/* ------------------------------ saved names ------------------------------ */
const SAVED_KEY = "sms_saved_baby_names";
let saved = [];
try{ saved = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); if(!Array.isArray(saved)) saved = []; }catch{ saved = []; }
function persistSaved(){ try{ localStorage.setItem(SAVED_KEY, JSON.stringify(saved)); }catch{} }
function savedKey(g, d, n){ return `${g}|${d}|${n}`; }
function isSaved(g, d, n){ return saved.some((s)=> savedKey(s.g, s.d, s.n) === savedKey(g, d, n)); }
function updateSavedCount(pop){
  savedCount.textContent = String(saved.length);
  if(pop){ savedBtn.classList.remove("pop"); void savedBtn.offsetWidth; savedBtn.classList.add("pop"); }
}
function toggleSaved(g, d, n, m){
  const k = savedKey(g, d, n);
  const i = saved.findIndex((s)=> savedKey(s.g, s.d, s.n) === k);
  if(i >= 0) saved.splice(i, 1); else saved.push({ g, d, n, m });
  persistSaved();
  updateSavedCount(i < 0);
  return i < 0;
}

let toastTimer;
function toast(msg){
  let el = document.querySelector(".bn-toast");
  if(!el){ el = document.createElement("div"); el.className = "bn-toast"; el.setAttribute("role","status"); document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> el.classList.remove("show"), 1800);
}

const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.500-4.700-9.500-9.300C1.200 8.500 3 5 6.400 5c2 0 3.400 1.100 4.100 2.300h3C14.200 6.100 15.600 5 17.600 5 21 5 22.800 8.500 21.500 11.700 19.500 16.300 12 21 12 21Z" fill="currentColor"/></svg>';
const COPY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" d="M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1Zm-4 8H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v1"/></svg>';

function nameCardHtml(item, gender, deityTitle, i, showDeity){
  const on = isSaved(gender, deityTitle, item.name);
  return `<li class="bn-name" style="--i:${Math.min(i, 24)}" data-g="${esc(gender)}" data-d="${esc(deityTitle)}" data-n="${esc(item.name)}" data-m="${esc(item.meaning || "")}">
    <div class="bn-name__main">
      <h4>${esc(item.name)}</h4>
      <p>${esc(item.meaning || "")}</p>
      ${showDeity ? `<span class="bn-chip">${esc(deityTitle)} &middot; ${gender === "girl" ? "Girl" : "Boy"}</span>` : ""}
    </div>
    <div class="bn-name__acts">
      <button class="bn-ico" type="button" data-act="save" aria-pressed="${on}" aria-label="${on ? "Remove" : "Save"} ${esc(item.name)}">${HEART}</button>
      <button class="bn-ico" type="button" data-act="copy" aria-label="Copy ${esc(item.name)} and its meaning">${COPY}</button>
    </div>
  </li>`;
}

function onNameAction(event){
  const btn = event.target.closest("[data-act]");
  if(!btn) return;
  const card = btn.closest(".bn-name");
  if(!card) return;
  const { g, d, n, m } = card.dataset;
  if(btn.dataset.act === "save"){
    const on = toggleSaved(g, d, n, m);
    btn.setAttribute("aria-pressed", String(on));
    btn.setAttribute("aria-label", `${on ? "Remove" : "Save"} ${n}`);
    toast(on ? `${n} saved` : `${n} removed`);
    if(panelMode === "saved" && !on){ card.remove(); if(!document.querySelector(".deity-modal__list .bn-name")) renderSavedPanel(); }
  } else if(btn.dataset.act === "copy"){
    const text = `${n} — ${m}`;
    const done = ()=>{ btn.classList.add("is-done"); toast("Copied"); setTimeout(()=> btn.classList.remove("is-done"), 1400); };
    if(navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, ()=> toast(text));
    else toast(text);
  }
}
document.addEventListener("click", (e)=>{ if(e.target.closest(".bn-namegrid, .deity-modal__list")) onNameAction(e); });

/* ------------------------------ deity cards ------------------------------ */
function renderCards(){
  if(!deityGrid) return;
  deityGrid.innerHTML = "";
  deityCards.forEach((deity, index)=>{
    const count = namesOf(deity, currentGender).length;
    const picked = getFeaturedName(deity, currentGender);
    const card = document.createElement("article");
    card.className = "deity-card";
    card.dataset.deityIndex = String(index);
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `${deity.deity}: ${count} ${currentGender} names. Open`);
    card.innerHTML = `
      <video muted loop playsinline preload="none" poster="${videoPoster(deity.video)}" data-src="${cardVideoUrl(deity.video)}"></video>
      <span class="bn-count">${count} names</span>
      <div class="card-label">
        <h3>${esc(deity.deity)}</h3>
        ${picked ? `<p>Try <b>${esc(picked)}</b></p>` : ""}
        <span class="bn-open">See names <span aria-hidden="true">&rarr;</span></span>
      </div>`;
    const video = card.querySelector("video");
    if(cardVideoObserver) cardVideoObserver.observe(video);
    else if(!SAVE_DATA){ video.src = video.dataset.src; video.play().catch(()=>{}); }

    card.addEventListener("mouseenter", ()=>{ if(!video.getAttribute("src")) video.src = video.dataset.src; video.play().catch(()=>{}); });
    card.addEventListener("pointermove", (e)=>{
      if(e.pointerType !== "mouse") return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--ry", ((e.clientX - r.left) / r.width - .5) * 8 + "deg");
      card.style.setProperty("--rx", (.5 - (e.clientY - r.top) / r.height) * 8 + "deg");
    });
    card.addEventListener("pointerleave", ()=>{ card.style.setProperty("--rx","0deg"); card.style.setProperty("--ry","0deg"); });
    card.addEventListener("click", ()=> openDeityModal(index));
    card.addEventListener("keydown", (e)=>{ if(e.key === "Enter" || e.key === " "){ e.preventDefault(); openDeityModal(index); } });
    deityGrid.appendChild(card);
  });
  updateStats();
}

function updateStats(){
  const total = new Set(Object.values(babyNamesData).flatMap((byDeity)=> Object.values(byDeity).flatMap((map)=> Object.values(map).flat().map((x)=> x.name.toLowerCase())))).size;
  const el = document.querySelector("#bnStatNames");
  if(el) el.textContent = String(total);
}

/* ------------------------------ search across all names ------------------------------ */
let searchTimer;
function runSearch(){
  const q = searchInput.value.trim().toLowerCase();
  searchClear.hidden = !q;
  if(!q){ resultsSec.hidden = true; browseSec.hidden = false; return; }
  const hits = [];
  const seen = new Set();
  deityCards.forEach((deity)=>{
    namesOf(deity, currentGender).forEach((item)=>{
      const hay = `${item.name} ${item.meaning || ""}`.toLowerCase();
      const k = `${deity.deity}|${item.name}`;
      const match = q.length === 1 ? item.name.toLowerCase().startsWith(q) : hay.includes(q);
      if(match && !seen.has(k)){
        seen.add(k);
        hits.push({ item, deity, starts: item.name.toLowerCase().startsWith(q) ? 0 : item.name.toLowerCase().includes(q) ? 1 : 2 });
      }
    });
  });
  hits.sort((a, b)=> a.starts - b.starts || a.item.name.localeCompare(b.item.name));
  const shown = hits.slice(0, 120);
  resultsSec.hidden = false; browseSec.hidden = true;
  resultsTitle.textContent = !hits.length ? "No results"
    : q.length === 1 ? `${hits.length} ${currentGender} name${hits.length === 1 ? "" : "s"} starting with ${q.toUpperCase()}`
    : `${hits.length} ${currentGender} name${hits.length === 1 ? "" : "s"} for “${searchInput.value.trim()}”`;
  resultsList.innerHTML = shown.map((h, i)=> nameCardHtml(h.item, currentGender, h.deity.deity, i, true)).join("");
  resultsEmpty.hidden = hits.length > 0;
}
searchInput.addEventListener("input", ()=>{ clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 120); });
searchClear.addEventListener("click", ()=>{ searchInput.value = ""; runSearch(); searchInput.focus(); });

/* ------------------------------ girl / boy switch ------------------------------ */
function setGender(g){
  currentGender = g;
  seg.dataset.pos = g === "boy" ? "1" : "0";
  document.body.setAttribute("data-gender", g);
  toggleButtons.forEach((b)=>{ const on = b.dataset.gender === g; b.classList.toggle("active", on); b.setAttribute("aria-pressed", String(on)); });
  renderCards();
  runSearch();
}
toggleButtons.forEach((btn)=> btn.addEventListener("click", ()=> setGender(btn.dataset.gender)));

/* ------------------------------ modal ------------------------------ */
let openDeityIndex = null;
let modalGender = "girl";
let selectedLetter = "ALL";
let modalQuery = "";
let panelMode = "deity";
let lastFocus = null;

function buildDeityModal(){
  if(document.querySelector("#deityModal")) return;
  const modal = document.createElement("div");
  modal.id = "deityModal";
  modal.className = "deity-modal";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="deity-modal__backdrop" data-close="1"></div>
    <div class="deity-modal__panel" role="dialog" aria-modal="true" aria-label="Baby names">
      <video class="deity-modal__bgvideo" muted loop playsinline></video>
      <div class="deity-modal__shade" aria-hidden="true"></div>
      <button class="deity-modal__close" type="button" aria-label="Close" data-close="1">✕</button>
      <div class="deity-modal__content">
        <div class="deity-modal__hero">
          <h2 class="deity-modal__title"></h2>
          <p class="bn-modal__sub"></p>
          <div class="deity-modal__tools">
            <div class="gender-toggle bn-seg deity-modal__toggle" role="group" aria-label="Choose names for">
              <span class="bn-seg__thumb" aria-hidden="true"></span>
              <button class="toggle-btn" type="button" data-gender="girl">Girl Names</button>
              <button class="toggle-btn" type="button" data-gender="boy">Boy Names</button>
            </div>
            <label class="bn-search">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.800-3.800" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              <span class="sr-only">Search in these names</span>
              <input class="bn-msearch" type="search" placeholder="Search in these names" autocomplete="off">
            </label>
          </div>
        </div>
        <div class="deity-modal__alpha" aria-label="Filter by starting letter"></div>
        <div class="deity-modal__list-wrap">
          <ul class="deity-modal__list"></ul>
          <p class="deity-modal__empty" hidden>No names found. Try another letter.</p>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.addEventListener("click", (e)=>{
    if(e.target instanceof HTMLElement && e.target.dataset.close) closeDeityModal();
  });
  modal.querySelector(".bn-msearch").addEventListener("input", (e)=>{ modalQuery = e.target.value.trim().toLowerCase(); renderModalList(); });
  document.addEventListener("keydown", (e)=>{
    if(!document.body.classList.contains("deity-modal-open")) return;
    if(e.key === "Escape"){ closeDeityModal(); return; }
    if(e.key !== "Tab") return;
    const f = [...modal.querySelectorAll("button, input, a[href]")].filter((x)=> x.offsetParent !== null);
    if(!f.length) return;
    if(e.shiftKey && document.activeElement === f[0]){ e.preventDefault(); f[f.length-1].focus(); }
    else if(!e.shiftKey && document.activeElement === f[f.length-1]){ e.preventDefault(); f[0].focus(); }
  });
}

function expandPanel(sourceEl){
  const modal = document.querySelector("#deityModal");
  const panel = modal.querySelector(".deity-modal__panel");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(sourceEl && !reduce){
    const r = sourceEl.getBoundingClientRect();
    Object.assign(panel.style, { top:`${r.top}px`, left:`${r.left}px`, width:`${r.width}px`, height:`${r.height}px`, borderRadius:"22px" });
  }
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("deity-modal-open");
  requestAnimationFrame(()=>{
    modal.classList.add("is-open");
    Object.assign(panel.style, { top:"0px", left:"0px", width:"100vw", height:"100dvh", borderRadius:"0px" });
  });
}

function openDeityModal(index){
  buildDeityModal();
  const deity = deityCards[index];
  if(!deity) return;
  lastFocus = document.activeElement;
  panelMode = "deity";
  openDeityIndex = index;
  modalGender = currentGender;
  selectedLetter = "ALL";
  modalQuery = "";
  const modal = document.querySelector("#deityModal");
  modal.querySelector(".bn-msearch").value = "";
  modal.querySelector(".deity-modal__toggle").hidden = false;
  modal.querySelector(".deity-modal__alpha").hidden = false;
  modal.querySelector(".bn-search").hidden = false;
  modal.querySelector(".deity-modal__empty").textContent = "No names found. Try another letter.";
  const video = modal.querySelector(".deity-modal__bgvideo");
  video.hidden = false;
  video.poster = videoPoster(deity.video);
  video.src = modalVideoUrl(deity.video);
  video.currentTime = 0;
  video.play().catch(()=>{});
  modal.querySelector(".deity-modal__title").textContent = deity.deity;
  syncModalToggle(modal);
  expandPanel(document.querySelector(`.deity-card[data-deity-index="${index}"]`));
  renderAlpha();
  renderModalList();
  modal.querySelector(".deity-modal__close").focus({ preventScroll:true });
}

function syncModalToggle(modal){
  const t = modal.querySelector(".deity-modal__toggle");
  t.dataset.pos = modalGender === "boy" ? "1" : "0";
  const btns = t.querySelectorAll(".toggle-btn");
  btns.forEach((b)=>{
    const on = b.dataset.gender === modalGender;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
    b.onclick = ()=>{ modalGender = b.dataset.gender; selectedLetter = "ALL"; syncModalToggle(modal); renderAlpha(); renderModalList(); };
  });
}

function closeDeityModal(){
  const modal = document.querySelector("#deityModal");
  if(!modal || modal.getAttribute("aria-hidden") === "true") return;
  const panel = modal.querySelector(".deity-modal__panel");
  const video = modal.querySelector(".deity-modal__bgvideo");
  modal.classList.remove("is-open");
  if(video) video.pause();
  const src = openDeityIndex !== null ? document.querySelector(`.deity-card[data-deity-index="${openDeityIndex}"]`) : null;
  if(src){
    const r = src.getBoundingClientRect();
    Object.assign(panel.style, { top:`${r.top}px`, left:`${r.left}px`, width:`${r.width}px`, height:`${r.height}px`, borderRadius:"22px" });
  }
  window.setTimeout(()=>{
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("deity-modal-open");
    openDeityIndex = null;
    if(lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll:true });
  }, 420);
}

function currentDeity(){ return openDeityIndex === null ? null : deityCards[openDeityIndex]; }

function renderAlpha(){
  const modal = document.querySelector("#deityModal");
  const wrap = modal.querySelector(".deity-modal__alpha");
  const deity = currentDeity();
  const map = deity ? getDeityLetterMap(getDeityKey(deity), modalGender) : {};
  wrap.innerHTML = "";
  const mk = (key, label, empty)=>{
    const b = document.createElement("button");
    b.type = "button";
    b.className = "alpha-btn" + (selectedLetter === key ? " active" : "") + (empty ? " is-empty" : "");
    b.textContent = label;
    b.setAttribute("aria-pressed", String(selectedLetter === key));
    b.addEventListener("click", ()=>{ selectedLetter = key; renderAlpha(); renderModalList(); });
    wrap.appendChild(b);
    return b;
  };
  mk("ALL", "All", false);
  ALPHABETS.forEach((l)=> mk(l, l, !(map[l] && map[l].length)));
  const active = wrap.querySelector(".alpha-btn.active");
  if(active && active.scrollIntoView) active.scrollIntoView({ block:"nearest", inline:"center" });
}

function renderModalList(){
  const modal = document.querySelector("#deityModal");
  const list = modal.querySelector(".deity-modal__list");
  const empty = modal.querySelector(".deity-modal__empty");
  const deity = currentDeity();
  if(!deity) return;
  const map = getDeityLetterMap(getDeityKey(deity), modalGender);
  let items = selectedLetter === "ALL" ? ALPHABETS.flatMap((l)=> map[l] || []) : (map[selectedLetter] || []);
  if(modalQuery) items = items.filter((x)=> `${x.name} ${x.meaning || ""}`.toLowerCase().includes(modalQuery));
  modal.querySelector(".bn-modal__sub").textContent = `${items.length} ${modalGender} name${items.length === 1 ? "" : "s"} blessed by ${deity.deity}`;
  list.innerHTML = items.map((x, i)=> nameCardHtml(x, modalGender, deity.deity, i, false)).join("");
  empty.hidden = items.length > 0;
  modal.querySelector(".deity-modal__list-wrap").scrollTop = 0;
}

/* ------------------------------ saved names panel ------------------------------ */
function renderSavedPanel(){
  const modal = document.querySelector("#deityModal");
  const list = modal.querySelector(".deity-modal__list");
  const empty = modal.querySelector(".deity-modal__empty");
  modal.querySelector(".bn-modal__sub").textContent = saved.length
    ? `${saved.length} name${saved.length === 1 ? "" : "s"} you liked. They stay on this device.`
    : "";
  list.innerHTML = saved.map((s, i)=> nameCardHtml({ name:s.n, meaning:s.m }, s.g, s.d, i, true)).join("");
  empty.textContent = "Nothing saved yet. Tap the heart on any name to keep it here.";
  empty.hidden = saved.length > 0;
}
savedBtn.addEventListener("click", ()=>{
  buildDeityModal();
  lastFocus = savedBtn;
  panelMode = "saved";
  openDeityIndex = null;
  const modal = document.querySelector("#deityModal");
  modal.querySelector(".deity-modal__title").textContent = "Saved names";
  modal.querySelector(".deity-modal__toggle").hidden = true;
  modal.querySelector(".deity-modal__alpha").hidden = true;
  modal.querySelector(".bn-search").hidden = true;
  const video = modal.querySelector(".deity-modal__bgvideo");
  video.hidden = true; video.removeAttribute("src");
  expandPanel(savedBtn);
  renderSavedPanel();
  modal.querySelector(".deity-modal__close").focus({ preventScroll:true });
});
function scrollToResults(){
  const top = resultsSec.getBoundingClientRect().top + window.pageYOffset - 90;
  window.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

/* a floating letter was tapped: show every name that starts with it */
function pickLetter(key, label){
  if(key === "OM"){ toast("\u0950 \u2014 may your little one be blessed"); return; }
  searchInput.value = key;
  runSearch();
  scrollToResults();
  toast(`Names starting with ${key}`);
}

/* "Surprise me": three random names with a shower of sparkles */
const surpriseBtn = document.querySelector("#bnSurprise");
function surprise(){
  const pool = [];
  deityCards.forEach((deity)=> namesOf(deity, currentGender).forEach((item)=> pool.push({ item, deity })));
  if(!pool.length) return;
  const picks = [];
  while(picks.length < Math.min(3, pool.length)){
    const c = pool[Math.floor(Math.random() * pool.length)];
    if(!picks.some((p)=> p.item.name === c.item.name)) picks.push(c);
  }
  searchInput.value = "";
  searchClear.hidden = true;
  resultsSec.hidden = false; browseSec.hidden = true;
  resultsTitle.textContent = `Three ${currentGender} names picked for you`;
  resultsList.innerHTML = picks.map((h, i)=> nameCardHtml(h.item, currentGender, h.deity.deity, i, true)).join("") ;
  resultsEmpty.hidden = true;
  const r = surpriseBtn.getBoundingClientRect();
  if(window.BabyNamesFx) window.BabyNamesFx.burst(r.left + r.width / 2, r.top + r.height / 2, 30);
  scrollToResults();
}
if(surpriseBtn) surpriseBtn.addEventListener("click", surprise);

window.BabyNames = { pickLetter };

document.body.setAttribute("data-gender", currentGender);
updateSavedCount(false);
renderCards();
