const API_URL = "/api/panchang";

const els = {
  root: document.querySelector("#panchangRoot"),
  heroScene: document.querySelector("#heroScene"),
  heroParallax: document.querySelector(".hero-shell"),
  sky: document.querySelector("#sky"),
  glyphField: document.querySelector("#glyphField"),
  stars: document.querySelector("#stars"),
  clouds: document.querySelector("#clouds"),
  rain: document.querySelector("#rain"),
  sun: document.querySelector("#sun"),
  moonDisc: document.querySelector("#moonDisc"),
  birds: document.querySelector("#birds"),

  locPrompt: document.querySelector("#locPrompt"),
  locAllowBtn: document.querySelector("#locAllowBtn"),
  locDefaultBtn: document.querySelector("#locDefaultBtn"),
  placeSearchInput: document.querySelector("#placeSearchInput"),
  placeSearchBtn: document.querySelector("#placeSearchBtn"),
  placeSearchResults: document.querySelector("#placeSearchResults"),
  changeLocBtn: document.querySelector("#changeLocBtn"),
  weatherPill: document.querySelector("#weatherPill"),
  tempPill: document.querySelector("#tempPill"),

  liveClock: document.querySelector("#liveClock"),
  heroGreeting: document.querySelector("#heroGreeting"),
  heroDate: document.querySelector("#heroDate"),
  heroLine1: document.querySelector("#heroLine1"),
  heroLine2: document.querySelector("#heroLine2"),
  heroMeta: document.querySelector("#heroMeta"),
  heroPlaceName: document.querySelector("#heroPlaceName"),
  heroCoords: document.querySelector("#heroCoords"),
  heroDescription: document.querySelector("#heroDescription"),
  heroNakshatra: document.querySelector("#heroNakshatra"),
  heroMetricTithi: document.querySelector("#heroMetricTithi"),
  heroMetricNak: document.querySelector("#heroMetricNak"),
  heroMetricRahu: document.querySelector("#heroMetricRahu"),
  heroMetricMoon: document.querySelector("#heroMetricMoon"),
  focusModeBtn: document.querySelector("#focusModeBtn"),
  reminderToggle: document.querySelector("#reminderToggle"),
  reminderList: document.querySelector("#reminderList"),
  aiInsightText: document.querySelector("#aiInsightText"),
  aiInsightStatus: document.querySelector("#aiInsightStatus"),
  aiInsightRefresh: document.querySelector("#aiInsightRefresh"),
  timelineBar: document.querySelector("#timelineBar"),
  timelineDetail: document.querySelector("#timelineDetail"),
  energyFluxMeta: document.querySelector("#energyFluxMeta"),
  energyFluxBars: document.querySelector("#energyFluxBars"),
  recommendationsList: document.querySelector("#recommendationsList"),
  peakWindowTitle: document.querySelector("#peakWindowTitle"),
  peakWindowTime: document.querySelector("#peakWindowTime"),
  peakWindowCopy: document.querySelector("#peakWindowCopy"),
  sageQuoteText: document.querySelector("#sageQuoteText"),
  sageQuoteAuthor: document.querySelector("#sageQuoteAuthor"),
  sagePrevBtn: document.querySelector("#sagePrevBtn"),
  sageNextBtn: document.querySelector("#sageNextBtn"),

  loadingCard: document.querySelector("#loadingCard"),
  errorCard: document.querySelector("#errorCard"),
  errorText: document.querySelector("#errorText"),
  cards: document.querySelector("#cards"),

  sunriseVal: document.querySelector("#sunriseVal"),
  sunsetVal: document.querySelector("#sunsetVal"),
  tithiVal: document.querySelector("#tithiVal"),
  tithiSub: document.querySelector("#tithiSub"),
  nakVal: document.querySelector("#nakVal"),
  nakSub: document.querySelector("#nakSub"),
  pakshaVal: document.querySelector("#pakshaVal"),
  monthVal: document.querySelector("#monthVal"),
  heroMoonSvg: document.querySelector("#heroMoonSvg"),
  heroMoonPct: document.querySelector("#heroMoonPct"),
  heroMoonSub: document.querySelector("#heroMoonSub"),
  moonSvg: document.querySelector("#moonSvg"),
  moonPct: document.querySelector("#moonPct"),
  moonSub: document.querySelector("#moonSub"),
  rahuVal: document.querySelector("#rahuVal"),

  calPrevBtn: document.querySelector("#calPrevBtn"),
  calNextBtn: document.querySelector("#calNextBtn"),
  calTodayBtn: document.querySelector("#calTodayBtn"),
  calMonth: document.querySelector("#calMonth"),
  calYear: document.querySelector("#calYear"),
  calGrid: document.querySelector("#calGrid"),

  dayOverlay: document.querySelector("#dayOverlay"),
  dayOverlayBackdrop: document.querySelector("#dayOverlayBackdrop"),
  ovPanel: document.querySelector("#dayOverlayPanel"),
  ovTitle: document.querySelector("#ovTitle"),
  ovCloseBtn: document.querySelector("#ovCloseBtn"),
  ovChips: document.querySelector("#ovChips"),
  ovLoading: document.querySelector("#ovLoading"),
  ovError: document.querySelector("#ovError"),
  ovErrorText: document.querySelector("#ovErrorText"),
  ovGrid: document.querySelector("#ovGrid"),
  ovFest: document.querySelector("#ovFest"),
  ovPrevBtn: document.querySelector("#ovPrevBtn"),
  ovNextBtn: document.querySelector("#ovNextBtn"),

  coreFestBtn: document.querySelector("#coreFestBtn"),
  coreFestOverlay: document.querySelector("#coreFestOverlay"),
  coreFestBackdrop: document.querySelector("#coreFestBackdrop"),
  coreFestCloseBtn: document.querySelector("#coreFestCloseBtn"),
  coreFestChips: document.querySelector("#coreFestChips"),
  coreFestLoading: document.querySelector("#coreFestLoading"),
  coreFestError: document.querySelector("#coreFestError"),
  coreFestErrorText: document.querySelector("#coreFestErrorText"),
  coreFestList: document.querySelector("#coreFestList"),

  auspiciousYear: document.querySelector("#auspiciousYear"),
  kharmasStatus: document.querySelector("#kharmasStatus"),
  kharmasTitle: document.querySelector("#kharmasTitle"),
  kharmasMeta: document.querySelector("#kharmasMeta"),
  kharmasNote: document.querySelector("#kharmasNote"),
  kharmasTimeline: document.querySelector("#kharmasTimeline"),
  marriageCount: document.querySelector("#marriageCount"),
  marriageNextDate: document.querySelector("#marriageNextDate"),
  marriageNextMeta: document.querySelector("#marriageNextMeta"),
  marriageNextWindow: document.querySelector("#marriageNextWindow"),
  marriageTopThree: document.querySelector("#marriageTopThree"),
  marriageNotes: document.querySelector("#marriageNotes"),
  marriageTimeline: document.querySelector("#marriageTimeline"),
};

function pad2(n){ return String(n).padStart(2,"0"); }

function getBrowserTz(){
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
}

function formatClock(d){
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

const _timeFmtCache = new Map(); // key -> Intl.DateTimeFormat
function _getTimeFmt(tzName, hour12){
  const tz = tzName || getBrowserTz();
  const key = `${tz}|${hour12 ? "12" : "24"}`;
  if(_timeFmtCache.has(key)) return _timeFmtCache.get(key);
  const fmt = hour12
    ? new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true })
    : new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  _timeFmtCache.set(key, fmt);
  return fmt;
}

function formatTime(iso, tzName){
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return "—";
  return _getTimeFmt(tzName, false).format(d);
}

function formatTime12(iso, tzName){
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return "—";
  return _getTimeFmt(tzName, true).format(d);
}

