/**
 * Production-level Sanatan Quiz (Frontend)
 * - Fullscreen modal quiz experience
 * - Dynamic leaderboard via Django APIs
 * - Submit score to backend and update stats
 * - No frameworks, modular functions
 */

// ----------------------------
// Question Bank (sample)
// ----------------------------
// Each question:
// { prompt: string, options: [string,string,string,string], answerIndex: 0-3, explanation?: string }
const QUESTION_BANK = {
  gita: [
    {
      prompt: "In the Bhagavad Gita, who is Arjuna’s charioteer during the Kurukshetra war?",
      options: ["Bhishma", "Krishna", "Dronacharya", "Karna"],
      answerIndex: 1,
      explanation: "Krishna becomes Arjuna’s charioteer and teacher in the Gita.",
    },
    {
      prompt: "What does 'Dharma' primarily refer to in the Gita’s context?",
      options: ["A festival", "Duty / righteous path", "A weapon", "A place"],
      answerIndex: 1,
      explanation: "Dharma is your righteous duty and the path of right action.",
    },
    {
      prompt: "Which Yoga does Krishna emphasize as selfless action?",
      options: ["Bhakti Yoga", "Jnana Yoga", "Karma Yoga", "Raja Yoga"],
      answerIndex: 2,
      explanation: "Karma Yoga is acting without attachment to results.",
    },
    {
      prompt: "What is the key message of 'Nishkama Karma'?",
      options: [
        "Do nothing at all",
        "Work only for rewards",
        "Do your duty without attachment to results",
        "Avoid responsibilities",
      ],
      answerIndex: 2,
      explanation: "Work sincerely, but don’t cling to outcomes.",
    },
    {
      prompt: "Which concept describes the eternal nature of the soul (Atman)?",
      options: ["Anitya", "Nitya", "Maya", "Samsara"],
      answerIndex: 1,
      explanation: "Nitya means eternal/everlasting.",
    },
    {
      prompt: "Krishna advises performing action while being ______ to results.",
      options: ["attached", "angry", "detached", "confused"],
      answerIndex: 2,
      explanation: "The Gita teaches action with detachment to results.",
    },
  ],
  ramayana: [
    {
      prompt: "Who is the author traditionally credited for the Ramayana?",
      options: ["Valmiki", "Vyasa", "Tulsidas", "Kalidasa"],
      answerIndex: 0,
      explanation: "Maharshi Valmiki is traditionally considered the author.",
    },
    {
      prompt: "What is the name of Lord Rama’s wife?",
      options: ["Draupadi", "Sita", "Rukmini", "Kunti"],
      answerIndex: 1,
      explanation: "Sita is Lord Rama’s wife.",
    },
    {
      prompt: "Who is the devoted vanara who leaps to Lanka?",
      options: ["Sugriva", "Vibhishana", "Hanuman", "Jambavan"],
      answerIndex: 2,
      explanation: "Hanuman is known for his devotion and strength.",
    },
    {
      prompt: "Which kingdom is associated with Lord Rama’s rule?",
      options: ["Dwarka", "Ayodhya", "Hastinapur", "Mathura"],
      answerIndex: 1,
      explanation: "Rama is the prince/king of Ayodhya.",
    },
    {
      prompt: "What is 'Maryada Purushottam' associated with?",
      options: ["Ravana", "Rama", "Bharata", "Lakshmana"],
      answerIndex: 1,
      explanation: "It is a title for Lord Rama, symbolizing ideal conduct.",
    },
  ],
  mahabharata: [
    {
      prompt: "Who composed the Mahabharata according to tradition?",
      options: ["Valmiki", "Vyasa", "Tulsidas", "Chanakya"],
      answerIndex: 1,
      explanation: "Maharshi Vyasa is traditionally credited.",
    },
    {
      prompt: "How many Pandavas are there?",
      options: ["3", "5", "7", "9"],
      answerIndex: 1,
      explanation: "There are five Pandavas.",
    },
    {
      prompt: "Who is the eldest Pandava?",
      options: ["Arjuna", "Bhima", "Yudhishthira", "Nakula"],
      answerIndex: 2,
      explanation: "Yudhishthira is the eldest and known for righteousness.",
    },
    {
      prompt: "Which war is central to the Mahabharata?",
      options: ["Kurukshetra War", "Lanka War", "Kalinga War", "Trojan War"],
      answerIndex: 0,
      explanation: "The epic centers around the Kurukshetra war.",
    },
    {
      prompt: "Which character is known as 'Vrkodara'?",
      options: ["Bhima", "Arjuna", "Karna", "Duryodhana"],
      answerIndex: 0,
      explanation: "Bhima is called Vrkodara (wolf-bellied).",
    },
  ],
  vedic_science: [
    {
      prompt: "In traditional Indian thought, which element is associated with space?",
      options: ["Prithvi", "Jala", "Akasha", "Agni"],
      answerIndex: 2,
      explanation: "Akasha refers to ether/space in Pancha Mahabhutas.",
    },
    {
      prompt: "What does 'Yoga' literally mean?",
      options: ["Union", "Separation", "Food", "Weapon"],
      answerIndex: 0,
      explanation: "Yoga means union (yuj).",
    },
    {
      prompt: "Which text is a foundational work of Ayurveda?",
      options: ["Charaka Samhita", "Arthashastra", "Natya Shastra", "Meghaduta"],
      answerIndex: 0,
      explanation: "Charaka Samhita is a core Ayurvedic text.",
    },
    {
      prompt: "Which is NOT one of the Pancha Mahabhutas?",
      options: ["Akasha", "Vayu", "Manas", "Agni"],
      answerIndex: 2,
      explanation: "Manas (mind) is not among the five great elements.",
    },
    {
      prompt: "Surya Siddhanta is traditionally associated with which domain?",
      options: ["Astronomy", "Cooking", "Poetry", "Dance"],
      answerIndex: 0,
      explanation: "Surya Siddhanta is a classic work on astronomy.",
    },
  ],
};

