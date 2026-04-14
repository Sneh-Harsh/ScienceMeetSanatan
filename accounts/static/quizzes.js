const QUIZ_BANK = {
  gita: [
    { q:"In the Bhagavad Gita, who is Arjuna’s charioteer during the Kurukshetra war?", opts:["Bhishma","Krishna","Dronacharya","Karna"], ans:1, hint:"Krishna becomes Arjuna’s charioteer and teacher in the Gita." },
    { q:"What does 'Dharma' primarily refer to in the Gita’s context?", opts:["A festival","Duty / righteous path","A weapon","A place"], ans:1, hint:"Dharma is your righteous duty and the path of right action." },
    { q:"Which Yoga does Krishna emphasize as selfless action?", opts:["Bhakti Yoga","Jnana Yoga","Karma Yoga","Raja Yoga"], ans:2, hint:"Karma Yoga is acting without attachment to results." },
    { q:"What is the key message of 'Nishkama Karma'?", opts:["Do nothing at all","Work only for rewards","Do your duty without attachment to results","Avoid responsibilities"], ans:2, hint:"Work sincerely, but don’t cling to outcomes." },
    { q:"Which concept describes the eternal nature of the soul (Atman)?", opts:["Anitya","Nitya","Maya","Samsara"], ans:1, hint:"Nitya means eternal/everlasting." },
    { q:"Krishna advises performing action while being ______ to results.", opts:["attached","angry","detached","confused"], ans:2, hint:"The Gita teaches action with detachment to results." },
  ],
  ramayana: [
    { q:"Who is the author traditionally credited for the Ramayana?", opts:["Valmiki","Vyasa","Tulsidas","Kalidasa"], ans:0, hint:"Maharshi Valmiki is traditionally considered the author." },
    { q:"What is the name of Lord Rama’s wife?", opts:["Draupadi","Sita","Rukmini","Kunti"], ans:1, hint:"Sita is Lord Rama’s wife." },
    { q:"Who is the devoted vanara who leaps to Lanka?", opts:["Sugriva","Vibhishana","Hanuman","Jambavan"], ans:2, hint:"Hanuman is known for his devotion and strength." },
    { q:"Which kingdom is associated with Lord Rama’s rule?", opts:["Dwarka","Ayodhya","Hastinapur","Mathura"], ans:1, hint:"Rama is the prince/king of Ayodhya." },
    { q:"What is 'Maryada Purushottam' associated with?", opts:["Ravana","Rama","Bharata","Lakshmana"], ans:1, hint:"It is a title for Lord Rama, symbolizing ideal conduct." },
  ],
  mahabharata: [
    { q:"Who composed the Mahabharata according to tradition?", opts:["Valmiki","Vyasa","Tulsidas","Chanakya"], ans:1, hint:"Maharshi Vyasa is traditionally credited." },
    { q:"How many Pandavas are there?", opts:["3","5","7","9"], ans:1, hint:"There are five Pandavas." },
    { q:"Who is the eldest Pandava?", opts:["Arjuna","Bhima","Yudhishthira","Nakula"], ans:2, hint:"Yudhishthira is the eldest and known for righteousness." },
    { q:"Which war is central to the Mahabharata?", opts:["Kurukshetra War","Lanka War","Kalinga War","Trojan War"], ans:0, hint:"The epic centers around the Kurukshetra war." },
    { q:"Which character is known as 'Vrkodara'?", opts:["Bhima","Arjuna","Karna","Duryodhana"], ans:0, hint:"Bhima is called Vrkodara (wolf-bellied)." },
  ],
  vedic_science: [
    { q:"In traditional Indian thought, which element is associated with space?", opts:["Prithvi","Jala","Akasha","Agni"], ans:2, hint:"Akasha refers to ether/space in Pancha Mahabhutas." },
    { q:"What does 'Yoga' literally mean?", opts:["Union","Separation","Food","Weapon"], ans:0, hint:"Yoga means union (yuj)." },
    { q:"Which text is a foundational work of Ayurveda?", opts:["Charaka Samhita","Arthashastra","Natya Shastra","Meghaduta"], ans:0, hint:"Charaka Samhita is a core Ayurvedic text." },
    { q:"Which is NOT one of the Pancha Mahabhutas?", opts:["Akasha","Vayu","Manas","Agni"], ans:2, hint:"Manas (mind) is not among the five great elements." },
    { q:"Surya Siddhanta is traditionally associated with which domain?", opts:["Astronomy","Cooking","Poetry","Dance"], ans:0, hint:"Surya Siddhanta is a classic work on astronomy." },
  ],
};

