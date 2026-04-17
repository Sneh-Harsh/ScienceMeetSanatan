const QUIZ_BANK = {};

const CATEGORY_META = {
  mythology:{ name:"Spiritual & Mythology", icon:"🕉️", accent:"gold-accent", progress:0, plays:"Dynamic pool", reward:"+120 XP" },
  astrology:{ name:"Astrology & Destiny", icon:"🪐", accent:"blue-accent", progress:0, plays:"Adaptive mix", reward:"+120 XP" },
  brain:{ name:"Brain Games & Logic", icon:"♟️", accent:"violet-accent", progress:0, plays:"Fresh each run", reward:"+120 XP" },
  knowledge:{ name:"General Knowledge", icon:"🌍", accent:"copper-accent", progress:0, plays:"Weighted pool", reward:"+120 XP" },
};
const CATEGORY_ROWS = Array.isArray(window.SMS_QUIZ_CATEGORY_ROWS) ? window.SMS_QUIZ_CATEGORY_ROWS : [];
const IS_AUTHENTICATED = Boolean(window.APP_CONTEXT?.isAuthenticated);
const QUIZ_PROFILE = window.APP_CONTEXT?.quizProfile || {};

const QUESTIONS_PER_GAME = 5;
const SECONDS_PER_QUESTION = 12;
const AUTO_NEXT_DELAY_MS = 1600;
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  section:"",
  category:"",
  questions:[],
  current:0,
  score:0,
  correct:0,
  combo:1,
  maxCombo:1,
  streak:0,
  bestStreak:0,
  momentum:0,
  answers:[],
  fastestTime:null,
  timerInterval:null,
  timeLeft:SECONDS_PER_QUESTION,
  answered:false,
  xpEarned:0,
  sessionId:"",
  coins: 0,
  totalXP: Number(QUIZ_PROFILE.totalScore || 0),
  currentPeriod:"weekly",
};

const heroRank = $("#hero-rank");
const heroStreak = $("#hero-streak");
const heroAccuracy = $("#hero-accuracy");
const heroLeague = $("#hero-league");
const navRank = $("#nav-rank");
const navStreak = $("#nav-streak");
const navXp = $("#nav-xp");
const navCoins = $("#nav-coins");
const dailyTitle = $("#daily-title");
const dailySub = $("#daily-sub");
const dailyReward = $("#daily-reward");
const lbWeekly = $("#lb-weekly");
const lbAlltime = $("#lb-alltime");
const playNowBtn = $("#play-now-btn");
const continueBtn = $("#continue-btn");
const dailyCard = $("#daily-card");
const exitQuizBtn = $("#exitQuizBtn");
const playAgainBtn = $("#playAgainBtn");
const backToHubBtn = $("#backToHubBtn");
const tryAnotherBtn = $("#tryAnotherBtn");
const shareBtn = $("#shareBtn");
const questionCard = $("#question-card");
const answersGrid = $("#answers-grid");
const qCurrent = $("#q-current");
const qNumber = $("#q-number");
const qText = $("#q-text");
const quizSectionName = $("#quiz-section-name");
const quizProgressFill = $("#quiz-progress-fill");
const timerText = $("#timer-text");
const timerRing = $("#timer-ring");
const comboBadge = $("#combo-badge");
const comboVal = $("#combo-val");
const streakDots = $("#streak-dots");
const momentumFill = $("#momentum-fill");
const liveScore = $("#live-score");
const feedbackBubble = $("#feedback-bubble");
const resultGrade = $("#result-grade");
const resultTitle = $("#result-title");
const resultSub = $("#result-sub");
const scoreRingFill = $("#score-ring-fill");
const resultScoreVal = $("#result-score-val");
const resCorrect = $("#res-correct");
const resAccuracy = $("#res-accuracy");
const resStreak = $("#res-streak");
const resSpeed = $("#res-speed");
const resXp = $("#res-xp");
const resCoins = $("#res-coins");
const rankArrow = $("#rank-arrow");
const rankText = $("#rank-text");
const achievementsRow = $("#achievements-row");
const mysteryReward = $("#mystery-reward");
const shareScore = $("#share-score");
const shareAcc = $("#share-acc");
const shareRank = $("#share-rank");
const leagueName = $("#league-name");
const leagueTier = $("#league-tier");
const leagueFill = $("#league-fill");
const leaguePct = $("#league-pct");
const leaderboardSection = $("#leaderboardSection");
const categoryBrowser = $("#categoryBrowser");
const browseStartBtn = $("#browseStartBtn");
const browseLeaderboardBtn = $("#browseLeaderboardBtn");
const achievementToast = $("#achievement-toast");
const toastIcon = $("#toast-icon");
const toastTitle = $("#toast-title");
const toastDesc = $("#toast-desc");