// ----------------------------
// Config
// ----------------------------
const QUESTIONS_PER_GAME = 10;
const SECONDS_PER_QUESTION = 12;
const AUTO_NEXT_DELAY_MS = 1200;

// ----------------------------
// DOM helpers
// ----------------------------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// Landing
const startQuizBtn = $("#startQuizBtn");
const soundToggleBtn = $("#soundToggleBtn");
const highScoreText = $("#highScoreText");
const bestStreakText = $("#bestStreakText");
const categoryCards = $$(".category-card");

// Leaderboard UI
const leaderboardSub = $("#leaderboardSub");
const leaderboardLoading = $("#leaderboardLoading");
const leaderboardEmpty = $("#leaderboardEmpty");
const leaderboardError = $("#leaderboardError");
const leaderboardPodium = $("#leaderboardPodium");
const leaderboardRows = $("#leaderboardRows");

// Modal
const quizModal = $("#quizModal");
const modalStartEl = $("#modalStart");
const modalCategoryTitle = $("#modalCategoryTitle");
const modalStartBtn = $("#modalStartBtn");
const modalCloseBtn = $("#modalCloseBtn");

// Stage (inside modal)
const stageEl = $("#quizStage");
const categoryChip = $("#categoryChip");
const progressText = $("#progressText");
const timerText = $("#timerText");
const progressBar = $("#progressBar");
const scoreText = $("#scoreText");
const streakText = $("#streakText");
const xpText = $("#xpText");
const questionCard = $("#questionCard");
const questionKicker = $("#questionKicker");
const questionText = $("#questionText");
const optionsGrid = $("#optionsGrid");
const feedbackText = $("#feedbackText");
const nextBtn = $("#nextBtn");
const quitBtn = $("#quitBtn");

// Results (inside modal)
const resultEl = $("#quizResult");
const finalScoreText = $("#finalScoreText");
const resultTitle = $("#resultTitle");
const resultSubText = $("#resultSubText");
const resultBestStreak = $("#resultBestStreak");
const resultCategory = $("#resultCategory");
const resultXp = $("#resultXp");
const playAgainBtn = $("#playAgainBtn");
const backToLandingBtn = $("#backToLandingBtn");

// ----------------------------
// State
// ----------------------------
let selectedCategory = null;
let questionOrder = [];
let currentIndex = 0;
let score = 0;
let streak = 0;
let bestStreak = 0;
let xp = 0;

let remaining = SECONDS_PER_QUESTION;
let timerId = null;
let acceptingAnswer = true;

let canGoNext = false;
let autoNextId = null;

let soundEnabled = true;

// ----------------------------
// LocalStorage keys
// ----------------------------
function highScoreKey(category) { return `smsQuizHighestScore:${category}`; }
function bestStreakKey(category) { return `smsQuizBestStreak:${category}`; }