const _dateTimeFmtCache = new Map(); // tz -> Intl.DateTimeFormat
function _getDateTimeFmt(tzName){
  const tz = tzName || getBrowserTz();
  if(_dateTimeFmtCache.has(tz)) return _dateTimeFmtCache.get(tz);
  const fmt = new Intl.DateTimeFormat(undefined, {
    timeZone: tz,
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  _dateTimeFmtCache.set(tz, fmt);
  return fmt;
}

function formatDateTime12(iso, tzName){
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return "—";
  return _getDateTimeFmt(tzName).format(d);
}

function formatDateLong(dateStr){
  const d = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat(undefined, { weekday:"long", day:"2-digit", month:"long", year:"numeric" }).format(d);
}

function formatDateShort(dateStr){
  const d = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat(undefined, { day:"2-digit", month:"short", year:"numeric" }).format(d);
}

function todayIsoInTz(tzName){
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tzName || getBrowserTz(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.filter((part)=> part.type !== "literal").map((part)=> [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function clamp01(n){ return Math.max(0, Math.min(1, n)); }

function fmtNumber(n){
  return Number.isFinite(Number(n)) ? Number(n).toFixed(4) : "—";
}

function getUserName(){
  const raw = els.root?.dataset?.userName || "Sneh";
  const first = String(raw).trim().split(/\s+/)[0];
  return first || "Sneh";
}

function getGreeting(date = new Date()){
  const hour = date.getHours();
  if(hour < 12) return "Good Morning";
  if(hour < 17) return "Good Afternoon";
  if(hour < 21) return "Good Evening";
  return "Good Night";
}

function setGreeting(){
  if(!els.heroGreeting) return;
  els.heroGreeting.textContent = `${getGreeting(new Date())}, ${getUserName()}`;
}

function msOrNull(value){
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function formatRangeShort(a, b, tzName){
  if(!a || !b) return "—";
  return `${formatTime(a, tzName)}–${formatTime(b, tzName)}`;
}

function minutesToLabel(total, tzName = getBrowserTz()){
  const minutes = ((Math.round(total) % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return _getTimeFmt(tzName, true).format(d);
}

function setState({loading=false, error=null, ready=false} = {}){
  if(els.loadingCard) els.loadingCard.hidden = !loading;
  if(els.errorCard) els.errorCard.hidden = !error;
  if(els.errorText) els.errorText.textContent = error || "";
  if(els.cards) els.cards.hidden = !ready;
}

function typeText(target, text, speed = 18){
  if(!target) return;
  const next = String(text || "");
  target.textContent = "";
  let index = 0;
  window.clearInterval(target._typingTimer);
  target._typingTimer = window.setInterval(()=>{
    index += 1;
    target.textContent = next.slice(0, index);
    if(index >= next.length){
      window.clearInterval(target._typingTimer);
    }
  }, speed);
}

function buildFallbackInsight(p){
  const parts = [];
  if(p?.tithi){
    parts.push(`Today is shaped by ${p.tithi}`);
  }
  if(p?.nakshatra){
    parts.push(`${p.nakshatra} supports thoughtful action and steadier decisions`);
  }
  if(p?.rahu_start && p?.rahu_end){
    parts.push(`avoid major commitments during Rahu Kaal from ${formatTime(p.rahu_start, p.location?.tz)} to ${formatTime(p.rahu_end, p.location?.tz)}`);
  }
  if(p?.paksha === "Shukla"){
    parts.push("growth-oriented work and prayer feel naturally aligned");
  }else{
    parts.push("reflection, cleanup, and inward focus will feel more natural");
  }
  const sentence = parts.join(". ");
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

function buildHeroDescription(p){
  const parts = [];
  if(p?.paksha && p?.month){
    parts.push(`${p.month} in ${p.paksha} Paksha shapes the overall tone today`);
  }
  if(p?.nakshatra){
    parts.push(`${p.nakshatra} favors measured attention and thoughtful work`);
  }
  if(p?.tithi === "Ekadashi"){
    parts.push("the day is especially supportive for discipline, prayer, and gentle fasting");
  }else if(p?.tithi){
    parts.push(`${p.tithi} supports a steadier rhythm than impulsive action`);
  }
  return `${parts.join(". ")}.`.replace(/\.\./g, ".");
}

function parseHourMinute(iso, tzName){
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tzName,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const hour = Number(parts.find((part)=> part.type === "hour")?.value ?? NaN);
  const minute = Number(parts.find((part)=> part.type === "minute")?.value ?? NaN);
  if(!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function segmentScore({ start, end, sunriseMin, sunsetMin, rahuStartMin, rahuEndMin, moonPct, paksha }) {
  const duration = Math.max(1, end - start);
  const mid = start + duration / 2;
  let score = 62;
  if(mid >= sunriseMin && mid <= sunriseMin + 150) score += 15;
  if(mid >= sunsetMin - 105 && mid <= sunsetMin + 60) score += 10;
  if(mid >= rahuStartMin && mid <= rahuEndMin) score -= 30;
  if(mid > 720 && mid < 930) score += 6;
  if(mid > 60 && mid < 300) score += 4;
  if((paksha || "").toLowerCase().includes("shukla")) score += 4;
  score += Math.round((moonPct - 50) / 12);
  return Math.max(18, Math.min(96, score));
}

function buildEnergyFlux(p){
  const tzName = p?.location?.tz || getBrowserTz();
  const sunriseMin = parseHourMinute(p?.sunrise, tzName) ?? 360;
  const sunsetMin = parseHourMinute(p?.sunset, tzName) ?? 1080;
  const rahuStartMin = parseHourMinute(p?.rahu_start, tzName) ?? 780;
  const rahuEndMin = parseHourMinute(p?.rahu_end, tzName) ?? 870;
  const moonPct = Math.round(clamp01(p?.moon_phase) * 100);
  const dayDuration = Math.max(600, sunsetMin - sunriseMin);
  const dayPart = dayDuration / 5;
  const nextSunriseMin = sunriseMin + 24 * 60;
  const nightDuration = Math.max(540, nextSunriseMin - sunsetMin);
  const nightQuarter = nightDuration / 4;
  const nishitaMid = sunsetMin + nightDuration / 2;
  const muhurt = 48;
  const bands = [
    { key: "brahma", label: "Brahma Muhurta", start: sunriseMin - 96, end: sunriseMin - 48 },
    { key: "pratah", label: "Pratah", start: sunriseMin, end: sunriseMin + dayPart },
    { key: "sangava", label: "Sangava", start: sunriseMin + dayPart, end: sunriseMin + dayPart * 2 },
    { key: "madhyahna", label: "Madhyahna", start: sunriseMin + dayPart * 2, end: sunriseMin + dayPart * 3 },
    { key: "aparahna", label: "Aparahna", start: sunriseMin + dayPart * 3, end: sunriseMin + dayPart * 4 },
    { key: "sayam", label: "Sayam", start: sunriseMin + dayPart * 4, end: sunsetMin },
    { key: "pradosha", label: "Pradosha", start: sunsetMin, end: sunsetMin + nightQuarter },
    { key: "nishita", label: "Nishita", start: nishitaMid - muhurt / 2, end: nishitaMid + muhurt / 2 },
  ];

  return bands.map((band)=>{
    const score = segmentScore({
      start: band.start,
      end: band.end,
      sunriseMin,
      sunsetMin,
      rahuStartMin,
      rahuEndMin,
      moonPct,
      paksha: p?.paksha,
    });
    return {
      ...band,
      score,
      time: `${minutesToLabel(band.start, tzName)}–${minutesToLabel(band.end, tzName)}`,
      tone: score >= 82 ? "high" : score >= 60 ? "medium" : "low",
    };
  });
}

function hydrateEnergyFlux(p){
  if(!els.energyFluxBars) return;
  const flux = buildEnergyFlux(p);
  els.energyFluxBars.innerHTML = flux.map((band)=> `
    <div class="energy-flux__bar energy-flux__bar--${band.tone}" data-score="${band.score}">
      <i style="--energy:${band.score}%"></i>
      <span>${escapeHtml(band.label)}</span>
      <small>${escapeHtml(band.time)}</small>
    </div>
  `).join("");
  if(els.energyFluxMeta){
    els.energyFluxMeta.textContent = `${p.month} • ${p.tithi} • ${p.paksha}`;
  }
  const peak = [...flux].sort((a, b)=> b.score - a.score)[0];
  if(els.peakWindowTitle) els.peakWindowTitle.textContent = `${peak.label} is strongest`;
  if(els.peakWindowTime) els.peakWindowTime.textContent = peak.time;
  if(els.peakWindowCopy){
    els.peakWindowCopy.textContent = `${peak.label} carries the cleanest rhythm today for focused work, prayer, and deliberate decisions.`;
  }
}

function buildRecommendations(p){
  const tags = [p?.tithi, p?.nakshatra, p?.paksha, p?.month].filter(Boolean).map((v)=> String(v).toLowerCase());
  const matched = LIBRARY_SUGGESTIONS.filter((item)=>
    item.tags.some((tag)=> tags.some((needle)=> String(tag).toLowerCase().includes(needle) || needle.includes(String(tag).toLowerCase())))
  );
  const picks = (matched.length ? matched : LIBRARY_SUGGESTIONS).slice(0, 3);
  return picks.map((item, index)=> {
    const href = item.slug ? `/library/${item.slug}/` : `/library/?q=${encodeURIComponent(item.title)}`;
    const kind = /mantra/i.test(item.title)
      ? "Mantra"
      : /chalisa/i.test(item.title)
        ? "Chalisa"
        : /veda/i.test(item.title)
          ? "Veda"
          : /ramayan|mahabharat|gita/i.test(item.title)
            ? "Book"
            : "Library";
    const rationale = index === 0
      ? `${p?.nakshatra || "Today’s nakshatra"} supports this choice for steadier concentration and devotional reading.`
      : index === 1
        ? `${p?.tithi || "The current tithi"} aligns well with this recitation or reading pattern today.`
        : `${p?.paksha || "The lunar cycle"} makes this a balanced pick for reflection and gentle action.`;
    return {
      tag: kind,
      title: item.title,
      copy: rationale,
      href,
    };
  });
}

function hydrateRecommendations(p){
  if(!els.recommendationsList) return;
  const items = buildRecommendations(p);
  els.recommendationsList.innerHTML = items.map((item, index)=> `
    <article class="recommendation-item">
      <span class="recommendation-item__index">${pad2(index + 1)}</span>
      <div class="recommendation-item__body">
        <div class="recommendation-item__title">${escapeHtml(item.title)}</div>
        <div class="recommendation-item__copy">${escapeHtml(item.copy)}</div>
        <div class="recommendation-item__meta">
          <span class="recommendation-item__tag">${escapeHtml(item.tag)}</span>
          <a class="recommendation-item__link" href="${escapeHtml(item.href)}">Open in Library</a>
        </div>
      </div>
    </article>
  `).join("");
}

function buildSageQuotes(p){
  return [
    {
      quote: `In ${p?.nakshatra || "this sky"}, attention becomes worship when it is steady and undivided.`,
      author: "Acharya V. Sharma · Chronologist",
    },
    {
      quote: `${p?.tithi || "Today’s tithi"} reminds us that disciplined action carries more grace than hurried effort.`,
      author: "Swami Dayanand · Ritual scholar",
    },
    {
      quote: `${p?.paksha || "The current lunar arc"} teaches that timing is not a detail of practice, but part of practice itself.`,
      author: "Rishi Anant · Vedanga commentator",
    },
  ];
}

function renderSageQuote(){
  const item = sageCarouselState.items[sageCarouselState.index];
  if(!item) return;
  if(els.sageQuoteText) typeText(els.sageQuoteText, item.quote, 14);
  if(els.sageQuoteAuthor) els.sageQuoteAuthor.textContent = item.author;
}

function startSageCarousel(p){
  sageCarouselState.items = buildSageQuotes(p);
  sageCarouselState.index = 0;
  window.clearInterval(sageCarouselState.timer);
  renderSageQuote();
  sageCarouselState.timer = window.setInterval(()=>{
    sageCarouselState.index = (sageCarouselState.index + 1) % sageCarouselState.items.length;
    renderSageQuote();
  }, 5200);
}

async function refreshAIInsight(p, { force = false } = {}){
  if(!els.aiInsightText) return;
  const cacheKey = `sms:panchang:insight:${p?.date || "today"}:${fmtNumber(p?.location?.lat)}:${fmtNumber(p?.location?.lon)}`;
  const cached = force ? null : safeStorageGet(cacheKey);
  if(cached?.text){
    typeText(els.aiInsightText, cached.text);
    if(els.aiInsightStatus) els.aiInsightStatus.textContent = "Loaded from today’s cached insight";
    return;
  }

  if(els.aiInsightStatus) els.aiInsightStatus.textContent = "Generating daily guidance…";
  const fallback = buildFallbackInsight(p);
  let finalText = fallback;

  try{
    const endpoint = window.PANCHANG_AI_ENDPOINT || "/api/ai-daily-insight/";
    const controller = new AbortController();
    const timeout = window.setTimeout(()=> controller.abort(), 2800);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        date: p?.date,
        tithi: p?.tithi,
        nakshatra: p?.nakshatra,
        paksha: p?.paksha,
        month: p?.month,
        rahu_start: p?.rahu_start,
        rahu_end: p?.rahu_end,
        location: p?.location,
      }),
      signal: controller.signal,
    });
    window.clearTimeout(timeout);
    if(res.ok){
      const data = await res.json();
      if(typeof data?.insight === "string" && data.insight.trim()){
        finalText = data.insight.trim();
      }
    }
  }catch{}

  safeStorageSet(cacheKey, { text: finalText, created_at: Date.now() });
  typeText(els.aiInsightText, finalText);
  if(els.aiInsightStatus){
    els.aiInsightStatus.textContent = finalText === fallback
      ? "Using fast on-device guidance"
      : "Generated from AI insight service";
  }
}

function buildReminders(p){
  const tzName = p?.location?.tz || getBrowserTz();
  const reminders = [];
  reminders.push({
    tone: "best",
    title: "Best time for पूजा",
    sub: p?.abhijit_start
      ? `${formatRangeShort(p.abhijit_start, p.abhijit_end, tzName)} is especially balanced.`
      : `Sunrise onward till ${formatTime(p?.rahu_start, tzName)} feels cleaner for prayer and planning.`,
  });
  reminders.push({
    tone: "avoid",
    title: "Avoid travel now",
    sub: p?.rahu_start
      ? `Rahu Kaal runs ${formatRangeShort(p.rahu_start, p.rahu_end, tzName)}. Delay risky launches if possible.`
      : "Avoid major launches during unsettled windows today.",
  });
  reminders.push({
    tone: "neutral",
    title: "Good window for focused work",
    sub: p?.tithi_end
      ? `${p.tithi} stays active until ${formatTime(p.tithi_end, tzName)}. Use this continuity for structured tasks.`
      : "Midday hours are better for neutral work, admin, and grounded planning.",
  });
  return reminders;
}

function hydrateReminders(p){
  if(!els.reminderList) return;
  const enabled = localStorage.getItem("sms_panchang_reminders") !== "0";
  const reminders = buildReminders(p);
  if(!enabled){
    els.reminderList.classList.remove("is-active", "is-disabled");
    els.reminderList.innerHTML = "";
    return;
  }
  els.reminderList.classList.add("is-active");
  els.reminderList.innerHTML = reminders.map((item)=> `
    <div class="reminder-item reminder-item--${item.tone}">
      <span class="reminder-item__title">${escapeHtml(item.title)}</span>
      <span class="reminder-item__sub">${escapeHtml(item.sub)}</span>
    </div>
  `).join("");
}

function evaluateReminderMoment(p){
  const tzName = p?.location?.tz || getBrowserTz();
  const now = parseHourMinute(new Date().toISOString(), tzName);
  const rahuStart = parseHourMinute(p?.rahu_start, tzName);
  const rahuEnd = parseHourMinute(p?.rahu_end, tzName);
  const abhijitStart = parseHourMinute(p?.abhijit_start, tzName);
  const abhijitEnd = parseHourMinute(p?.abhijit_end, tzName);
  if(now === null) return null;
  if(rahuStart !== null && rahuEnd !== null && now >= rahuStart && now <= rahuEnd){
    return {
      key: `${p?.date}:avoid`,
      title: "Avoid travel now",
      body: "Rahu Kaal is active. Delay launches or risky decisions if possible.",
    };
  }
  if(abhijitStart !== null && abhijitEnd !== null && now >= abhijitStart && now <= abhijitEnd){
    return {
      key: `${p?.date}:best`,
      title: "Best time for पूजा",
      body: "Abhijit Muhurat is active now. This is a favorable band for prayer and focused action.",
    };
  }
  return null;
}

async function maybeNotifyReminder(p){
  if(localStorage.getItem("sms_panchang_reminders") === "0") return;
  if(!("Notification" in window)) return;
  const moment = evaluateReminderMoment(p);
  if(!moment || reminderRuntime.lastKey === moment.key) return;
  if(Notification.permission === "default"){
    try{ await Notification.requestPermission(); }catch{}
  }
  if(Notification.permission !== "granted") return;
  reminderRuntime.lastKey = moment.key;
  try{
    new Notification(moment.title, { body: moment.body, tag: moment.key });
  }catch{}
}

function scheduleReminderChecks(){
  window.clearInterval(reminderRuntime.timer);
  reminderRuntime.timer = window.setInterval(()=>{
    if(lastLivePanchang) maybeNotifyReminder(lastLivePanchang);
  }, 60_000);
}

function buildTimelineSegments(p){
  const tzName = p?.location?.tz || getBrowserTz();
  const sunrise = msOrNull(p?.sunrise);
  const sunset = msOrNull(p?.sunset);
  const rahuStart = msOrNull(p?.rahu_start);
  const rahuEnd = msOrNull(p?.rahu_end);
  const noon = sunrise && sunset ? sunrise + ((sunset - sunrise) / 2) : null;
  const segments = [];

  if(sunrise && rahuStart && sunrise < rahuStart){
    segments.push({
      tone: "good",
      label: "Sacred start",
      time: `${formatTime(p.sunrise, tzName)}–${formatTime(p.rahu_start, tzName)}`,
      description: "Strong for worship, planning, and calm beginnings before Rahu Kaal opens.",
    });
  }
  if(rahuStart && rahuEnd){
    segments.push({
      tone: "avoid",
      label: "Rahu Kaal",
      time: `${formatTime(p.rahu_start, tzName)}–${formatTime(p.rahu_end, tzName)}`,
      description: "Avoid launches, difficult travel, and irreversible commitments in this band.",
    });
  }
  if(rahuEnd && sunset){
    segments.push({
      tone: "neutral",
      label: noon && rahuEnd < noon ? "Recovery window" : "Steady flow",
      time: `${formatTime(p.rahu_end, tzName)}–${formatTime(p.sunset, tzName)}`,
      description: "Good for execution, reviews, and deliberate progress after the avoid window clears.",
    });
  }
  if(sunset){
    segments.push({
      tone: "good",
      label: "Evening devotion",
      time: `${formatTime(p.sunset, tzName)} onward`,
      description: `${p?.nakshatra || "The lunar mood"} supports softer reflection, prayer, and intentional closure tonight.`,
    });
  }
  return segments.slice(0, 4);
}

function hydrateTimeline(p){
  if(!els.timelineBar || !els.timelineDetail) return;
  const segments = buildTimelineSegments(p);
  els.timelineBar.style.setProperty("--segments", String(Math.max(segments.length, 1)));
  els.timelineBar.innerHTML = segments.map((segment, index)=> `
    <button class="timeline-segment timeline-segment--${segment.tone}${index === 0 ? " is-active" : ""}" type="button" data-index="${index}">
      <span class="timeline-segment__label">${escapeHtml(segment.label)}</span>
      <span class="timeline-segment__time">${escapeHtml(segment.time)}</span>
    </button>
  `).join("");
  els.timelineDetail.textContent = segments[0]?.description || "Today’s time bands will appear here.";
  els.timelineBar.querySelectorAll(".timeline-segment").forEach((button)=>{
    const activate = ()=>{
      els.timelineBar.querySelectorAll(".timeline-segment").forEach((node)=> node.classList.remove("is-active"));
      button.classList.add("is-active");
      const index = Number(button.dataset.index);
      els.timelineDetail.textContent = segments[index]?.description || "";
    };
    button.addEventListener("mouseenter", activate);
    button.addEventListener("focus", activate);
    button.addEventListener("click", activate);
  });
}

function initFocusMode(){
  if(!els.focusModeBtn) return;
  const stored = localStorage.getItem("sms_panchang_focus_mode") === "1";
  document.body.classList.toggle("focus-mode", stored);
  els.focusModeBtn.setAttribute("aria-pressed", stored ? "true" : "false");
  els.focusModeBtn.textContent = stored ? "Exit focus mode" : "Focus mode";
  els.focusModeBtn.addEventListener("click", ()=>{
    const next = !document.body.classList.contains("focus-mode");
    document.body.classList.toggle("focus-mode", next);
    localStorage.setItem("sms_panchang_focus_mode", next ? "1" : "0");
    els.focusModeBtn.setAttribute("aria-pressed", next ? "true" : "false");
    els.focusModeBtn.textContent = next ? "Exit focus mode" : "Focus mode";
  });
}

function initReminderToggle(){
  if(!els.reminderToggle) return;
  const enabled = localStorage.getItem("sms_panchang_reminders") !== "0";
  els.reminderToggle.checked = enabled;
  els.reminderToggle.closest(".hero-toggle")?.classList.toggle("is-on", enabled);
  els.reminderList?.classList.toggle("is-active", enabled);
  els.reminderToggle.addEventListener("change", ()=>{
    localStorage.setItem("sms_panchang_reminders", els.reminderToggle.checked ? "1" : "0");
    els.reminderToggle.closest(".hero-toggle")?.classList.toggle("is-on", els.reminderToggle.checked);
    els.reminderList?.classList.toggle("is-active", els.reminderToggle.checked);
    if(lastLivePanchang) hydrateReminders(lastLivePanchang);
  });
}

function initHeroParallax(){
  if(!els.heroScene || !els.heroParallax || window.matchMedia("(pointer: coarse)").matches) return;
  let raf = null;
  let px = 0;
  let py = 0;

  const commit = ()=>{
    raf = null;
    els.heroParallax.style.setProperty("--px", `${px}px`);
    els.heroParallax.style.setProperty("--py", `${py}px`);
  };

  els.heroScene.addEventListener("mousemove", (e)=>{
    const rect = els.heroScene.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    px = (x - 0.5) * 10;
    py = (y - 0.5) * 10;
    if(!raf) raf = requestAnimationFrame(commit);
  });

  els.heroScene.addEventListener("mouseleave", ()=>{
    px = 0;
    py = 0;
    if(!raf) raf = requestAnimationFrame(commit);
  });
}

function buildStars(){
  if(!els.stars) return;
  els.stars.innerHTML = "";
  const count = 90;
  for(let i=0;i<count;i++){
    const s = document.createElement("div");
    s.className = "star";
    const x = Math.random() * 100;
    const y = Math.random() * 60;
    const size = 0.6 + Math.random() * 1.8;
    const dur = 1.6 + Math.random() * 3.2;
    const delay = Math.random() * 2.2;
    s.style.left = `${x}%`;
    s.style.top = `${y}%`;
    s.style.width = `${size}px`;
    s.style.height = `${size}px`;
    s.style.animationDuration = `${dur}s`;
    s.style.animationDelay = `${delay}s`;
    els.stars.appendChild(s);
  }
}

const glyphState = {
  started: false,
  items: [],
  w: 0,
  h: 0,
  lastT: 0,
};

const sageCarouselState = {
  items: [],
  index: 0,
  timer: null,
};

const reminderRuntime = {
  timer: null,
  lastKey: null,
};

const placeSearchState = {
  timer: null,
  lastQuery: "",
};

const LIBRARY_SUGGESTIONS = [
  { slug: "shiv-aarti", title: "Om Jai Shiv Omkara", tags: ["Shivratri", "Shiva", "Krishna Paksha", "Pradosha", "Meditation"] },
  { slug: "ganesh-aarti", title: "Shree Ganesh Aarti", tags: ["Beginnings", "Planning", "Obstacle removal", "Morning"] },
  { slug: "durga-chalisa", title: "Durga Chalisa", tags: ["Protection", "Strength", "Navratri", "Focus"] },
  { slug: "rigveda-selections", title: "Rigveda Selections", tags: ["Nakshatra", "Wisdom", "Recitation", "Study"] },
  { slug: "ramayan-aranya-kand", title: "Ramayan • Aranya Kand", tags: ["Discipline", "Dharma", "Reflection"] },
  { slug: "mahabharat-gita-updesh", title: "Mahabharat • Gita Updesh", tags: ["Ekadashi", "Duty", "Clarity", "Decision"] },
  { slug: null, title: "Hanuman Chalisa", tags: ["Courage", "Protection", "Strength", "Tuesday"] },
  { slug: null, title: "Mahamrityunjaya Mantra", tags: ["Healing", "Shiva", "Night", "Recovery"] },
  { slug: null, title: "Gayatri Mantra", tags: ["Morning", "Sunrise", "Study", "Purity"] },
  { slug: null, title: "Vishnu Sahasranama", tags: ["Ekadashi", "Shukla Paksha", "Stability"] },
  { slug: null, title: "Aditya Hridayam", tags: ["Vitality", "Sunrise", "Confidence", "Solar"] },
];

function startGlyphField(){
  if(glyphState.started) return;
  if(!els.glyphField) return;
  glyphState.started = true;

  const field = els.glyphField;
  field.innerHTML = "";

  function measure(){
    const rect = field.getBoundingClientRect();
    glyphState.w = Math.max(1, rect.width);
    glyphState.h = Math.max(1, rect.height);
  }
  measure();
  window.addEventListener("resize", measure);

  const glyphs = ["ॐ", "卐", "ॐ", "ॐ", "卐", "ॐ", "卐"];
  const pad = 18;

  glyphState.items = glyphs.map((ch, idx)=>{
    const el = document.createElement("div");
    el.className = ch === "ॐ" ? "glyph glyph--om" : "glyph glyph--swastik";
    el.textContent = ch;
    const size = 22 + Math.random() * 34;
    el.style.fontSize = `${size}px`;
    el.style.opacity = String(0.10 + Math.random() * 0.10);
    field.appendChild(el);

    const x = pad + Math.random() * (glyphState.w - pad * 2);
    const y = pad + Math.random() * (glyphState.h - pad * 2);
    const speed = 10 + Math.random() * 18;
    const ang = Math.random() * Math.PI * 2;
    const vx = Math.cos(ang) * speed;
    const vy = Math.sin(ang) * speed;
    const rot = Math.random() * 360;
    const vr = (Math.random() * 18 - 9); // deg/s

    return {
      id: idx,
      el,
      ch,
      size,
      r: size * 0.52,
      x,
      y,
      vx,
      vy,
      rot,
      vr,
    };
  });

  function tick(t){
    if(!glyphState.started) return;
    if(!glyphState.lastT) glyphState.lastT = t;
    const dt = Math.min(0.04, Math.max(0.0, (t - glyphState.lastT) / 1000));
    glyphState.lastT = t;

    const w = glyphState.w;
    const h = glyphState.h;

    // Move + wall bounce
    glyphState.items.forEach((g)=>{
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.rot += g.vr * dt;

      const minX = pad;
      const maxX = w - pad;
      const minY = pad;
      const maxY = h - pad;

      if(g.x < minX){ g.x = minX; g.vx *= -1; }
      if(g.x > maxX){ g.x = maxX; g.vx *= -1; }
      if(g.y < minY){ g.y = minY; g.vy *= -1; }
      if(g.y > maxY){ g.y = maxY; g.vy *= -1; }
    });

    // Simple collisions (swap velocities)
    for(let i=0;i<glyphState.items.length;i++){
      for(let j=i+1;j<glyphState.items.length;j++){
        const a = glyphState.items[i];
        const b = glyphState.items[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist2 = dx*dx + dy*dy;
        const minDist = (a.r + b.r) * 0.92;
        if(dist2 > 0 && dist2 < minDist * minDist){
          const tmpVx = a.vx;
          const tmpVy = a.vy;
          a.vx = b.vx;
          a.vy = b.vy;
          b.vx = tmpVx;
          b.vy = tmpVy;

          // Push apart a bit to avoid sticking
          const dist = Math.sqrt(dist2);
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (minDist - dist) / 2;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
        }
      }
    }

    // Apply transforms
    glyphState.items.forEach((g)=>{
      g.el.style.transform = `translate3d(${g.x}px, ${g.y}px, 0) rotate(${g.rot}deg)`;
    });

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function setWeather(kind){
  if(!els.clouds || !els.rain || !els.sky) return;
  els.clouds.innerHTML = "";
  els.rain.innerHTML = "";
  if(els.birds) els.birds.innerHTML = "";

  els.sky.classList.toggle("is-rain", kind === "rain");
  els.sky.classList.toggle("is-cloudy", kind === "cloudy");
  els.sky.classList.toggle("is-sunny", kind === "clear");

  if(els.root){
    els.root.dataset.weather = kind;
  }

  if(els.weatherPill){
    const label = kind === "rain" ? "Rain" : kind === "cloudy" ? "Cloudy" : "Sunny";
    els.weatherPill.textContent = `Weather: ${label}`;
  }

  if(kind === "cloudy" || kind === "rain"){
    const defsLR = [
      { top: "-2%", left: "-65%", opacity: 0.88, dur: 34, scale: 1.12 },
      { top: "8%", left: "-75%", opacity: 0.74, dur: 44, scale: 1.28 },
      { top: "18%", left: "-70%", opacity: 0.56, dur: 56, scale: 1.08 },
      { top: "2%", left: "-55%", opacity: 0.44, dur: 62, scale: 1.02 },
    ];
    const defsRL = [
      { top: "1%", left: "95%", opacity: 0.82, dur: 38, scale: 1.20 },
      { top: "12%", left: "105%", opacity: 0.66, dur: 52, scale: 1.34 },
      { top: "20%", left: "110%", opacity: 0.52, dur: 64, scale: 1.10 },
      { top: "6%", left: "100%", opacity: 0.42, dur: 70, scale: 1.02 },
    ];

    function addCloud(def, i, reverse){
      const c = document.createElement("div");
      c.className = reverse ? "cloud cloud--rl" : "cloud";
      c.style.top = def.top;
      c.style.left = def.left;
      c.style.opacity = String(def.opacity);
      c.style.animationDuration = `${def.dur}s`;
      c.style.setProperty("--c-scale", String(def.scale));
      c.style.setProperty("--c-drift-y", `${(i % 2 === 0 ? 10 : -10)}px`);
      c.style.animationDelay = `${-i * 8}s`;
      els.clouds.appendChild(c);
    }

    defsLR.forEach((d, i)=> addCloud(d, i, false));
    defsRL.forEach((d, i)=> addCloud(d, i, true));
  }

  if(kind === "rain"){
    const far = document.createElement("div");
    far.className = "rain-layer rain--far";
    const mid = document.createElement("div");
    mid.className = "rain-layer rain--mid";
    const near = document.createElement("div");
    near.className = "rain-layer rain--near";
    const mist = document.createElement("div");
    mist.className = "rain-mist";
    els.rain.appendChild(far);
    els.rain.appendChild(mid);
    els.rain.appendChild(near);
    els.rain.appendChild(mist);
  }

  if(kind === "clear" && els.birds){
    for(let i=0;i<6;i++){
      const b = document.createElement("div");
      b.className = "bird";
      b.style.top = `${12 + Math.random() * 26}%`;
      b.style.left = `${-10 - Math.random() * 30}%`;
      b.style.opacity = String(0.55 + Math.random() * 0.4);
      b.style.animationDuration = `${12 + Math.random() * 12}s`;
      b.style.animationDelay = `${Math.random() * 6}s`;
      els.birds.appendChild(b);
    }
  }
}

async function fetchWeather(lat, lon){
  try{
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,cloud_cover&timezone=auto`;
    const res = await fetch(url);
    if(!res.ok) return { kind: "clear", tempC: null, tzName: null };
    const data = await res.json();
    const code = Number(data?.current?.weather_code ?? 0);
    const cloud = Number(data?.current?.cloud_cover ?? 0);
    const tempC = Number.isFinite(Number(data?.current?.temperature_2m)) ? Number(data.current.temperature_2m) : null;
    const tzName = typeof data?.timezone === "string" && data.timezone ? data.timezone : null;
    if(code >= 51 && code <= 99) return { kind: "rain", tempC, tzName };
    if(cloud >= 55) return { kind: "cloudy", tempC, tzName };
    return { kind: "clear", tempC, tzName };
  }catch{
    return { kind: "clear", tempC: null, tzName: null };
  }
}

function setTemperature(tempC){
  if(!els.tempPill) return;
  if(tempC === null || !Number.isFinite(Number(tempC))){
    els.tempPill.textContent = "—";
    return;
  }
  els.tempPill.textContent = `${Math.round(Number(tempC))}°C`;
}

function setDayNight(now, sunrise, sunset){
  if(!els.sky) return {isDay:true, dayProgress:0.5};
  const isDay = now >= sunrise && now <= sunset;
  els.sky.classList.toggle("is-night", !isDay);

  const total = sunset - sunrise;
  const p = total > 0 ? (now - sunrise) / total : 0.5;
  const dayProgress = clamp01(p);

  // Sun arc using simple parabola
  const sunX = 10 + dayProgress * 80; // %
  const sunY = 70 - Math.sin(dayProgress * Math.PI) * 52; // %
  els.sky.style.setProperty("--sun-x", `${sunX}%`);
  els.sky.style.setProperty("--sun-y", `${sunY}%`);

  return {isDay, dayProgress};
}

function moonSvgMarkup({illumination, waxing, size=92, prefix="moon"}){
  const frac = clamp01(Number(illumination || 0));
  const r = 50;
  const k = 1 - 2 * frac;
  const offset = (waxing ? 1 : -1) * k * r;
  const glowId = `glow_${prefix}`;
  const maskId = `phaseMask_${prefix}`;
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 120 120" aria-label="Moon phase" role="img">
    <defs>
      <radialGradient id="${glowId}" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stop-color="rgba(255,255,255,.95)"></stop>
        <stop offset="60%" stop-color="rgba(220,230,255,.70)"></stop>
        <stop offset="100%" stop-color="rgba(170,190,255,.25)"></stop>
      </radialGradient>
      <mask id="${maskId}">
        <rect x="0" y="0" width="120" height="120" fill="black"></rect>
        <circle cx="60" cy="60" r="${r}" fill="white"></circle>
        <circle cx="${60 + offset}" cy="60" r="${r}" fill="black"></circle>
      </mask>
    </defs>
    <circle cx="60" cy="60" r="${r}" fill="rgba(15,23,42,.85)"></circle>
    <g mask="url(#${maskId})">
      <circle cx="60" cy="60" r="${r}" fill="url(#${glowId})"></circle>
    </g>
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(200,220,255,.10)" stroke-width="2"></circle>
  </svg>
  `;
}

function startClock(){
  function tick(){
    if(els.liveClock) els.liveClock.textContent = formatClock(new Date());
    setGreeting();
  }
  tick();
  window.setInterval(tick, 1000);
}

let rolloverTimer = null;
function scheduleRolloverRefresh(p){
  if(rolloverTimer) window.clearTimeout(rolloverTimer);
  const now = Date.now();
  const candidates = [Date.parse(p?.tithi_end), Date.parse(p?.nak_end)].filter((ms)=> Number.isFinite(ms));
  if(!candidates.length) return;

  // If already ended (tab slept / clock drift), refresh quickly.
  const alreadyEnded = candidates.some((ms)=> ms <= now - 10_000);
  if(alreadyEnded){
    rolloverTimer = window.setTimeout(()=> initReload(), 250);
    return;
  }

  const future = candidates.filter((ms)=> ms > now);
  if(!future.length) return;
  const next = Math.min(...future);
  const delay = Math.max(1200, next - now + 1500);
  rolloverTimer = window.setTimeout(()=> initReload(), delay);
}

async function loadPanchang(tzOverride){
  const { lat, lon, tz, name } = getSavedLocation();
  const tzName = tzOverride || tz || getBrowserTz();
  const qs = new URLSearchParams({ lat: String(lat), lon: String(lon), tz: tzName });
  const res = await fetch(`${API_URL}?${qs.toString()}`, {headers: {Accept:"application/json"}});
  const contentType = (res.headers.get("Content-Type") || "").toLowerCase();
  const bodyText = await res.text();
  if(!res.ok){
    throw new Error(`API error: ${res.status} ${bodyText.slice(0, 180)}`);
  }
  if(!contentType.includes("application/json")){
    throw new Error(`Unexpected response. ${bodyText.slice(0, 180)}`);
  }
  const payload = JSON.parse(bodyText);
  if(payload?.location && name){
    payload.location.name = name;
  }
  return payload;
}

function hydrateUI(p){
  const tzName = p?.location?.tz || getBrowserTz();
  const saved = getSavedLocation();
  const placeName = p?.location?.name || saved?.name || "Selected location";
  setGreeting();
  if(els.heroDate) els.heroDate.textContent = formatDateLong(p.date);
  if(els.heroLine1) els.heroLine1.textContent = `${p.month} • ${p.paksha}`;
  if(els.heroLine2) els.heroLine2.textContent = `${p.tithi} • Vikram Samvat ${p.vikram_samvat ?? "—"}`;
  if(els.heroPlaceName) els.heroPlaceName.textContent = placeName.split(",").slice(0, 2).join(", ").trim() || placeName;
  if(els.heroCoords) els.heroCoords.textContent = `${fmtNumber(p.location.lat)}, ${fmtNumber(p.location.lon)} • ${p.location.tz}`;
  if(els.heroNakshatra) els.heroNakshatra.textContent = p.nakshatra || "Nakshatra";
  if(els.heroDescription) els.heroDescription.textContent = buildHeroDescription(p);
  if(els.heroMetricTithi) els.heroMetricTithi.textContent = p.tithi || "—";
  if(els.heroMetricNak) els.heroMetricNak.textContent = p.nakshatra || "—";
  if(els.heroMetricRahu) els.heroMetricRahu.textContent = formatRangeShort(p.rahu_start, p.rahu_end, tzName);

  if(els.sunriseVal) els.sunriseVal.textContent = formatTime(p.sunrise, tzName);
  if(els.sunsetVal) els.sunsetVal.textContent = formatTime(p.sunset, tzName);
  if(els.tithiVal) els.tithiVal.textContent = p.tithi;
  if(els.tithiSub) els.tithiSub.textContent = `Ends ${formatDateTime12(p.tithi_end, tzName)}`;
  if(els.nakVal) els.nakVal.textContent = p.nakshatra;
  if(els.nakSub) els.nakSub.textContent = `Ends ${formatDateTime12(p.nak_end, tzName)}`;
  if(els.pakshaVal) els.pakshaVal.textContent = p.paksha;
  if(els.monthVal) els.monthVal.textContent = p.month;

  const moonPct = Math.round(clamp01(p.moon_phase) * 100);
  if(els.heroMoonPct) els.heroMoonPct.textContent = `${moonPct}%`;
  if(els.heroMoonSub) els.heroMoonSub.textContent = p.moon_waxing ? "Waxing phase" : "Waning phase";
  if(els.heroMetricMoon) els.heroMetricMoon.textContent = `${moonPct}%`;
  if(els.moonPct) els.moonPct.textContent = `${moonPct}%`;
  if(els.moonSub) els.moonSub.textContent = p.moon_waxing ? "Waxing" : "Waning";
  if(els.moonSvg) els.moonSvg.innerHTML = moonSvgMarkup({illumination: p.moon_phase, waxing: !!p.moon_waxing, size: 92, prefix: "card"});
  if(els.heroMoonSvg) els.heroMoonSvg.innerHTML = moonSvgMarkup({illumination: p.moon_phase, waxing: !!p.moon_waxing, size: 220, prefix: "hero"});
  if(els.moonDisc){
    els.moonDisc.innerHTML = `<div class="moon-glow"></div>${moonSvgMarkup({illumination: p.moon_phase, waxing: !!p.moon_waxing, size: 170, prefix: "sky"})}`;
  }

  if(els.rahuVal) els.rahuVal.textContent = `${formatTime(p.rahu_start, tzName)}–${formatTime(p.rahu_end, tzName)}`;
  hydrateReminders(p);
  hydrateTimeline(p);
  hydrateEnergyFlux(p);
  hydrateRecommendations(p);
  startSageCarousel(p);
  refreshAIInsight(p);
}

const skyState = {
  started: false,
  sunrise: 0,
  sunset: 0,
  nextSunrise: null,
  nextSunriseFor: null,
  baseDate: null,
  tzName: null,
  lat: null,
  lon: null,
};

function startSkyLoop(p){
  skyState.sunrise = new Date(p.sunrise).getTime();
  skyState.sunset = new Date(p.sunset).getTime();
  skyState.nextSunrise = null;
  skyState.nextSunriseFor = null;
  skyState.baseDate = String(p?.date || "");
  skyState.tzName = String(p?.location?.tz || "") || null;
  skyState.lat = Number.isFinite(Number(p?.location?.lat)) ? Number(p.location.lat) : null;
  skyState.lon = Number.isFinite(Number(p?.location?.lon)) ? Number(p.location.lon) : null;

  if(!skyState.started){
    skyState.started = true;
    (function loop(){
      const now = Date.now();
      const sunrise = skyState.sunrise;
      const sunset = skyState.sunset;
      const isDay = setDayNight(now, sunrise, sunset).isDay;

      // Moon arc after sunset until next sunrise
      if(!isDay){
        const nightStart = sunset;
        const nightEnd = skyState.nextSunrise || (sunrise + 24 * 60 * 60 * 1000);
        const total = nightEnd - nightStart;
        const pN = total > 0 ? (now - nightStart) / total : 0.5;
        const nightProgress = clamp01(pN);

        const moonX = 15 + nightProgress * 70;
        const moonY = 65 - Math.sin(nightProgress * Math.PI) * 44;
        if(els.sky){
          els.sky.style.setProperty("--moon-x", `${moonX}%`);
          els.sky.style.setProperty("--moon-y", `${moonY}%`);
        }

        // Fetch next sunrise once per night for realistic moon movement
        if(now > sunset && !skyState.nextSunriseFor){
          const base = skyState.baseDate || isoDateLocal(new Date());
          const dateStr = stepDate(base, 1);
          skyState.nextSunriseFor = dateStr;
          const { lat, lon, tz } = getSavedLocation();
          const tzName = skyState.tzName || tz || getBrowserTz();
          const qs = new URLSearchParams({
            date: dateStr,
            lat: String(skyState.lat ?? lat),
            lon: String(skyState.lon ?? lon),
            tz: tzName,
          });
          fetch(`${API_URL}?${qs.toString()}`, { headers: { Accept:"application/json" } })
            .then((r)=> r.ok ? r.json() : null)
            .then((j)=> { if(j?.sunrise) skyState.nextSunrise = new Date(j.sunrise).getTime(); })
            .catch(()=>{});
        }
      }
      requestAnimationFrame(loop);
    })();
  }
}

function getSavedLocation(){
  try{
    const raw = localStorage.getItem("sms_panchang_location");
    if(raw){
      const j = JSON.parse(raw);
      const lat = Number(j.lat);
      const lon = Number(j.lon);
      const tz = typeof j.tz === "string" && j.tz ? j.tz : null;
      const name = typeof j.name === "string" && j.name.trim() ? j.name.trim() : null;
      if(Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon, tz, name };
    }
  }catch{}
  return { lat: 28.6139, lon: 77.2090, tz: null, name: "New Delhi, India" };
}

function saveLocation(lat, lon, tz, name){
  const payload = { lat, lon };
  if(tz) payload.tz = tz;
  if(name) payload.name = name;
  localStorage.setItem("sms_panchang_location", JSON.stringify(payload));
}

async function reverseLookupPlace(lat, lon){
  try{
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if(!res.ok) return null;
    const data = await res.json();
    return typeof data?.display_name === "string" && data.display_name.trim() ? data.display_name.trim() : null;
  }catch{
    return null;
  }
}

async function searchPlaces(query){
  const q = String(query || "").trim();
  if(q.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });
  if(!res.ok) throw new Error("Location lookup failed.");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function renderPlaceResults(items){
  if(!els.placeSearchResults) return;
  if(!items.length){
    els.placeSearchResults.innerHTML = `<div class="loc-search-empty">No matching places found.</div>`;
    return;
  }
  els.placeSearchResults.innerHTML = items.map((item)=> `
    <button class="loc-search-result" type="button" data-lat="${escapeHtml(item.lat)}" data-lon="${escapeHtml(item.lon)}" data-name="${escapeHtml(item.display_name || "")}">
      <strong>${escapeHtml((item.display_name || "").split(",").slice(0, 2).join(", "))}</strong>
      <span>${escapeHtml(item.display_name || "")}</span>
    </button>
  `).join("");

  els.placeSearchResults.querySelectorAll(".loc-search-result").forEach((button)=>{
    button.addEventListener("click", ()=>{
      const lat = Number(button.dataset.lat);
      const lon = Number(button.dataset.lon);
      if(!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      saveLocation(lat, lon, null, button.dataset.name || null);
      panchangCache.clear();
      kharmasYearCache.clear();
      marriageYearCache.clear();
      if(els.placeSearchInput) els.placeSearchInput.value = button.dataset.name || "";
      closeLocationPrompt();
      renderCalendar(calendarState.year, calendarState.monthIndex);
      initReload();
      loadAuspiciousPlanner(getAuspiciousYear());
    });
  });
}

function isoDateLocal(d){
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function monthKey(year, monthIndex){
  return `${year}-${pad2(monthIndex + 1)}`;
}

const FESTIVAL_ICONS = {
  Diwali: "🪔",
  Holi: "🎨",
  Shivratri: "🕉️",
  "Maha Shivratri": "🕉️",
  "Maha Shivaratri": "🕉️",
  Navratri: "🌺",
  "Navratri Begins": "🏺",
  "Sharad Navratri Begins": "🏺",
  Dussehra: "🏹",
  Janmashtami: "🦚",
  Ekadashi: "✨",
  Purnima: "🌕",
  Amavasya: "🌑",
};

const panchangCache = new Map(); // key -> payload
const coreFestYearCache = new Map(); // key -> list
const kharmasYearCache = new Map();
const marriageYearCache = new Map();
const PANCHANG_STORAGE_PREFIX = "sms:panchang:day:v1:";
const COREFEST_STORAGE_PREFIX = "sms:panchang:corefest:v2:";

function safeStorageGet(key){
  try{
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }catch{
    return null;
  }
}

function safeStorageSet(key, value){
  try{
    window.localStorage.setItem(key, JSON.stringify(value));
  }catch{}
}

async function fetchPanchangForDate(dateStr, { signal } = {}){
  const { lat, lon, tz } = getSavedLocation();
  const tzName = tz || getBrowserTz();
  const key = `${dateStr}|${Number(lat).toFixed(4)}|${Number(lon).toFixed(4)}|${tzName}`;
  if(panchangCache.has(key)) return panchangCache.get(key);
  const stored = safeStorageGet(PANCHANG_STORAGE_PREFIX + key);
  if(stored){
    panchangCache.set(key, stored);
    return stored;
  }

  const controller = new AbortController();
  const timeoutMs = 18_000;
  const timeoutId = window.setTimeout(()=> controller.abort(), timeoutMs);
  const mergedSignal = signal
    ? (function merge(){
        // Best-effort merge: abort when either aborts.
        const c = new AbortController();
        const abort = ()=> { try{ c.abort(); }catch{} };
        if(signal.aborted) abort();
        else signal.addEventListener("abort", abort, { once: true });
        controller.signal.addEventListener("abort", abort, { once: true });
        return c.signal;
      })()
    : controller.signal;

  const qs = new URLSearchParams({ date: dateStr, lat: String(lat), lon: String(lon), tz: tzName });
  try{
    const res = await fetch(`${API_URL}?${qs.toString()}`, { headers: { Accept:"application/json" }, signal: mergedSignal });
    const contentType = (res.headers.get("Content-Type") || "").toLowerCase();
    const bodyText = await res.text();
    if(!res.ok){
      throw new Error(`API error: ${res.status} ${bodyText.slice(0, 160)}`);
    }
    if(!contentType.includes("application/json")){
      throw new Error(`Unexpected response. ${bodyText.slice(0, 160)}`);
    }
    const j = JSON.parse(bodyText);
    panchangCache.set(key, j);
    safeStorageSet(PANCHANG_STORAGE_PREFIX + key, j);
    return j;
  }catch(err){
    if(String(err?.name || "").toLowerCase() === "aborterror"){
      throw new Error("Request timed out. Please try again.");
    }
    throw err;
  }finally{
    window.clearTimeout(timeoutId);
  }
}

function openCoreFestOverlay(){
  if(!els.coreFestOverlay) return;
  els.coreFestOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  loadCoreFestivals();
}

function closeCoreFestOverlay(){
  if(!els.coreFestOverlay) return;
  els.coreFestOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

async function loadCoreFestivals(){
  if(!els.coreFestLoading || !els.coreFestList) return;
  els.coreFestLoading.hidden = false;
  if(els.coreFestError) els.coreFestError.hidden = true;
  els.coreFestList.hidden = true;
  els.coreFestList.innerHTML = "";

  try{
    const year = Number(els.calYear?.value) || calendarState.year;
    const { lat, lon, tz } = getSavedLocation();
    const tzName = tz || getBrowserTz();
    const cacheKey = `${year}|${Number(lat).toFixed(3)}|${Number(lon).toFixed(3)}|${tzName}`;

    if(els.coreFestChips){
      els.coreFestChips.innerHTML = `
        <span class="chip">${year}</span>
        <span class="chip">${Number(lat).toFixed(3)}, ${Number(lon).toFixed(3)}</span>
        <span class="chip">${escapeHtml(tzName)}</span>
      `;
    }

    let list = coreFestYearCache.get(cacheKey) || null;
    if(!Array.isArray(list) || !list.length){
      const stored = safeStorageGet(COREFEST_STORAGE_PREFIX + cacheKey);
      if(Array.isArray(stored) && stored.length){
        list = stored;
        coreFestYearCache.set(cacheKey, list);
      }
    }
    if(!Array.isArray(list) || !list.length){
      const qs = new URLSearchParams({ year: String(year), lat: String(lat), lon: String(lon), tz: tzName });
      const res = await fetch(`/api/core-festivals-dates/?${qs.toString()}`, { headers: { Accept:"application/json" } });
      const bodyText = await res.text();
      if(!res.ok) throw new Error(`API error: ${res.status} ${bodyText.slice(0, 160)}`);
      const parsed = JSON.parse(bodyText);
      list = Array.isArray(parsed) ? parsed : [];
      coreFestYearCache.set(cacheKey, list);
      safeStorageSet(COREFEST_STORAGE_PREFIX + cacheKey, list);
    }

    const html = list.map((r)=>{
      const dateStr = String(r?.date || "");
      const icon = String(r?.icon || "🎉");
      const name = String(r?.name || "—");
      const month = String(r?.month || "—");
      const paksha = String(r?.paksha || "—");
      const tithi = String(r?.tithi || "—");
      const timeRule = String(r?.time_rule || "sunrise");
      const label = dateStr ? new Intl.DateTimeFormat(undefined, { month:"short", day:"2-digit", year:"numeric" }).format(new Date(dateStr + "T00:00:00")) : "—";
      const rule = `${month} • ${paksha} • ${tithi}${timeRule && timeRule !== "sunrise" ? ` • ${timeRule}` : ""}`;
      return `
        <button class="corefest-item" type="button" data-date="${escapeHtml(dateStr)}">
          <div class="corefest-date">${escapeHtml(label)}</div>
          <div class="corefest-name"><span class="corefest-icon" aria-hidden="true">${escapeHtml(icon)}</span> ${escapeHtml(name)}</div>
          <div class="corefest-rule">${escapeHtml(rule)}</div>
        </button>
      `;
    }).join("");

    els.coreFestLoading.hidden = true;
    els.coreFestList.hidden = false;
    els.coreFestList.innerHTML = html || `<div class="state-text" style="padding:.6rem 0;">No core festivals found.</div>`;

    // Clicking a festival jumps to the day details overlay.
    els.coreFestList.querySelectorAll("[data-date]").forEach((btn)=>{
      btn.addEventListener("click", ()=>{
        const dateStr = btn.getAttribute("data-date") || "";
        if(!dateStr) return;
        closeCoreFestOverlay();
        openDayOverlay(dateStr);
      });
    });
  }catch(err){
    els.coreFestLoading.hidden = true;
    if(els.coreFestError) els.coreFestError.hidden = false;
    if(els.coreFestErrorText) els.coreFestErrorText.textContent = String(err?.message || err);
  }
}

function getAuspiciousYear(){
  const fromPlanner = Number(els.auspiciousYear?.value);
  if(Number.isFinite(fromPlanner) && fromPlanner >= 1600) return fromPlanner;
  const fromCalendar = Number(els.calYear?.value);
  if(Number.isFinite(fromCalendar) && fromCalendar >= 1600) return fromCalendar;
  return new Date().getFullYear();
}

async function fetchKharmasYear(year){
  const { lat, lon, tz } = getSavedLocation();
  const tzName = tz || getBrowserTz();
  const key = `${year}|${Number(lat).toFixed(3)}|${Number(lon).toFixed(3)}|${tzName}`;
  let data = kharmasYearCache.get(key) || null;
  if(data) return data;
  const res = await fetch(`/api/kharmas/?${new URLSearchParams({ year: String(year), lat: String(lat), lon: String(lon), tz: tzName })}`, {
    headers: { Accept: "application/json" },
  });
  const text = await res.text();
  if(!res.ok) throw new Error(`Kharmas API ${res.status}: ${text.slice(0, 140)}`);
  data = JSON.parse(text);
  kharmasYearCache.set(key, data);
  return data;
}

async function fetchMarriageYear(year){
  const { lat, lon, tz } = getSavedLocation();
  const tzName = tz || getBrowserTz();
  const key = `${year}|${Number(lat).toFixed(3)}|${Number(lon).toFixed(3)}|${tzName}`;
  let data = marriageYearCache.get(key) || null;
  if(data) return data;
  const res = await fetch(`/api/marriage-dates/?${new URLSearchParams({ year: String(year), lat: String(lat), lon: String(lon), tz: tzName })}`, {
    headers: { Accept: "application/json" },
  });
  const text = await res.text();
  if(!res.ok) throw new Error(`Marriage API ${res.status}: ${text.slice(0, 140)}`);
  data = JSON.parse(text);
  marriageYearCache.set(key, data);
  return data;
}

function renderKharmas(data){
  if(!els.kharmasTimeline) return;
  const intervals = Array.isArray(data?.intervals) ? data.intervals : [];
  const active = data?.active || intervals.find((item)=> item?.is_active) || null;
  if(els.kharmasStatus) els.kharmasStatus.textContent = active ? "Active now" : "Year map";
  if(els.kharmasTitle) els.kharmasTitle.textContent = active?.name || `Kharmas windows • ${getAuspiciousYear()}`;
  if(els.kharmasMeta){
    els.kharmasMeta.textContent = active
      ? `${active.start_label} → ${active.end_label}`
      : (intervals[0] ? `${intervals.length} solar restraint windows mapped` : "No kharmas interval found.");
  }
  if(els.kharmasNote){
    els.kharmasNote.textContent = active
      ? `${active.name} is active while Surya transits ${active.sun_sign}. This phase traditionally pauses marriages and major saṃskāras until ${active.end_label}.`
      : "Kharmas begins when Surya enters Dhanu or Meena and ends with Makara or Mesha Sankranti.";
  }
  els.kharmasTimeline.innerHTML = intervals.map((item)=> `
    <article class="kharmas-item${item.is_active ? " is-active" : ""}">
      <div class="kharmas-item__head">
        <span class="kharmas-item__badge">${escapeHtml(item.name)}</span>
        <span class="kharmas-item__status">${escapeHtml(item.remaining_label || "")}</span>
      </div>
      <div class="kharmas-item__dates">${escapeHtml(item.start_label)} → ${escapeHtml(item.end_label)}</div>
      <div class="kharmas-item__meta">Surya ${escapeHtml(item.sun_sign)} → ${escapeHtml(item.end_sign)} • ${escapeHtml(String(item.duration_days || "—"))} days</div>
    </article>
  `).join("") || `<div class="state-text">No Kharmas interval found for this year.</div>`;
}

function renderMarriagePlanner(data){
  if(!els.marriageTimeline) return;
  const tzName = getSavedLocation().tz || getBrowserTz();
  const timeline = Array.isArray(data?.timeline)
    ? data.timeline
    : [...(Array.isArray(data?.dates) ? data.dates : [])].sort((a, b)=> String(a?.date || "").localeCompare(String(b?.date || "")));
  const ranked = Array.isArray(data?.top_three) && data.top_three.length
    ? data.top_three
    : [...timeline].sort((a, b)=> (Number(b?.score || 0) - Number(a?.score || 0)) || String(a?.date || "").localeCompare(String(b?.date || ""))).slice(0, 3);
  const todayIso = todayIsoInTz(tzName);
  const plannerYear = getAuspiciousYear();
  let nextUpcoming = data?.next_upcoming || null;
  if(!nextUpcoming){
    if(plannerYear < Number(todayIso.slice(0, 4))){
      nextUpcoming = null;
    }else{
      nextUpcoming = timeline.find((item)=> String(item?.date || "") >= todayIso) || (plannerYear > Number(todayIso.slice(0, 4)) ? timeline[0] || null : null);
    }
  }
  if(els.marriageCount) els.marriageCount.textContent = String(data?.count ?? timeline.length ?? 0);
  if(els.marriageNextDate) els.marriageNextDate.textContent = nextUpcoming?.date_label || "Year completed";
  if(els.marriageNextMeta) els.marriageNextMeta.textContent = nextUpcoming?.reason_line || "No upcoming ceremony-friendly date remains in this year.";
  if(els.marriageNextWindow) els.marriageNextWindow.textContent = nextUpcoming?.window || "—";
  if(els.marriageTopThree){
    els.marriageTopThree.innerHTML = ranked.map((item, index)=> `
      <article class="marriage-rank-card">
        <div class="marriage-rank-card__rank">${escapeHtml(String(item.rank || index + 1))}</div>
        <div class="marriage-rank-card__body">
          <div class="marriage-rank-card__date">${escapeHtml(item.date_label || formatDateShort(item.date || ""))}</div>
          <div class="marriage-rank-card__meta">${escapeHtml(item.grade || "Strong")} • ${escapeHtml(String(item.score || "—"))}/100</div>
        </div>
      </article>
    `).join("") || `<div class="state-text">Top-ranked dates will appear here.</div>`;
  }
  if(els.marriageNotes){
    const notes = Array.isArray(data?.notes) ? data.notes : [];
    els.marriageNotes.innerHTML = notes.map((note)=> `<span class="marriage-note">${escapeHtml(note)}</span>`).join("");
  }
  els.marriageTimeline.innerHTML = timeline.length ? `
    <div class="marriage-wheel__spacer" aria-hidden="true"></div>
    ${timeline.map((item)=> {
      const isPast = String(item?.date || "") < todayIso;
      const isNext = nextUpcoming && String(nextUpcoming?.date || "") === String(item?.date || "");
      return `
        <button class="marriage-timeline-item${isPast ? " is-past" : " is-upcoming"}${isNext ? " is-next" : ""}" type="button" data-date="${escapeHtml(item.date || "")}">
          <span class="marriage-timeline-item__dot" aria-hidden="true"></span>
          <span class="marriage-timeline-item__content">
            <span class="marriage-timeline-item__date">${escapeHtml(item.date_label || formatDateShort(item.date || ""))}</span>
            <span class="marriage-timeline-item__window">${escapeHtml(item.window || "Consult Panchang timing")}</span>
            <span class="marriage-timeline-item__meta">${escapeHtml(item.month || "")} • ${escapeHtml(item.tithi || "")} • ${escapeHtml(item.paksha || "")}</span>
          </span>
        </button>
      `;
    }).join("")}
    <div class="marriage-wheel__spacer" aria-hidden="true"></div>
  ` : `<div class="state-text">No marriage-friendly dates found for this year.</div>`;
  ensureMarriageTimelineWheel();
  centerMarriageTimeline(nextUpcoming?.date || timeline[0]?.date || "");
}

function updateMarriageTimelineState(){
  const viewport = els.marriageTimeline;
  if(!viewport) return;
  const items = [...viewport.querySelectorAll(".marriage-timeline-item")];
  const center = viewport.scrollTop + (viewport.clientHeight / 2);
  items.forEach((item)=>{
    const itemCenter = item.offsetTop + (item.offsetHeight / 2);
    const distance = Math.min(3, Math.abs(center - itemCenter) / Math.max(item.offsetHeight, 1));
    const arc = Math.min(28, distance * 13);
    const scale = Math.max(.82, 1 - (distance * .08));
    const opacity = Math.max(.26, 1 - (distance * .22));
    item.style.setProperty("--wheel-shift", `${arc.toFixed(1)}px`);
    item.style.setProperty("--wheel-scale", scale.toFixed(3));
    item.style.setProperty("--wheel-opacity", opacity.toFixed(3));
    item.classList.toggle("is-centered", distance < .42);
  });
}

function centerMarriageTimeline(dateValue){
  const viewport = els.marriageTimeline;
  if(!viewport || !dateValue) return;
  const target = viewport.querySelector(`.marriage-timeline-item[data-date="${CSS.escape(dateValue)}"]`);
  if(!target) return;
  const top = target.offsetTop - ((viewport.clientHeight - target.offsetHeight) / 2);
  viewport.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  window.requestAnimationFrame(updateMarriageTimelineState);
}

function ensureMarriageTimelineWheel(){
  const viewport = els.marriageTimeline;
  if(!viewport || viewport.dataset.bound === "1") return;
  viewport.dataset.bound = "1";
  let frame = null;
  const onScroll = ()=>{
    if(frame) return;
    frame = window.requestAnimationFrame(()=>{
      frame = null;
      updateMarriageTimelineState();
    });
  };
  viewport.addEventListener("scroll", onScroll, { passive: true });
  viewport.addEventListener("click", (event)=>{
    const target = event.target instanceof Element ? event.target.closest(".marriage-timeline-item") : null;
    if(!target) return;
    centerMarriageTimeline(target.dataset.date || "");
  });
  window.addEventListener("resize", onScroll);
}

async function loadAuspiciousPlanner(year = getAuspiciousYear()){
  if(els.kharmasStatus) els.kharmasStatus.textContent = "Loading…";
  if(els.marriageCount) els.marriageCount.textContent = "…";
  if(els.marriageTopThree) els.marriageTopThree.innerHTML = `<div class="state-text">Ranking the strongest alignments…</div>`;
  if(els.marriageTimeline) els.marriageTimeline.innerHTML = `<div class="state-text">Scanning the sacred year…</div>`;
  if(els.kharmasTimeline) els.kharmasTimeline.innerHTML = `<div class="state-text">Mapping solar transits…</div>`;
  try{
    const [kharmas, marriage] = await Promise.all([
      fetchKharmasYear(year),
      fetchMarriageYear(year),
    ]);
    renderKharmas(kharmas);
    renderMarriagePlanner(marriage);
  }catch(err){
    if(els.kharmasStatus) els.kharmasStatus.textContent = "Unavailable";
    if(els.kharmasTimeline) els.kharmasTimeline.innerHTML = `<div class="state-text">${escapeHtml(String(err?.message || err))}</div>`;
    if(els.marriageTopThree) els.marriageTopThree.innerHTML = `<div class="state-text">${escapeHtml(String(err?.message || err))}</div>`;
    if(els.marriageTimeline) els.marriageTimeline.innerHTML = `<div class="state-text">${escapeHtml(String(err?.message || err))}</div>`;
  }
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll("\"","&quot;")
    .replaceAll("'","&#039;");
}

const calendarState = {
  year: new Date().getFullYear(),
  monthIndex: new Date().getMonth(),
  activeMonthToken: 0,
};

let lastLivePanchang = null;

function syncTodayCalendarCell(){
  if(!lastLivePanchang || !els.calGrid) return;
  const dateStr = String(lastLivePanchang.date || "");
  if(!dateStr) return;
  const cell = els.calGrid.querySelector(`.cal-cell[data-date="${dateStr}"]`);
  if(!cell) return;
  hydrateCalendarCell(dateStr, lastLivePanchang);
}

function ensureCalendarControls(){
  if(!els.calMonth || !els.calYear) return;
  if(els.calMonth.options.length === 0){
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    months.forEach((m, idx)=>{
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = m;
      els.calMonth.appendChild(opt);
    });
  }
  if(els.calYear.options.length === 0){
    const nowY = new Date().getFullYear();
    const start = nowY - 50;
    const end = nowY + 50;
    for(let y=start; y<=end; y++){
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      els.calYear.appendChild(opt);
    }
  }
}

function ensureAuspiciousYearSelect(){
  if(!els.auspiciousYear) return;
  if(els.auspiciousYear.options.length === 0){
    const nowY = new Date().getFullYear();
    for(let y=nowY - 8; y<=nowY + 8; y++){
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      els.auspiciousYear.appendChild(opt);
    }
  }
  if(!els.auspiciousYear.value){
    els.auspiciousYear.value = String(new Date().getFullYear());
  }
}

function startOfMonthGrid(year, monthIndex){
  const first = new Date(year, monthIndex, 1);
  // Monday-first: 0..6
  const dow = (first.getDay() + 6) % 7;
  const start = new Date(year, monthIndex, 1 - dow);
  return start;
}

function renderCalendar(year, monthIndex){
  if(!els.calGrid || !els.calMonth || !els.calYear) return;
  calendarState.year = year;
  calendarState.monthIndex = monthIndex;
  els.calMonth.value = String(monthIndex);
  els.calYear.value = String(year);

  const token = ++calendarState.activeMonthToken;
  els.calGrid.innerHTML = "";
  els.calGrid.classList.remove("cal-anim");
  // force reflow for restartable animation
  void els.calGrid.offsetWidth;
  els.calGrid.classList.add("cal-anim");

  const gridStart = startOfMonthGrid(year, monthIndex);
  const todayStr = isoDateLocal(new Date());
  const datesToLoad = [];

  for(let i=0;i<42;i++){
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const inMonth = d.getMonth() === monthIndex;
    const dateStr = isoDateLocal(d);

    if(inMonth){
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cal-cell";
      btn.dataset.date = dateStr;
      if(dateStr === todayStr) btn.classList.add("is-today");
      btn.innerHTML = `
        <div class="cal-time">—</div>
        <div class="cal-stickers" aria-hidden="true"></div>
        <div class="cal-date">${d.getDate()}</div>
        <div class="cal-tithi">—</div>
      `;
      btn.addEventListener("click", ()=> openDayOverlay(dateStr));
      els.calGrid.appendChild(btn);
      datesToLoad.push(dateStr);
    }else{
      const empty = document.createElement("div");
      empty.className = "cal-cell";
      empty.setAttribute("aria-hidden", "true");
      empty.setAttribute("disabled", "true");
      empty.style.opacity = "0.18";
      empty.style.cursor = "default";
      empty.innerHTML = `<div class="cal-date">${d.getDate()}</div>`;
      els.calGrid.appendChild(empty);
    }
  }

  loadCalendarMonthData(datesToLoad, token);
  // If we've already loaded the live dashboard payload, keep "today" consistent.
  syncTodayCalendarCell();
}

async function loadCalendarMonthData(dateStrs, token){
  const controller = new AbortController();
  const limit = 6;
  let idx = 0;

  async function worker(){
    while(idx < dateStrs.length){
      const my = idx++;
      const dateStr = dateStrs[my];
      if(token !== calendarState.activeMonthToken) return;
      try{
        const p = await fetchPanchangForDate(dateStr, { signal: controller.signal });
        if(token !== calendarState.activeMonthToken) return;
        hydrateCalendarCell(dateStr, p);
      }catch{
        // keep cell usable; show placeholder
        const cell = els.calGrid?.querySelector?.(`.cal-cell[data-date="${dateStr}"]`);
        const t = cell?.querySelector?.(".cal-tithi");
        if(t) t.textContent = "—";
      }
    }
  }

  const workers = [];
  for(let i=0;i<limit;i++) workers.push(worker());
  await Promise.all(workers);
  controller.abort();
}

function hydrateCalendarCell(dateStr, p){
  if(!els.calGrid) return;
  const cell = els.calGrid.querySelector(`.cal-cell[data-date="${dateStr}"]`);
  if(!cell) return;
  const tzName = p?.location?.tz || getSavedLocation()?.tz || getBrowserTz();

  const tt = cell.querySelector(".cal-time");
  if(tt){
    if(p?.tithi_end){
      tt.textContent = `Ends ${formatDateTime12(p.tithi_end, tzName)}`;
      if(p?.tithi_start){
        tt.title = `${formatDateTime12(p.tithi_start, tzName)}–${formatDateTime12(p.tithi_end, tzName)}`;
      }
    }else{
      tt.textContent = "—";
      tt.removeAttribute("title");
    }
  }
  const t = cell.querySelector(".cal-tithi");
  if(t) t.textContent = p?.tithi || "—";

  cell.classList.toggle("is-ekadashi", p?.tithi === "Ekadashi");
  cell.classList.toggle("is-purnima", p?.tithi === "Purnima");
  cell.classList.toggle("is-amavasya", p?.tithi === "Amavasya");

  const stickers = cell.querySelector(".cal-stickers");
  if(stickers){
    stickers.innerHTML = "";
    const details = Array.isArray(p?.festivals_detail) ? p.festivals_detail : null;
    const itemsAll = details ? details : (Array.isArray(p?.festivals) ? p.festivals.map((name)=> ({ name, icon: FESTIVAL_ICONS[name] || "🎉", anim: "glow", source: "unknown" })) : []);
    const coreItems = itemsAll.filter((f)=> String(f?.source || "") === "core");

    cell.classList.toggle("has-core", coreItems.length > 0);
    if(coreItems.length){
      const anim = String(coreItems[0]?.anim || "glow");
      cell.dataset.coreAnim = anim;
      cell.dataset.coreName = String(coreItems[0]?.name || "");
    }else{
      delete cell.dataset.coreAnim;
      delete cell.dataset.coreName;
    }

    coreItems.slice(0, 3).forEach((f)=>{
      const s = document.createElement("div");
      const anim = String(f?.anim || "glow");
      s.className = `sticker sticker--${anim}`;
      s.title = String(f?.name || "");
      s.textContent = String(f?.icon || FESTIVAL_ICONS[f?.name] || "🎉");
      stickers.appendChild(s);
    });

    // Calendar hover media: use first CORE festival only
    const primary = coreItems[0] || null;
    if(primary?.anim){
      cell.dataset.fanim = String(primary.anim);
      cell.dataset.fname = String(primary.name || "");
      cell.dataset.ficon = String(primary.icon || FESTIVAL_ICONS[primary.name] || "🎉");
    }else{
      delete cell.dataset.fanim;
      delete cell.dataset.fname;
      delete cell.dataset.ficon;
    }
  }
}

const overlayState = {
  dateStr: null,
  swipeStart: null,
};

function openDayOverlay(dateStr){
  if(!els.dayOverlay) return;
  overlayState.dateStr = dateStr;
  els.dayOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  loadOverlayDay(dateStr);
}

function closeDayOverlay(){
  if(!els.dayOverlay) return;
  els.dayOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  overlayState.dateStr = null;
}

function stepDate(dateStr, deltaDays){
  const [y,m,d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

async function loadOverlayDay(dateStr){
  if(els.ovTitle) els.ovTitle.textContent = formatDateLong(dateStr);
  if(els.ovChips) els.ovChips.innerHTML = "";
  if(els.ovFest) els.ovFest.innerHTML = "";
  if(els.ovLoading) els.ovLoading.hidden = false;
  if(els.ovError) els.ovError.hidden = true;
  if(els.ovGrid) els.ovGrid.hidden = true;
  if(els.ovGrid) els.ovGrid.innerHTML = "";

  try{
    const p = await fetchPanchangForDate(dateStr);
    if(overlayState.dateStr !== dateStr) return;
    const tzName = p?.location?.tz || getBrowserTz();

    if(els.ovLoading) els.ovLoading.hidden = true;
    if(els.ovGrid) els.ovGrid.hidden = false;

    const chips = [];
    chips.push(`${p.month} • ${p.paksha}`);
    chips.push(`${p.tithi} • ${p.nakshatra}`);
    const festDetails = Array.isArray(p?.festivals_detail) ? p.festivals_detail : null;
    const festivals = festDetails ? festDetails.map((x)=> x?.name).filter(Boolean) : (Array.isArray(p?.festivals) ? p.festivals : []);

    if(els.ovChips){
      els.ovChips.innerHTML = chips.map((c)=> `<span class="chip">${c}</span>`).join("");
    }

    function fmtRange(a, b){
      if(!a || !b) return "—";
      return `${formatDateTime12(a, tzName)}–${formatDateTime12(b, tzName)}`;
    }
    function durHrsMins(ms){
      if(!Number.isFinite(ms) || ms <= 0) return "—";
      const mins = Math.round(ms / 60000);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return h ? `${h}h ${m}m` : `${m}m`;
    }

    const sunriseMs = Date.parse(p.sunrise);
    const sunsetMs = Date.parse(p.sunset);
    const dayLen = Number.isFinite(sunriseMs) && Number.isFinite(sunsetMs) ? (sunsetMs - sunriseMs) : NaN;
    const brahmaStart = Number.isFinite(sunriseMs) ? new Date(sunriseMs - 96 * 60000).toISOString() : null;
    const brahmaEnd = Number.isFinite(sunriseMs) ? new Date(sunriseMs - 48 * 60000).toISOString() : null;

    const rows = [
      ["Vikram Samvat", p.vikram_samvat ? String(p.vikram_samvat) : "—"],
      ["Tithi", p.tithi],
      ["Tithi Time", fmtRange(p.tithi_start, p.tithi_end)],
      ["Nakshatra", p.nakshatra],
      ["Nakshatra Time", fmtRange(p.nak_start, p.nak_end)],
      ["Paksha", p.paksha],
      ["Hindu Month", p.month],
      ["Sunrise", formatTime12(p.sunrise, tzName)],
      ["Sunset", formatTime12(p.sunset, tzName)],
      ["Day Length", durHrsMins(dayLen)],
      ["Brahma Muhurat", brahmaStart ? `${formatTime12(brahmaStart, tzName)}–${formatTime12(brahmaEnd, tzName)}` : "—"],
      ["Rahu Kaal", fmtRange(p.rahu_start, p.rahu_end)],
      ["Abhijit Muhurat", p.abhijit_start ? fmtRange(p.abhijit_start, p.abhijit_end) : "—"],
      ["Moon Phase", `${Math.round(clamp01(p.moon_phase) * 100)}% (${p.moon_waxing ? "Waxing" : "Waning"})`],
      ["Location", p.location ? `${Number(p.location.lat).toFixed(4)}, ${Number(p.location.lon).toFixed(4)} • ${p.location.tz}` : "—"],
    ];
    if(els.ovGrid){
      els.ovGrid.innerHTML = rows.map(([k,v])=> `<div class="ov-row"><div class="ov-row__k">${k}</div><div class="ov-row__v">${v}</div></div>`).join("");
    }

    if(els.ovFest){
      const details = festDetails || festivals.map((name)=> ({ name, icon: FESTIVAL_ICONS[name] || "🎉", description: "Festival day.", anim: "glow" }));
      if(details.length){
        const uniq = [];
        const seen = new Set();
        details.forEach((f)=>{ const n = String(f?.name || "").trim(); if(n && !seen.has(n)){ seen.add(n); uniq.push(f); }});
        const cards = uniq.map((f)=>{
          const anim = String(f?.anim || "glow");
          const icon = String(f?.icon || FESTIVAL_ICONS[f?.name] || "🎉");
          const name = String(f?.name || "");
          const desc = String(f?.description || "Festival day.");
          return `
            <div class="fest-card">
              <div class="fest-anim fest-anim--${anim}" aria-hidden="true">${icon}</div>
              <div class="fest-meta">
                <div class="fest-name">${name}</div>
                <div class="fest-desc">${desc}</div>
              </div>
            </div>
          `;
        }).join("");
        els.ovFest.innerHTML = `<div class="fest-head">Festivals</div><div class="fest-list">${cards}</div>`;
      }else{
        els.ovFest.innerHTML = "";
      }
    }
  }catch(err){
    if(overlayState.dateStr !== dateStr) return;
    if(els.ovLoading) els.ovLoading.hidden = true;
    if(els.ovError) els.ovError.hidden = false;
    if(els.ovErrorText) els.ovErrorText.textContent = String(err?.message || err);
  }
}

function initCalendar(){
  ensureCalendarControls();
  if(els.calPrevBtn){
    els.calPrevBtn.addEventListener("click", ()=>{
      const d = new Date(calendarState.year, calendarState.monthIndex - 1, 1);
      renderCalendar(d.getFullYear(), d.getMonth());
    });
  }
  if(els.calNextBtn){
    els.calNextBtn.addEventListener("click", ()=>{
      const d = new Date(calendarState.year, calendarState.monthIndex + 1, 1);
      renderCalendar(d.getFullYear(), d.getMonth());
    });
  }
  if(els.calTodayBtn){
    els.calTodayBtn.addEventListener("click", ()=>{
      const now = new Date();
      renderCalendar(now.getFullYear(), now.getMonth());
      openDayOverlay(isoDateLocal(now));
    });
  }
  if(els.calMonth){
    els.calMonth.addEventListener("change", ()=>{
      const m = Number(els.calMonth.value);
      renderCalendar(calendarState.year, m);
    });
  }
  if(els.calYear){
    els.calYear.addEventListener("change", ()=>{
      const y = Number(els.calYear.value);
      renderCalendar(y, calendarState.monthIndex);
      if(els.auspiciousYear) els.auspiciousYear.value = String(y);
      loadAuspiciousPlanner(y);
    });
  }

  // Overlay interactions
  if(els.ovCloseBtn) els.ovCloseBtn.addEventListener("click", closeDayOverlay);
  if(els.dayOverlayBackdrop) els.dayOverlayBackdrop.addEventListener("click", closeDayOverlay);
  window.addEventListener("keydown", (e)=>{
    const dayOpen = els.dayOverlay?.getAttribute("aria-hidden") === "false";
    const coreOpen = els.coreFestOverlay?.getAttribute("aria-hidden") === "false";
    if(!dayOpen && !coreOpen) return;
    if(e.key === "Escape"){
      if(dayOpen) closeDayOverlay();
      if(coreOpen) closeCoreFestOverlay();
    }
    if(dayOpen){
      if(e.key === "ArrowLeft" && overlayState.dateStr) openDayOverlay(stepDate(overlayState.dateStr, -1));
      if(e.key === "ArrowRight" && overlayState.dateStr) openDayOverlay(stepDate(overlayState.dateStr, 1));
    }
  });
  if(els.ovPrevBtn) els.ovPrevBtn.addEventListener("click", ()=> overlayState.dateStr && openDayOverlay(stepDate(overlayState.dateStr, -1)));
  if(els.ovNextBtn) els.ovNextBtn.addEventListener("click", ()=> overlayState.dateStr && openDayOverlay(stepDate(overlayState.dateStr, 1)));

  // Core festivals overlay
  if(els.coreFestBtn) els.coreFestBtn.addEventListener("click", openCoreFestOverlay);
  if(els.coreFestCloseBtn) els.coreFestCloseBtn.addEventListener("click", closeCoreFestOverlay);
  if(els.coreFestBackdrop) els.coreFestBackdrop.addEventListener("click", closeCoreFestOverlay);

  if(els.ovPanel){
    els.ovPanel.addEventListener("pointerdown", (e)=>{
      overlayState.swipeStart = { x: e.clientX, y: e.clientY, t: Date.now() };
    });
    els.ovPanel.addEventListener("pointerup", (e)=>{
      if(!overlayState.swipeStart || !overlayState.dateStr) return;
      const dx = e.clientX - overlayState.swipeStart.x;
      const dy = e.clientY - overlayState.swipeStart.y;
      const dt = Date.now() - overlayState.swipeStart.t;
      overlayState.swipeStart = null;
      if(dt > 900) return;
      if(Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy)) return;
      if(dx > 0) openDayOverlay(stepDate(overlayState.dateStr, -1));
      else openDayOverlay(stepDate(overlayState.dateStr, 1));
    });
  }

  const now = new Date();
  renderCalendar(now.getFullYear(), now.getMonth());
}

function openLocationPrompt(){
  if(!els.locPrompt) return;
  syncLocationPromptCtas();
  els.locPrompt.setAttribute("aria-hidden", "false");
}

function closeLocationPrompt(){
  if(!els.locPrompt) return;
  els.locPrompt.setAttribute("aria-hidden", "true");
}

async function syncLocationPromptCtas(){
  if(!els.locAllowBtn) return;
  if(!navigator.geolocation){
    els.locAllowBtn.textContent = "Location unavailable";
    els.locAllowBtn.disabled = true;
    return;
  }

  els.locAllowBtn.disabled = false;

  let state = null;
  try{
    if(navigator.permissions?.query){
      const perm = await navigator.permissions.query({ name: "geolocation" });
      state = perm?.state || null;
    }
  }catch{
    state = null;
  }

  if(!state){
    state = localStorage.getItem("sms_panchang_geo_granted") === "1" ? "granted" : null;
  }

  if(state === "granted"){
    els.locAllowBtn.textContent = "Current location";
  }else{
    els.locAllowBtn.textContent = "Allow Location";
  }
}

async function init(){
  startClock();
  buildStars();
  startGlyphField();
  initCalendar();
  ensureAuspiciousYearSelect();
  initFocusMode();
  initReminderToggle();
  initHeroParallax();

  if(els.aiInsightRefresh){
    els.aiInsightRefresh.addEventListener("click", ()=>{
      if(lastLivePanchang) refreshAIInsight(lastLivePanchang, { force: true });
    });
  }
  if(els.sagePrevBtn){
    els.sagePrevBtn.addEventListener("click", ()=>{
      if(!sageCarouselState.items.length) return;
      sageCarouselState.index = (sageCarouselState.index - 1 + sageCarouselState.items.length) % sageCarouselState.items.length;
      renderSageQuote();
    });
  }
  if(els.sageNextBtn){
    els.sageNextBtn.addEventListener("click", ()=>{
      if(!sageCarouselState.items.length) return;
      sageCarouselState.index = (sageCarouselState.index + 1) % sageCarouselState.items.length;
      renderSageQuote();
    });
  }

  // Location prompt (first time)
  const saved = getSavedLocation();
  if(els.placeSearchInput && saved.name) els.placeSearchInput.value = saved.name;

  const hasSaved = localStorage.getItem("sms_panchang_location") !== null;
  const onboarded = localStorage.getItem("sms_panchang_loc_onboarded") === "1";
  if(!hasSaved && !onboarded){
    localStorage.setItem("sms_panchang_loc_onboarded", "1");
    openLocationPrompt();
  }

  if(els.changeLocBtn){
    els.changeLocBtn.addEventListener("click", openLocationPrompt);
  }

  if(els.auspiciousYear){
    els.auspiciousYear.value = els.calYear?.value || String(new Date().getFullYear());
    els.auspiciousYear.addEventListener("change", ()=>{
      loadAuspiciousPlanner(getAuspiciousYear());
    });
  }

  if(els.locDefaultBtn){
    els.locDefaultBtn.addEventListener("click", ()=>{
      saveLocation(28.6139, 77.2090, null, "New Delhi, India");
      panchangCache.clear();
      kharmasYearCache.clear();
      marriageYearCache.clear();
      renderCalendar(calendarState.year, calendarState.monthIndex);
      closeLocationPrompt();
      initReload();
      loadAuspiciousPlanner(getAuspiciousYear());
    });
  }

  const triggerPlaceSearch = async ()=>{
    const query = els.placeSearchInput?.value || "";
    const trimmed = query.trim();
    placeSearchState.lastQuery = trimmed;
    if(trimmed.length < 3){
      renderPlaceResults([]);
      return;
    }
    if(els.placeSearchResults){
      els.placeSearchResults.innerHTML = `<div class="loc-search-empty">Searching locations…</div>`;
    }
    try{
      const places = await searchPlaces(trimmed);
      if(placeSearchState.lastQuery !== trimmed) return;
      renderPlaceResults(places);
    }catch{
      if(placeSearchState.lastQuery !== trimmed) return;
      if(els.placeSearchResults){
        els.placeSearchResults.innerHTML = `<div class="loc-search-empty">Location search failed. Please try again.</div>`;
      }
    }
  };

  if(els.placeSearchBtn){
    els.placeSearchBtn.addEventListener("click", triggerPlaceSearch);
  }
  if(els.placeSearchInput){
    els.placeSearchInput.addEventListener("input", ()=>{
      window.clearTimeout(placeSearchState.timer);
      const q = els.placeSearchInput.value || "";
      if(q.trim().length < 3){
        renderPlaceResults([]);
        return;
      }
      placeSearchState.timer = window.setTimeout(triggerPlaceSearch, 220);
    });
    els.placeSearchInput.addEventListener("keydown", (e)=>{
      if(e.key === "Enter"){
        e.preventDefault();
        triggerPlaceSearch();
      }
    });
  }

  if(els.locAllowBtn){
    els.locAllowBtn.addEventListener("click", ()=>{
      if(!navigator.geolocation){
        alert("Geolocation not supported in this browser.");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos)=>{
          localStorage.setItem("sms_panchang_geo_granted", "1");
          const placeName = await reverseLookupPlace(pos.coords.latitude, pos.coords.longitude);
          saveLocation(pos.coords.latitude, pos.coords.longitude, null, placeName);
          if(els.placeSearchInput && placeName) els.placeSearchInput.value = placeName;
          panchangCache.clear();
          kharmasYearCache.clear();
          marriageYearCache.clear();
          renderCalendar(calendarState.year, calendarState.monthIndex);
          closeLocationPrompt();
          initReload();
          loadAuspiciousPlanner(getAuspiciousYear());
        },
        ()=>{
          alert("Location permission denied. You can use Delhi or manual coordinates.");
        },
        { enableHighAccuracy: true, timeout: 12000 }
      );
    });
  }

  loadAuspiciousPlanner(getAuspiciousYear());
  initReload();
}

let reloadInFlight = false;
async function initReload(){
  if(reloadInFlight) return;
  reloadInFlight = true;
  setState({loading:true, error:null, ready:false});
  try{
    const { lat, lon, tz: savedTz } = getSavedLocation();

    // Weather first: gives us realistic visuals + best-effort timezone for this lat/lon.
    const weather = await fetchWeather(lat, lon);
    setWeather(weather.kind);
    setTemperature(weather.tempC);

    const tzName = weather.tzName || savedTz || getBrowserTz();
    if(weather.tzName && weather.tzName !== savedTz){
      saveLocation(lat, lon, weather.tzName, getSavedLocation().name);
    }

    const p = await loadPanchang(tzName);
    lastLivePanchang = p;
    hydrateUI(p);
    syncTodayCalendarCell();
    setState({loading:false, error:null, ready:true});
    startSkyLoop(p);
    scheduleRolloverRefresh(p);
  }catch(err){
    setState({loading:false, error: String(err?.message || err), ready:false});
  }finally{
    reloadInFlight = false;
  }
}

init();