const CATEGORY_META = {
  gita:{ name:"Bhagavad Gita", icon:"📜", accent:"gold-accent", progress:65, plays:"1,240 plays", reward:"+120 XP" },
  ramayana:{ name:"Ramayana", icon:"🏹", accent:"blue-accent", progress:20, plays:"876 plays", reward:"+120 XP" },
  mahabharata:{ name:"Mahabharata", icon:"🛡️", accent:"violet-accent", progress:45, plays:"2,100 plays", reward:"+120 XP" },
  vedic_science:{ name:"Vedic Science", icon:"🔬", accent:"copper-accent", progress:10, plays:"430 plays", reward:"+120 XP" },
};

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
  coins: Number(localStorage.getItem("smsQuizCoins") || "0"),
  totalXP: Number(localStorage.getItem("smsQuizXP") || "0"),
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
const leaderboardLoading = $("#leaderboardLoading");
const leaderboardEmpty = $("#leaderboardEmpty");
const leaderboardError = $("#leaderboardError");
const leaderboardSub = $("#leaderboardSub");
const leaderboardPodium = $("#leaderboardPodium");
const leaderboardRows = $("#leaderboardRows");
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
    if(fill) fill.style.width = `${pct}%`;
    if(label) label.textContent = `${pct}% complete`;
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
  const totalAttempts = state.answers.length;
  const accuracy = totalAttempts ? Math.round((state.correct / totalAttempts) * 100) : 0;
  if(heroAccuracy) heroAccuracy.textContent = `${accuracy}%`;
  if(heroStreak) heroStreak.textContent = String(state.bestStreak || 0);
  if(navStreak) navStreak.textContent = String(state.bestStreak || 0);
  if(navXp) navXp.textContent = `${state.totalXP} XP`;
  if(navCoins) navCoins.textContent = String(state.coins);
}

function setLeaderboardState({ loading = false, empty = false, error = false, ready = false } = {}){
  if(leaderboardLoading){
    leaderboardLoading.hidden = !loading;
    leaderboardLoading.setAttribute("aria-hidden", loading ? "false" : "true");
  }
  if(leaderboardEmpty) leaderboardEmpty.hidden = !empty;
  if(leaderboardError) leaderboardError.hidden = !error;
  if(leaderboardPodium) leaderboardPodium.hidden = !ready;
  if(leaderboardRows) leaderboardRows.hidden = !ready;
}

function avatarLetter(username){
  const text = String(username || "").trim();
  return text ? text[0].toUpperCase() : "—";
}

function setPodium(place, row){
  const avatarEl = leaderboardPodium?.querySelector(`[data-avatar="${place}"]`);
  const nameEl = leaderboardPodium?.querySelector(`[data-name="${place}"]`);
  const scoreEl = leaderboardPodium?.querySelector(`[data-score="${place}"]`);
  const username = row?.username || "—";
  if(avatarEl) avatarEl.textContent = avatarLetter(username);
  if(nameEl) nameEl.textContent = username;
  if(scoreEl) scoreEl.textContent = String(row?.score ?? place);
}

function renderRows(rows){
  if(!leaderboardRows) return;
  leaderboardRows.innerHTML = "";
  rows.forEach((row, index) => {
    const div = document.createElement("div");
    div.className = "lb-entry";
    div.innerHTML = `
      <div class="lb-rank">${index + 4}</div>
      <div class="lb-avatar" style="background:rgba(167,139,250,0.15);color:var(--violet)">${avatarLetter(row.username)}</div>
      <div class="lb-info"><div class="lb-name">${row.username}</div><div class="lb-title">Wisdom Seeker</div></div>
      <div class="lb-score"><div class="lb-score-val">${row.score}</div><div class="lb-score-lab">Karma</div></div>
    `;
    leaderboardRows.appendChild(div);
  });
}