function getHighScore(category){
  const value = Number(localStorage.getItem(highScoreKey(category)) || "0");
  return Number.isFinite(value) ? value : 0;
}

function setHighScore(category, value){
  localStorage.setItem(highScoreKey(category), String(value));
}

function getBestStreak(category){
  const value = Number(localStorage.getItem(bestStreakKey(category)) || "0");
  return Number.isFinite(value) ? value : 0;
}

function setBestStreak(category, value){
  localStorage.setItem(bestStreakKey(category), String(value));
}

// ----------------------------
// UI helpers
// ----------------------------
function show(el){ if(el) el.hidden = false; }
function hide(el){ if(el) el.hidden = true; }

function prettifyCategory(category){
  const map = {
    gita: "Bhagavad Gita",
    ramayana: "Ramayana",
    mahabharata: "Mahabharata",
    vedic_science: "Vedic Science",
  };
  return map[category] || String(category || "").replaceAll("_"," ").replace(/\b\w/g, (m)=>m.toUpperCase());
}

function setFeedback(message, kind /* good|bad|neutral */){
  if(!feedbackText) return;
  feedbackText.textContent = message || "";
  feedbackText.classList.remove("good","bad");
  if(kind === "good") feedbackText.classList.add("good");
  if(kind === "bad") feedbackText.classList.add("bad");
}

function updateTopStats(){
  if(scoreText) scoreText.textContent = String(score);
  if(streakText) streakText.textContent = String(streak);
  if(xpText) xpText.textContent = String(xp);
}

function updateProgress(){
  const total = questionOrder.length || 0;
  const currentHuman = Math.min(currentIndex + 1, total);
  if(progressText) progressText.textContent = `Question ${currentHuman}/${total}`;
  if(progressBar && total > 0){
    progressBar.style.width = `${(currentHuman / total) * 100}%`;
  }
}

function updateTimerUI(){
  if(timerText) timerText.textContent = `${remaining}s`;
}