const leaderboardBoards = {
  global: {
    key:"global",
    board:"global",
    loading: $("#globalLeaderboardLoading"),
    empty: $("#globalLeaderboardEmpty"),
    error: $("#globalLeaderboardError"),
    sub: $("#globalLeaderboardSub"),
    podium: $("#globalLeaderboardPodium"),
    rows: $("#globalLeaderboardRows"),
    notice: null,
  },
  league: {
    key:"league",
    board:"league",
    loading: $("#leagueLeaderboardLoading"),
    empty: $("#leagueLeaderboardEmpty"),
    error: $("#leagueLeaderboardError"),
    sub: $("#leagueLeaderboardSub"),
    podium: $("#leagueLeaderboardPodium"),
    rows: $("#leagueLeaderboardRows"),
    notice: $("#leagueLeaderboardNotice"),
  },
};

function shuffle(array){
  const copy = array.slice();
  for(let i = copy.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getCookie(name){
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if(parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

async function apiFetch(url, { method = "GET", body = null } = {}){
  const headers = { Accept:"application/json" };
  const opts = { method, headers, credentials:"same-origin" };
  if(body !== null){
    headers["Content-Type"] = "application/json";
    const token = getCookie("csrftoken");
    if(token) headers["X-CSRFToken"] = token;
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if(!res.ok){
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

async function fetchQuizSession(category){
  return apiFetch("/api/quiz-session/", {
    method:"POST",
    body:{ category },
  });
}

function highScoreKey(category){ return `smsQuizHighestScore:${category}`; }
function bestStreakKey(category){ return `smsQuizBestStreak:${category}`; }
function getHighScore(category){ return Number(localStorage.getItem(highScoreKey(category)) || "0") || 0; }
function setHighScore(category, value){ localStorage.setItem(highScoreKey(category), String(value)); }
function getBestStreak(category){ return Number(localStorage.getItem(bestStreakKey(category)) || "0") || 0; }
function setBestStreak(category, value){ localStorage.setItem(bestStreakKey(category), String(value)); }

function refreshSectionProgress(){
  Object.entries(CATEGORY_META).forEach(([key, meta]) => {
    const pct = Math.max(meta.progress, Math.round((getHighScore(key) / QUESTIONS_PER_GAME) * 100));
    const fill = document.querySelector(`[data-progress-for="${key}"]`);
    const label = document.querySelector(`[data-progress-label-for="${key}"]`);
    const browseFill = document.querySelectorAll(`[data-browse-progress-for="${key}"]`);
    const browseLabel = document.querySelectorAll(`[data-browse-progress-label-for="${key}"]`);
    if(fill) fill.style.width = `${pct}%`;
    if(label) label.textContent = `${pct}% complete`;
    browseFill.forEach((node) => { node.style.width = `${pct}%`; });
    browseLabel.forEach((node) => { node.textContent = `${pct}% mastery`; });
  });
}

function showToast(title, description, icon = "✨"){
  if(!achievementToast) return;
  if(toastIcon) toastIcon.textContent = icon;
  if(toastTitle) toastTitle.textContent = title;
  if(toastDesc) toastDesc.textContent = description;
  achievementToast.classList.add("show");
  window.clearTimeout(showToast._timeout);
  showToast._timeout = window.setTimeout(() => {
    achievementToast.classList.remove("show");
  }, 2200);
}

function categoryCardMeta(card){
  const difficultyTone = String(card.difficulty || "Medium").toLowerCase();
  const toneClass = difficultyTone.includes("hard") || difficultyTone.includes("expert") ? "is-hard"
    : difficultyTone.includes("easy") || difficultyTone.includes("starter") ? "is-easy"
    : "is-medium";
  const liveCategory = card.liveCategory || "";
  const progressValue = liveCategory && CATEGORY_META[liveCategory] ? Math.max(CATEGORY_META[liveCategory].progress, Math.round((getHighScore(liveCategory) / QUESTIONS_PER_GAME) * 100)) : 0;
  return {
    toneClass,
    progressValue,
    progressLabel: liveCategory ? `${progressValue}% mastery` : "Sample set",
  };
}

function renderCategoryBrowser(){
  if(!categoryBrowser) return;
  if(!CATEGORY_ROWS.length){
    categoryBrowser.innerHTML = "";
    return;
  }
  categoryBrowser.innerHTML = CATEGORY_ROWS.map((row) => `
    <section class="browse-row fade-in" data-row-id="${row.id}">
      <div class="browse-row__head">
        <div>
          <h3>${row.title}</h3>
          <p>${row.subtitle || ""}</p>
        </div>
        <button class="browse-row__view" type="button" data-row-view="${row.id}">View all</button>
      </div>
      <div class="browse-row__shell">
        <button class="browse-row__arrow browse-row__arrow--left" type="button" aria-label="Scroll ${row.title} left" data-row-arrow="${row.id}" data-dir="-1">‹</button>
        <div class="browse-track" id="browse-track-${row.id}" tabindex="0" aria-label="${row.title}">
          ${row.cards.map((card) => {
            const meta = categoryCardMeta(card);
            return `
              <button
                class="browse-card"
                type="button"
                data-card-slug="${card.slug}"
                data-live-category="${card.liveCategory || ""}"
                style="--browse-accent:${card.accent}"
                aria-label="${card.title} quiz card"
              >
                <div class="browse-card__shine"></div>
                <div class="browse-card__icon">${card.icon || "✦"}</div>
                <div class="browse-card__badges">
                  ${card.badge ? `<span class="browse-pill">${card.badge}</span>` : ""}
                  ${card.isComingSoon ? `<span class="browse-pill browse-pill--ghost">Coming Soon</span>` : ""}
                </div>
                <div class="browse-card__body">
                  <h4>${card.title}</h4>
                  <p>${card.subtitle || ""}</p>
                </div>
                <div class="browse-card__meta">
                  <span class="difficulty-pill ${meta.toneClass}">${card.difficulty}</span>
                  <span class="xp-pill">+${card.xpReward} XP</span>
                  <span class="count-pill">${card.questionCount} Q</span>
                </div>
                <div class="browse-card__foot">
                  <div class="browse-card__progress">
                    <div class="browse-card__progress-bar">
                      <div class="browse-card__progress-fill" ${card.liveCategory ? `data-browse-progress-for="${card.liveCategory}"` : ""} style="width:${meta.progressValue}%"></div>
                    </div>
                    <span ${card.liveCategory ? `data-browse-progress-label-for="${card.liveCategory}"` : ""}>${meta.progressLabel}</span>
                  </div>
                  <strong>${card.liveCategory ? "Play now" : "Preview lane"}</strong>
                </div>
              </button>
            `;
          }).join("")}
        </div>
        <button class="browse-row__arrow browse-row__arrow--right" type="button" aria-label="Scroll ${row.title} right" data-row-arrow="${row.id}" data-dir="1">›</button>
      </div>
    </section>
  `).join("");
}

function scrollBrowseRow(rowId, direction){
  const track = document.getElementById(`browse-track-${rowId}`);
  if(!track) return;
  const card = track.querySelector(".browse-card");
  const amount = card ? (card.getBoundingClientRect().width + 16) * 3 : 840;
  track.scrollBy({ left: amount * direction, behavior: "smooth" });
}

function handleCategoryCard(card){
  const liveCategory = String(card.dataset.liveCategory || "").trim();
  if(liveCategory && CATEGORY_META[liveCategory]){
    state.category = liveCategory;
    setCategorySelection(liveCategory);
    showQuiz(liveCategory);
    return;
  }
  card.classList.add("browse-card--peek");
  window.setTimeout(() => card.classList.remove("browse-card--peek"), 480);
  showToast("Sample category ready", "This lane is structured for future question bank expansion.", "🎬");
}

function bindCategoryBrowser(){
  if(!categoryBrowser || categoryBrowser.dataset.bound === "true") return;
  categoryBrowser.dataset.bound = "true";
  categoryBrowser.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if(!target) return;
    const arrow = target.closest("[data-row-arrow]");
    if(arrow){
      scrollBrowseRow(arrow.getAttribute("data-row-arrow"), Number(arrow.getAttribute("data-dir") || "1"));
      return;
    }
    const view = target.closest("[data-row-view]");
    if(view){
      const rowId = view.getAttribute("data-row-view");
      scrollBrowseRow(rowId, 1);
      return;
    }
    const card = target.closest(".browse-card");
    if(card){
      handleCategoryCard(card);
    }
  });
  categoryBrowser.addEventListener("keydown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const track = target?.closest(".browse-track");
    if(!track) return;
    const rowId = track.id.replace("browse-track-", "");
    if(event.key === "ArrowRight"){
      event.preventDefault();
      scrollBrowseRow(rowId, 1);
    }else if(event.key === "ArrowLeft"){
      event.preventDefault();
      scrollBrowseRow(rowId, -1);
    }
  });
}

function renderStreakDots(){
  streakDots.innerHTML = "";
  for(let i = 0; i < 5; i += 1){
    const span = document.createElement("span");
    span.className = `streak-dot ${i < Math.min(state.streak, 5) ? "lit" : ""}`;
    streakDots.appendChild(span);
  }
}

function updateComboUI(){
  if(comboVal) comboVal.textContent = String(state.combo);
  if(comboBadge) comboBadge.classList.toggle("hot", state.combo >= 3);
  if(momentumFill) momentumFill.style.width = `${state.momentum}%`;
}

function showScreen(id){
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
  const next = document.getElementById(id);
  if(next) next.classList.add("active");
  window.scrollTo({ top:0, behavior:"smooth" });
}

function showFeedback(message, kind){
  if(!feedbackBubble) return;
  feedbackBubble.textContent = message;
  feedbackBubble.className = `feedback-bubble show ${kind}`;
  window.clearTimeout(showFeedback._timeout);
  showFeedback._timeout = window.setTimeout(() => {
    feedbackBubble.className = "feedback-bubble";
  }, 1100);
}

function updateTopChrome(){
  if(!IS_AUTHENTICATED){
    if(heroAccuracy) heroAccuracy.textContent = "Login";
    if(heroStreak) heroStreak.textContent = "—";
    if(navStreak) navStreak.textContent = "—";
    if(navXp) navXp.textContent = "Login";
    if(navCoins) navCoins.textContent = "—";
    if(heroRank) heroRank.textContent = "—";
    if(navRank) navRank.textContent = "—";
    if(shareRank) shareRank.textContent = "Login";
    if(heroLeague) heroLeague.textContent = "Guest";
    return;
  }
  const totalAttempts = state.answers.length;
  const liveAccuracy = totalAttempts ? Math.round((state.correct / totalAttempts) * 100) : Number(QUIZ_PROFILE.averageAccuracy || 0);
  const globalRank = Number(QUIZ_PROFILE.globalRank || 0);
  if(heroStreak) heroStreak.textContent = String(Math.max(state.bestStreak || 0, Number(QUIZ_PROFILE.bestStreak || 0)));
  if(navStreak) navStreak.textContent = String(Math.max(state.bestStreak || 0, Number(QUIZ_PROFILE.bestStreak || 0)));
  if(navXp) navXp.textContent = `${state.totalXP} XP`;
  if(navCoins) navCoins.textContent = "—";
  if(heroRank) heroRank.textContent = globalRank > 0 ? `#${globalRank}` : "—";
  if(navRank) navRank.textContent = globalRank > 0 ? `#${globalRank}` : "—";
  if(shareRank) shareRank.textContent = globalRank > 0 ? `#${globalRank}` : "—";
  if(heroAccuracy) heroAccuracy.textContent = `${liveAccuracy}%`;
}

function computeLeagueMeta(totalScore){
  const score = Number(totalScore || 0);
  if(score >= 4000) return { name:"Cosmic", next_name:null, next_at:null, progress_pct:100 };
  if(score >= 2400) return { name:"Diamond", next_name:"Cosmic", next_at:4000, progress_pct:Math.max(0, Math.min(100, Math.round(((score - 2400) / 1599) * 100))) };
  if(score >= 1200) return { name:"Gold", next_name:"Diamond", next_at:2400, progress_pct:Math.max(0, Math.min(100, Math.round(((score - 1200) / 1199) * 100))) };
  if(score >= 600) return { name:"Silver", next_name:"Gold", next_at:1200, progress_pct:Math.max(0, Math.min(100, Math.round(((score - 600) / 599) * 100))) };
  return { name:"Bronze", next_name:"Silver", next_at:600, progress_pct:Math.max(0, Math.min(100, Math.round((score / 599) * 100))) };
}

function setLeaderboardState(refs, { loading = false, empty = false, error = false, ready = false, notice = false } = {}){
  if(!refs) return;
  if(refs.loading){
    refs.loading.hidden = !loading;
    refs.loading.setAttribute("aria-hidden", loading ? "false" : "true");
  }
  if(refs.empty) refs.empty.hidden = !empty;
  if(refs.error) refs.error.hidden = !error;
  if(refs.podium) refs.podium.hidden = !ready;
  if(refs.rows) refs.rows.hidden = !ready;
  if(refs.notice) refs.notice.hidden = !notice;
}

function avatarLetter(username){
  const text = String(username || "").trim();
  return text ? text[0].toUpperCase() : "—";
}

function setPodium(refs, place, row){
  const avatarEl = refs?.podium?.querySelector(`[data-avatar="${place}"]`);
  const nameEl = refs?.podium?.querySelector(`[data-name="${place}"]`);
  const scoreEl = refs?.podium?.querySelector(`[data-score="${place}"]`);
  const username = row?.username || "—";
  if(avatarEl) avatarEl.textContent = avatarLetter(username);
  if(nameEl) nameEl.textContent = username;
  if(scoreEl) scoreEl.textContent = String(row?.score ?? place);
}

function renderRows(refs, rows){
  if(!refs?.rows) return;
  refs.rows.innerHTML = "";
  rows.forEach((row, index) => {
    const div = document.createElement("div");
    div.className = "lb-entry";
    div.innerHTML = `
      <div class="lb-rank">${row.rank || (index + 4)}</div>
      <div class="lb-avatar" style="background:rgba(167,139,250,0.15);color:var(--violet)">${avatarLetter(row.username)}</div>
      <div class="lb-info"><div class="lb-name">${row.username}</div><div class="lb-title">${row.league || "Wisdom Seeker"}</div></div>
      <div class="lb-score"><div class="lb-score-val">${row.score}</div><div class="lb-score-lab">${row.attempts || 0} runs</div></div>
    `;
    refs.rows.appendChild(div);
  });
}

async function loadBoard(boardKey){
  const refs = leaderboardBoards[boardKey];
  if(!refs) return;
  const params = new URLSearchParams({
    period: state.currentPeriod,
    board: refs.board,
  });
  setLeaderboardState(refs, { loading:true });
  try{
    const payload = await apiFetch(`/api/leaderboard/?${params.toString()}`);
    const list = Array.isArray(payload?.entries) ? payload.entries : [];
    if(refs.sub) refs.sub.textContent = String(payload?.message || "");
    if(refs.notice){
      refs.notice.hidden = !payload?.requiresLogin;
      refs.notice.textContent = payload?.requiresLogin
        ? "Log in to compete for your personal league rank. Showing a preview league until then."
        : "";
    }
    if(!list.length){
      setLeaderboardState(refs, { empty:true, notice:Boolean(payload?.requiresLogin) });
      return;
    }
    setPodium(refs, 1, list[0] || null);
    setPodium(refs, 2, list[1] || null);
    setPodium(refs, 3, list[2] || null);
    renderRows(refs, list.slice(3, 10));
    setLeaderboardState(refs, { ready:true, notice:Boolean(payload?.requiresLogin) });
  }catch(error){
    if(refs.notice && !IS_AUTHENTICATED && refs.board === "league"){
      refs.notice.hidden = false;
      refs.notice.textContent = "Log in to compete for your league rank. Global rankings are still available above.";
      setLeaderboardState(refs, { notice:true });
      return;
    }
    setLeaderboardState(refs, { error:true });
  }
}

function loadLeaderboards(){
  return Promise.all([loadBoard("global"), loadBoard("league")]);
}

function startTimer(){
  clearInterval(state.timerInterval);
  state.timeLeft = SECONDS_PER_QUESTION;
  updateTimer();
  state.timerInterval = setInterval(() => {
    state.timeLeft -= 1;
    updateTimer();
    if(state.timeLeft <= 0){
      clearInterval(state.timerInterval);
      selectAnswer(null, null, true);
    }
  }, 1000);
}

function updateTimer(){
  if(timerText) timerText.textContent = String(state.timeLeft);
  if(timerRing){
    const totalLength = 138.2;
    const offset = totalLength * (1 - state.timeLeft / SECONDS_PER_QUESTION);
    timerRing.style.strokeDashoffset = String(offset);
    timerRing.style.stroke = state.timeLeft <= 3 ? "var(--red)" : state.timeLeft <= 6 ? "var(--copper)" : "url(#timerGrad)";
  }
}

function loadQuestion(){
  const q = state.questions[state.current];
  if(!q) return;
  state.answered = false;
  if(qCurrent) qCurrent.textContent = String(state.current + 1);
  if(qNumber) qNumber.textContent = `Question ${state.current + 1}`;
  if(qText) qText.textContent = q.question;
  if(quizProgressFill) quizProgressFill.style.width = `${(state.current / QUESTIONS_PER_GAME) * 100}%`;
  if(questionCard){
    questionCard.style.animation = "none";
    void questionCard.offsetHeight;
    questionCard.style.animation = "slideInCard 0.4s ease";
  }
  if(answersGrid){
    answersGrid.innerHTML = "";
    const keys = ["A","B","C","D"];
    q.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "answer-btn";
      btn.type = "button";
      btn.innerHTML = `<div class="answer-key">${keys[i]}</div><div class="answer-text">${opt}</div><div class="answer-result-icon"></div>`;
      btn.addEventListener("click", () => selectAnswer(i, btn, false));
      answersGrid.appendChild(btn);
    });
  }
  renderStreakDots();
  updateComboUI();
  startTimer();
}

async function showQuiz(category){
  const meta = CATEGORY_META[category];
  if(!meta) return;
  if(!IS_AUTHENTICATED){
    window.SMSLoginPopup?.open("quiz_start");
    return;
  }
  clearInterval(state.timerInterval);
  state.category = category;
  state.section = meta.name;
  state.questions = [];
  state.sessionId = "";
  state.current = 0;
  state.score = 0;
  state.correct = 0;
  state.combo = 1;
  state.maxCombo = 1;
  state.streak = 0;
  state.bestStreak = 0;
  state.momentum = 0;
  state.answers = [];
  state.fastestTime = null;
  state.xpEarned = 0;
  if(quizSectionName) quizSectionName.textContent = meta.name;
  if(liveScore) liveScore.textContent = "0";
  showScreen("quiz-screen");
  if(qCurrent) qCurrent.textContent = "1";
  if(qNumber) qNumber.textContent = "Preparing Quiz";
  if(qText) qText.textContent = "Selecting a fresh question set from your personalized pool…";
  if(quizProgressFill) quizProgressFill.style.width = "0%";
  if(answersGrid) answersGrid.innerHTML = "";
  renderStreakDots();
  updateComboUI();
  updateTopChrome();
  try{
    const session = await fetchQuizSession(category);
    const questions = Array.isArray(session?.questions) ? session.questions : [];
    if(!questions.length) throw new Error("No questions returned for this category.");
    state.sessionId = String(session.sessionId || "");
    state.questions = questions.slice(0, QUESTIONS_PER_GAME);
    if(quizSectionName) quizSectionName.textContent = session.categoryLabel || meta.name;
    loadQuestion();
  }catch(error){
    showToast("Quiz unavailable", "Could not load a fresh question set. Please try again.", "⚠️");
    exitQuiz();
  }
}

function exitQuiz(){
  clearInterval(state.timerInterval);
  showScreen("hub-screen");
  loadLeaderboards().catch(() => {});
}

function updateLeague(){
  if(!IS_AUTHENTICATED){
    if(leagueName) leagueName.textContent = "Guest Mode";
    if(heroLeague) heroLeague.textContent = "Guest";
    if(leagueTier) leagueTier.textContent = "Log in to track your personal league.";
    if(leagueFill) leagueFill.style.width = "0%";
    if(leaguePct) leaguePct.textContent = "0%";
    return;
  }
  const league = QUIZ_PROFILE.league || { name:"Bronze", next_name:"Silver", next_at:600, progress_pct:0 };
  const pct = Number(league.progress_pct || 0);
  const label = `${league.name} League`;
  const toward = league.next_name ? `→ ${league.next_name} at ${league.next_at} XP` : "→ Final tier reached";
  if(leagueName) leagueName.textContent = label;
  if(heroLeague) heroLeague.textContent = label.replace(" League", "");
  if(leagueTier) leagueTier.textContent = toward;
  if(leagueFill) leagueFill.style.width = `${pct}%`;
  if(leaguePct) leaguePct.textContent = `${pct}%`;
}

function updateResult(){
  const accuracy = Math.round((state.correct / QUESTIONS_PER_GAME) * 100);
  const grade = accuracy >= 90 ? "A+" : accuracy >= 75 ? "A" : accuracy >= 60 ? "B" : accuracy >= 40 ? "C" : "D";
  const title = accuracy >= 90 ? "Outstanding Performance!" : accuracy >= 75 ? "Strong Performance!" : accuracy >= 60 ? "Steady Progress" : "Keep Practicing";
  const xp = (state.correct * 40) + (state.bestStreak * 10) + Math.max(0, (state.maxCombo - 1) * 12);
  const coins = state.correct * 8;
  state.xpEarned = xp;
  setHighScore(state.category, Math.max(getHighScore(state.category), state.correct));
  setBestStreak(state.category, Math.max(getBestStreak(state.category), state.bestStreak));

  if(resultGrade) resultGrade.textContent = grade;
  if(resultTitle) resultTitle.textContent = title;
  if(resultSub) resultSub.textContent = `You completed the ${state.section} trial`;
  if(resultScoreVal) resultScoreVal.textContent = String(state.score);
  if(resCorrect) resCorrect.textContent = `${state.correct}/${QUESTIONS_PER_GAME}`;
  if(resAccuracy) resAccuracy.textContent = `${accuracy}%`;
  if(resStreak) resStreak.textContent = String(state.bestStreak);
  if(resSpeed) resSpeed.textContent = state.fastestTime === null ? "–" : `${state.fastestTime.toFixed(1)}s`;
  if(resXp) resXp.textContent = `+${xp} XP`;
  if(resCoins) resCoins.textContent = `+${coins} 🪙`;
  if(scoreRingFill) scoreRingFill.style.strokeDashoffset = String(314 - ((accuracy / 100) * 314));
  if(rankText) rankText.textContent = `You rose ${state.correct >= 3 ? 3 : 1} places to ${heroRank?.textContent || "#14"} this week`;
  if(rankArrow){
    rankArrow.className = `rank-arrow ${state.correct >= 3 ? "up" : "down"}`;
    rankArrow.textContent = state.correct >= 3 ? "▲" : "▼";
  }
  if(mysteryReward) mysteryReward.textContent = accuracy >= 80 ? "+2× XP Boost (24h)" : "Badge Shard";
  if(shareScore) shareScore.textContent = String(state.score);
  if(shareAcc) shareAcc.textContent = `${accuracy}%`;
  if(achievementsRow){
    const items = [];
    if(state.correct > 0) items.push("First Win");
    if(state.bestStreak >= 3) items.push("5 Correct in a Row");
    if(state.fastestTime !== null && state.fastestTime <= 3) items.push("Speed Demon");
    if(accuracy === 100) items.push("Quiz Master");
    achievementsRow.innerHTML = items.map((item) => `<div class="achievement-pill">${item}</div>`).join("");
  }
  refreshSectionProgress();
}

async function submitScoreToBackend(){
  if(!IS_AUTHENTICATED) return null;
  return apiFetch("/api/submit-score/", {
    method:"POST",
    body:{
      category: state.category,
      session_id: state.sessionId,
      answers: state.answers,
      best_streak: state.bestStreak,
    },
  });
}

function showResults(){
  clearInterval(state.timerInterval);
  updateResult();
  showScreen("result-screen");
  window.dispatchEvent(new CustomEvent("sms:quiz-completed", {
    detail: {
      category: state.category,
      score: state.score,
      correct: state.correct,
      xpEarned: state.xpEarned,
    },
  }));
  submitScoreToBackend()
    .then((payload) => {
      const stats = payload?.user_stats || null;
      if(stats && IS_AUTHENTICATED){
        state.totalXP = Number(stats.total_score || state.totalXP || 0);
        QUIZ_PROFILE.totalScore = Number(stats.total_score || 0);
        QUIZ_PROFILE.bestStreak = Number(stats.best_streak || QUIZ_PROFILE.bestStreak || 0);
        QUIZ_PROFILE.globalRank = Number(payload?.global_rank || QUIZ_PROFILE.globalRank || 0);
        QUIZ_PROFILE.league = payload?.league || computeLeagueMeta(QUIZ_PROFILE.totalScore);
      }
      updateTopChrome();
      updateLeague();
      return loadLeaderboards();
    })
    .catch(() => {});
}

function selectAnswer(idx, btn, timedOut){
  if(state.answered) return;
  state.answered = true;
  clearInterval(state.timerInterval);
  const q = state.questions[state.current];
  const correct = idx === q.answerIndex;
  const timeTaken = SECONDS_PER_QUESTION - state.timeLeft;
  const allBtns = document.querySelectorAll(".answer-btn");
  allBtns.forEach((button) => { button.disabled = true; });

  if(correct){
    btn?.classList.add("correct");
    const icon = btn?.querySelector(".answer-result-icon");
    if(icon) icon.textContent = "✓";
    state.correct += 1;
    state.streak += 1;
    state.combo = Math.min(state.combo + 1, 5);
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    state.momentum = Math.min(state.momentum + 20, 100);
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    if(state.fastestTime === null || timeTaken < state.fastestTime) state.fastestTime = timeTaken;
    const speedBonus = timeTaken <= 4 ? 50 : (timeTaken <= 8 ? 25 : 0);
    const comboBonus = state.combo > 1 ? state.combo * 10 : 0;
    const points = 100 + speedBonus + comboBonus;
    state.score += points;
    showFeedback(state.combo >= 3 ? `🔥 Combo ×${state.combo}! +${points} pts` : (timeTaken <= 4 ? `⚡ Perfect! +${points} pts` : `✓ Correct! +${points} pts`), "correct");
  }else{
    if(btn){
      btn.classList.add("incorrect");
      const icon = btn.querySelector(".answer-result-icon");
      if(icon) icon.textContent = "✗";
    }
    const correctBtn = allBtns[q.answerIndex];
    if(correctBtn){
      correctBtn.classList.add("correct");
      const icon = correctBtn.querySelector(".answer-result-icon");
      if(icon) icon.textContent = "✓";
    }
    state.combo = 1;
    state.streak = 0;
    state.momentum = Math.max(state.momentum - 10, 0);
    showFeedback(timedOut ? "⏳ Time’s up" : "✗ So close...", timedOut ? "timeout" : "incorrect");
  }

  state.answers.push({
    questionId: q.id,
    selectedIndex: idx,
    correct,
    timeTaken,
    timedOut,
    difficulty: q.difficulty,
    subcategory: q.subcategory,
  });
  if(liveScore) liveScore.textContent = state.score.toLocaleString();
  updateComboUI();
  renderStreakDots();
  updateTopChrome();

  window.setTimeout(() => {
    if(state.current < QUESTIONS_PER_GAME - 1){
      state.current += 1;
      loadQuestion();
    }else{
      showResults();
    }
  }, AUTO_NEXT_DELAY_MS);
}

function renderAmbientCanvas(){
  const canvas = document.getElementById("ambient-canvas");
  if(!(canvas instanceof HTMLCanvasElement)) return;
  const ctx = canvas.getContext("2d");
  if(!ctx) return;
  let w = 0, h = 0;
  let particles = [];
  function resize(){
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.15,
      a: Math.random(),
      da: 0.003 * (Math.random() > 0.5 ? 1 : -1),
      c: ["rgba(242,202,80,","rgba(167,139,250,","rgba(79,195,247,"][Math.floor(Math.random() * 3)],
    }));
  }
  function draw(){
    ctx.clearRect(0, 0, w, h);
    particles.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.a += p.da;
      if(p.a > 0.8 || p.a < 0) p.da *= -1;
      if(p.x < 0) p.x = w;
      if(p.x > w) p.x = 0;
      if(p.y < 0) p.y = h;
      if(p.y > h) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `${p.c}${p.a})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  resize();
  window.addEventListener("resize", resize);
  draw();
}

function setDailyCard(){
  dailyTitle.textContent = "The Cosmic Alignment Challenge";
  dailySub.textContent = "Limited time · 3× XP bonus · Leaderboard tie-in";
  dailyReward.textContent = "+120 XP";
}

function setCategorySelection(category){
  $$(".section-card").forEach((card) => card.classList.toggle("selected", card.dataset.category === category));
}

playNowBtn?.addEventListener("click", () => {
  const category = state.category || "mythology";
  setCategorySelection(category);
  showQuiz(category);
});

continueBtn?.addEventListener("click", () => {
  const category = state.category || "mythology";
  setCategorySelection(category);
  showQuiz(category);
});

dailyCard?.addEventListener("click", () => {
  const category = state.category || "mythology";
  setCategorySelection(category);
  showQuiz(category);
});
browseStartBtn?.addEventListener("click", () => {
  const category = state.category || "mythology";
  setCategorySelection(category);
  showQuiz(category);
});
browseLeaderboardBtn?.addEventListener("click", () => {
  leaderboardSection?.scrollIntoView({ behavior:"smooth", block:"start" });
});

exitQuizBtn?.addEventListener("click", exitQuiz);
playAgainBtn?.addEventListener("click", () => showQuiz(state.category || "mythology"));
backToHubBtn?.addEventListener("click", exitQuiz);
tryAnotherBtn?.addEventListener("click", exitQuiz);
shareBtn?.addEventListener("click", async () => {
  const text = `I scored ${state.score} in ${state.section} with ${Math.round((state.correct / QUESTIONS_PER_GAME) * 100)}% accuracy on Dharma Trials.`;
  if(navigator.share){
    try{
      await navigator.share({ title:"Dharma Trials", text, url:window.location.href });
      return;
    }catch{}
  }
  try{
    await navigator.clipboard.writeText(text);
    shareBtn.textContent = "Copied";
    setTimeout(() => { shareBtn.textContent = "⬆ Share"; }, 1200);
  }catch{}
});

lbWeekly?.addEventListener("click", () => {
  state.currentPeriod = "weekly";
  lbWeekly.classList.add("active");
  lbAlltime?.classList.remove("active");
  loadLeaderboards().catch(() => {});
});

lbAlltime?.addEventListener("click", () => {
  state.currentPeriod = "alltime";
  lbAlltime.classList.add("active");
  lbWeekly?.classList.remove("active");
  loadLeaderboards().catch(() => {});
});

renderAmbientCanvas();
renderCategoryBrowser();
bindCategoryBrowser();
refreshSectionProgress();
setDailyCard();
updateLeague();
updateTopChrome();
loadLeaderboards().catch(() => {});