async function loadLeaderboard(categoryOrNull){
  const url = categoryOrNull ? `/api/leaderboard/${categoryOrNull}/` : "/api/leaderboard/";
  setLeaderboardState({ loading:true });
  try{
    const rows = await apiFetch(url);
    const list = Array.isArray(rows) ? rows : [];
    if(!list.length){
      setLeaderboardState({ empty:true });
      if(heroRank) heroRank.textContent = "#—";
      if(navRank) navRank.textContent = "#—";
      if(shareRank) shareRank.textContent = "#—";
      return;
    }
    setPodium(1, list[0] || null);
    setPodium(2, list[1] || null);
    setPodium(3, list[2] || null);
    renderRows(list.slice(3, 10));
    setLeaderboardState({ ready:true });
    const myRank = Math.min(list.length, 14);
    if(heroRank) heroRank.textContent = `#${myRank}`;
    if(navRank) navRank.textContent = `#${myRank}`;
    if(shareRank) shareRank.textContent = `#${myRank}`;
  }catch(error){
    setLeaderboardState({ error:true });
  }
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
  state.answered = false;
  if(qCurrent) qCurrent.textContent = String(state.current + 1);
  if(qNumber) qNumber.textContent = `Question ${state.current + 1}`;
  if(qText) qText.textContent = q.q;
  if(quizProgressFill) quizProgressFill.style.width = `${(state.current / QUESTIONS_PER_GAME) * 100}%`;
  if(questionCard){
    questionCard.style.animation = "none";
    void questionCard.offsetHeight;
    questionCard.style.animation = "slideInCard 0.4s ease";
  }
  if(answersGrid){
    answersGrid.innerHTML = "";
    const keys = ["A","B","C","D"];
    q.opts.forEach((opt, i) => {
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

function showQuiz(category){
  const meta = CATEGORY_META[category];
  if(!meta) return;
  state.category = category;
  state.section = meta.name;
  state.questions = shuffle([...(QUIZ_BANK[category] || [])]).slice(0, QUESTIONS_PER_GAME);
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
  if(leaderboardSub) leaderboardSub.textContent = `Top learners in ${meta.name}.`;
  showScreen("quiz-screen");
  loadLeaderboard(category).catch(() => {});
  loadQuestion();
}

function exitQuiz(){
  clearInterval(state.timerInterval);
  showScreen("hub-screen");
  loadLeaderboard(null).catch(() => {});
}

function updateLeague(){
  let pct = 18;
  let label = "Bronze League";
  let toward = "→ Silver in 250 pts";
  if(state.totalXP >= 1200){ pct = 85; label = "Gold League"; toward = "→ Diamond in 1,200 pts"; }
  else if(state.totalXP >= 600){ pct = 54; label = "Silver League"; toward = "→ Gold in 600 pts"; }
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
  state.totalXP += xp;
  state.coins += coins;
  localStorage.setItem("smsQuizXP", String(state.totalXP));
  localStorage.setItem("smsQuizCoins", String(state.coins));
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
  updateTopChrome();
  updateLeague();
  refreshSectionProgress();
}

async function submitScoreToBackend(){
  await apiFetch("/api/submit-score/", {
    method:"POST",
    body:{
      category: state.category,
      score: state.correct,
      total: QUESTIONS_PER_GAME,
      best_streak: state.bestStreak,
    },
  });
}

function showResults(){
  clearInterval(state.timerInterval);
  updateResult();
  showScreen("result-screen");
  submitScoreToBackend()
    .then(() => loadLeaderboard(null))
    .catch(() => {});
}

function selectAnswer(idx, btn, timedOut){
  if(state.answered) return;
  state.answered = true;
  clearInterval(state.timerInterval);
  const q = state.questions[state.current];
  const correct = idx === q.ans;
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
    const correctBtn = allBtns[q.ans];
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

  state.answers.push({ idx, correct, timeTaken, timedOut });
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

$$(".section-card").forEach((card) => {
  card.addEventListener("click", () => {
    const category = card.dataset.category;
    if(!category) return;
    state.category = category;
    setCategorySelection(category);
    leaderboardSub.textContent = `Top learners in ${CATEGORY_META[category].name}.`;
    showQuiz(category);
  });
});

playNowBtn?.addEventListener("click", () => {
  const category = state.category || "gita";
  setCategorySelection(category);
  showQuiz(category);
});

continueBtn?.addEventListener("click", () => {
  const category = state.category || "gita";
  setCategorySelection(category);
  showQuiz(category);
});

dailyCard?.addEventListener("click", () => {
  const category = state.category || "gita";
  setCategorySelection(category);
  showQuiz(category);
});

exitQuizBtn?.addEventListener("click", exitQuiz);
playAgainBtn?.addEventListener("click", () => showQuiz(state.category || "gita"));
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
  lbWeekly.classList.add("active");
  lbAlltime?.classList.remove("active");
  loadLeaderboard(state.category || "gita").catch(() => {});
});

lbAlltime?.addEventListener("click", () => {
  lbAlltime.classList.add("active");
  lbWeekly?.classList.remove("active");
  loadLeaderboard(null).catch(() => {});
});

renderAmbientCanvas();
refreshSectionProgress();
setDailyCard();
updateLeague();
updateTopChrome();
loadLeaderboard(null).catch(() => {});