// ----------------------------
// CSRF + fetch helpers
// ----------------------------
function getCookie(name){
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if(parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

async function apiFetch(url, { method = "GET", body = null } = {}){
  const headers = { "Accept":"application/json" };
  const opts = { method, headers, credentials:"same-origin" };
  if(body !== null){
    headers["Content-Type"] = "application/json";
    const token = getCookie("csrftoken");
    if(token) headers["X-CSRFToken"] = token;
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if(!res.ok){
    const text = await res.text().catch(()=> "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

// ----------------------------
// Sound (WebAudio beeps)
// ----------------------------
let audioCtx = null;
function beep({ frequency = 440, duration = 0.08, type = "sine", gain = 0.04 } = {}){
  if(!soundEnabled) return;
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }catch{
    // ignore
  }
}

function soundCorrect(){
  beep({ frequency: 740, duration: 0.07, type:"triangle", gain: 0.045 });
  setTimeout(()=>beep({ frequency: 980, duration: 0.08, type:"triangle", gain: 0.04 }), 70);
}

function soundWrong(){
  beep({ frequency: 180, duration: 0.12, type:"sawtooth", gain: 0.03 });
}

// ----------------------------
// Modal
// ----------------------------
function openModal(){
  if(!quizModal) return;
  quizModal.setAttribute("aria-hidden","false");
  document.body.style.overflow = "hidden";
}

function closeModal(){
  stopTimer();
  stopAutoNext();
  if(!quizModal) return;
  quizModal.setAttribute("aria-hidden","true");
  document.body.style.overflow = "";
  show(modalStartEl);
  hide(stageEl);
  hide(resultEl);
  if(nextBtn) nextBtn.disabled = true;
}

function stopAutoNext(){
  if(autoNextId){
    clearTimeout(autoNextId);
    autoNextId = null;
  }
}

// ----------------------------
// Leaderboard rendering
// ----------------------------
function setLeaderboardState({ loading=false, empty=false, error=false, ready=false } = {}){
  if(leaderboardLoading) leaderboardLoading.setAttribute("aria-hidden", loading ? "false" : "true");
  if(leaderboardEmpty) leaderboardEmpty.hidden = !empty;
  if(leaderboardError) leaderboardError.hidden = !error;
  if(leaderboardPodium) leaderboardPodium.hidden = !ready;
  if(leaderboardRows) leaderboardRows.hidden = !ready;
}

function avatarLetter(username){
  const t = String(username || "").trim();
  return t ? t[0].toUpperCase() : "—";
}

function setPodium(place, row){
  if(!leaderboardPodium) return;
  const nameEl = leaderboardPodium.querySelector(`[data-name="${place}"]`);
  const scoreEl = leaderboardPodium.querySelector(`[data-score="${place}"]`);
  const avEl = leaderboardPodium.querySelector(`[data-avatar="${place}"]`);
  const username = row ? row.username : "—";
  const scoreVal = row ? row.score : 0;
  if(nameEl) nameEl.textContent = username;
  if(scoreEl) scoreEl.textContent = String(scoreVal);
  if(avEl) avEl.textContent = avatarLetter(username);
}

function renderRows(rows){
  if(!leaderboardRows) return;
  leaderboardRows.innerHTML = "";
  rows.forEach((row, idx)=>{
    const rank = idx + 4;
    const div = document.createElement("div");
    div.className = "lb-row";
    div.innerHTML = `
      <div class="lb-rank">${rank}</div>
      <div class="lb-user">${row.username}</div>
      <div class="lb-row-score">${row.score}</div>
    `;
    leaderboardRows.appendChild(div);
  });
}

async function loadLeaderboard(categoryOrNull){
  const url = categoryOrNull ? `/api/leaderboard/${categoryOrNull}/` : "/api/leaderboard/";
  setLeaderboardState({ loading:true, empty:false, error:false, ready:false });
  try{
    const rows = await apiFetch(url);
    const list = Array.isArray(rows) ? rows : [];
    if(list.length === 0){
      setLeaderboardState({ loading:false, empty:true, error:false, ready:false });
      return;
    }
    setPodium(1, list[0] || null);
    setPodium(2, list[1] || null);
    setPodium(3, list[2] || null);
    renderRows(list.slice(3));
    setLeaderboardState({ loading:false, empty:false, error:false, ready:true });
  }catch{
    setLeaderboardState({ loading:false, empty:false, error:true, ready:false });
  }
}

// ----------------------------
// Quiz core
// ----------------------------
function shuffle(array){
  const copy = array.slice();
  for(let i = copy.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function prepareGame(category){
  selectedCategory = category;
  score = 0;
  streak = 0;
  bestStreak = 0;
  xp = 0;
  currentIndex = 0;

  const bank = QUESTION_BANK[category] || [];
  const picked = shuffle(bank).slice(0, Math.min(QUESTIONS_PER_GAME, bank.length));
  questionOrder = picked;
}

function startGame(){
  if(!selectedCategory) return;
  prepareGame(selectedCategory);

  if(categoryChip) categoryChip.textContent = `🕉️ ${prettifyCategory(selectedCategory)}`;
  if(questionKicker) questionKicker.textContent = "Focus • Dharma";

  hide(modalStartEl);
  hide(resultEl);
  show(stageEl);

  updateTopStats();
  renderQuestion();
}

function renderQuestion(){
  if(questionOrder.length === 0){
    finishGame();
    return;
  }

  acceptingAnswer = true;
  canGoNext = false;
  stopAutoNext();
  if(nextBtn) nextBtn.disabled = true;
  setFeedback("", "neutral");

  const q = questionOrder[currentIndex];
  if(questionText) questionText.textContent = q.prompt;

  if(optionsGrid){
    optionsGrid.innerHTML = "";
    q.options.forEach((opt, idx)=>{
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option-card";
      btn.setAttribute("role","listitem");
      btn.dataset.index = String(idx);
      btn.innerHTML = `
        <div class="option-label">
          <div class="opt-letter">${String.fromCharCode(65 + idx)}</div>
          <div class="opt-text">${opt}</div>
        </div>
      `;
      btn.addEventListener("click", ()=>submitAnswer(idx));
      optionsGrid.appendChild(btn);
    });
  }

  updateProgress();
  startTimer();
}

function startTimer(){
  stopTimer();
  remaining = SECONDS_PER_QUESTION;
  updateTimerUI();

  timerId = setInterval(()=>{
    remaining -= 1;
    updateTimerUI();
    if(remaining <= 0){
      stopTimer();
      submitAnswer(null, { timedOut:true });
    }
  }, 1000);
}

function stopTimer(){
  if(timerId){
    clearInterval(timerId);
    timerId = null;
  }
}

function lockOptions(){
  if(!optionsGrid) return;
  optionsGrid.querySelectorAll(".option-card").forEach((btn)=>{ btn.disabled = true; });
}

function markOptions(correctIndex, pickedIndex){
  if(!optionsGrid) return;
  optionsGrid.querySelectorAll(".option-card").forEach((btn)=>{
    const idx = Number(btn.dataset.index);
    if(idx === correctIndex) btn.classList.add("correct");
    if(pickedIndex !== null && idx === pickedIndex && pickedIndex !== correctIndex) btn.classList.add("wrong");
  });
}

function submitAnswer(pickedIndex, { timedOut=false } = {}){
  if(!acceptingAnswer) return;
  acceptingAnswer = false;
  stopTimer();
  stopAutoNext();

  const q = questionOrder[currentIndex];
  const correctIndex = q.answerIndex;

  lockOptions();
  markOptions(correctIndex, pickedIndex);

  const isCorrect = pickedIndex === correctIndex;
  if(isCorrect){
    score += 1;
    streak += 1;
    bestStreak = Math.max(bestStreak, streak);
    xp += 10 + Math.min(streak, 10) * 2;
    setFeedback(`Correct!${q.explanation ? " " + q.explanation : ""}`, "good");
    soundCorrect();
  }else{
    streak = 0;
    xp += 1;
    const reason = timedOut ? "Time’s up!" : "Not quite.";
    setFeedback(`${reason} Correct answer: ${q.options[correctIndex]}.`, "bad");
    soundWrong();
    if(questionCard){
      questionCard.classList.remove("shake");
      void questionCard.offsetWidth;
      questionCard.classList.add("shake");
    }
  }

  updateTopStats();

  canGoNext = true;
  if(nextBtn) nextBtn.disabled = false;
  autoNextId = setTimeout(()=>{
    if(canGoNext) goNext();
  }, AUTO_NEXT_DELAY_MS);
}

function goNext(){
  if(!canGoNext) return;
  canGoNext = false;
  stopAutoNext();

  currentIndex += 1;
  if(currentIndex >= questionOrder.length){
    finishGame();
  }else{
    renderQuestion();
  }
}

async function submitScoreToBackend(){
  if(!selectedCategory) return;
  const payload = {
    category: selectedCategory,
    score,
    total: questionOrder.length || QUESTIONS_PER_GAME,
    best_streak: bestStreak,
  };
  const res = await apiFetch("/api/submit-score/", { method:"POST", body: payload });
  if(res && res.user_stats){
    // Mirror server values into local UI cache
    const hs = Number(res.user_stats.highest_score || 0);
    const bs = Number(res.user_stats.best_streak || 0);
    setHighScore(selectedCategory, Math.max(getHighScore(selectedCategory), hs));
    setBestStreak(selectedCategory, Math.max(getBestStreak(selectedCategory), bs));
  }
}

function finishGame(){
  stopTimer();
  stopAutoNext();

  const total = questionOrder.length || QUESTIONS_PER_GAME;
  const pct = total ? (score / total) : 0;

  // Tier titles
  let title = "Beginner 🧘";
  let sub = "Keep practicing, your Dharma knowledge will grow.";
  if(pct >= 0.8){
    title = "Guru 🕉️";
    sub = "Excellent! Your understanding shines like gold.";
  }else if(pct >= 0.5){
    title = "Yogi 📿";
    sub = "Great work. Stay consistent and deepen your wisdom.";
  }

  // Update local bests immediately
  setHighScore(selectedCategory, Math.max(getHighScore(selectedCategory), score));
  setBestStreak(selectedCategory, Math.max(getBestStreak(selectedCategory), bestStreak));

  if(finalScoreText) finalScoreText.textContent = `${score}/${questionOrder.length || 0}`;
  if(resultTitle) resultTitle.textContent = title;
  if(resultSubText) resultSubText.textContent = sub;
  if(resultBestStreak) resultBestStreak.textContent = String(bestStreak);
  if(resultCategory) resultCategory.textContent = prettifyCategory(selectedCategory);
  if(resultXp) resultXp.textContent = String(xp);

  hide(stageEl);
  show(resultEl);

  // Backend sync + refresh leaderboards (non-blocking UX)
  submitScoreToBackend()
    .then(()=> {
      refreshLandingStats();
      leaderboardSub.textContent = `Top learners in ${prettifyCategory(selectedCategory)}.`;
      return loadLeaderboard(selectedCategory);
    })
    .then(()=> loadLeaderboard(null))
    .catch(()=>{});
}

// ----------------------------
// Landing stats
// ----------------------------
function refreshLandingStats(){
  if(!selectedCategory){
    if(highScoreText) highScoreText.textContent = "—";
    if(bestStreakText) bestStreakText.textContent = "—";
    return;
  }
  if(highScoreText) highScoreText.textContent = String(getHighScore(selectedCategory));
  if(bestStreakText) bestStreakText.textContent = String(getBestStreak(selectedCategory));
}

// ----------------------------
// Ripple effect for premium buttons
// ----------------------------
function attachRipple(el){
  if(!el) return;
  el.addEventListener("click",(e)=>{
    if(el.disabled) return;
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const span = document.createElement("span");
    span.className = "ripple";
    span.style.width = `${size}px`;
    span.style.height = `${size}px`;
    span.style.left = `${x}px`;
    span.style.top = `${y}px`;
    el.appendChild(span);
    setTimeout(()=>span.remove(), 650);
  });
}

// ----------------------------
// Events
// ----------------------------
categoryCards.forEach((card)=>{
  card.addEventListener("click", ()=>{
    const cat = card.dataset.category;
    if(!cat) return;

    selectedCategory = cat;
    categoryCards.forEach(c=>c.classList.toggle("selected", c === card));
    if(startQuizBtn) startQuizBtn.disabled = false;

    refreshLandingStats();

    // Fullscreen modal flow
    if(modalCategoryTitle) modalCategoryTitle.textContent = `🕉️ ${prettifyCategory(selectedCategory)}`;
    if(categoryChip) categoryChip.textContent = `🕉️ ${prettifyCategory(selectedCategory)}`;
    show(modalStartEl);
    hide(stageEl);
    hide(resultEl);
    openModal();

    // Category leaderboard
    if(leaderboardSub) leaderboardSub.textContent = `Top learners in ${prettifyCategory(selectedCategory)}.`;
    loadLeaderboard(selectedCategory).catch(()=>{});
  });
});

// Landing "Start Quiz" button (opens modal if a category was selected)
startQuizBtn?.addEventListener("click", ()=>{
  if(!selectedCategory) return;
  if(modalCategoryTitle) modalCategoryTitle.textContent = `🕉️ ${prettifyCategory(selectedCategory)}`;
  show(modalStartEl);
  hide(stageEl);
  hide(resultEl);
  openModal();
  if(leaderboardSub) leaderboardSub.textContent = `Top learners in ${prettifyCategory(selectedCategory)}.`;
  loadLeaderboard(selectedCategory).catch(()=>{});
});

modalStartBtn?.addEventListener("click", startGame);
nextBtn?.addEventListener("click", goNext);
playAgainBtn?.addEventListener("click", startGame);

quitBtn?.addEventListener("click", closeModal);
backToLandingBtn?.addEventListener("click", closeModal);
modalCloseBtn?.addEventListener("click", closeModal);

// Click backdrop/close elements
quizModal?.addEventListener("click",(event)=>{
  const target = event.target;
  if(!(target instanceof HTMLElement)) return;
  if(target.dataset.close) closeModal();
});

document.addEventListener("keydown",(event)=>{
  if(event.key === "Escape" && quizModal?.getAttribute("aria-hidden") === "false"){
    closeModal();
  }
});

soundToggleBtn?.addEventListener("click", ()=>{
  soundEnabled = !soundEnabled;
  if(soundToggleBtn){
    soundToggleBtn.textContent = `Sound: ${soundEnabled ? "On" : "Off"}`;
    soundToggleBtn.setAttribute("aria-pressed", soundEnabled ? "true" : "false");
  }
  if(soundEnabled) beep({ frequency: 520, duration: 0.06, gain: 0.04 });
});

// Ripple on main buttons
[
  startQuizBtn, soundToggleBtn, modalStartBtn, nextBtn, quitBtn, playAgainBtn, backToLandingBtn,
].forEach(attachRipple);

// ----------------------------
// Init
// ----------------------------
refreshLandingStats();
if(leaderboardSub) leaderboardSub.textContent = "Top learners by total score.";
loadLeaderboard(null).catch(()=>{});

