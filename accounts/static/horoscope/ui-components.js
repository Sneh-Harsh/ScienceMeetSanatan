import { averageEnergy, confidenceFromScope, dominantColor } from "./prediction-generator.js?v=5";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderTabs(target, scopes, activeKey) {
  target.innerHTML = scopes
    .map(
      (scope) => `
        <button class="scope-tab${scope.key === activeKey ? " is-active" : ""}" type="button" data-scope="${escapeHtml(scope.key)}">
          ${escapeHtml(scope.label)}
        </button>
      `,
    )
    .join("");
}

export function renderHeroSignals(target, signals) {
  target.innerHTML = signals
    .map(
      (signal) => `
        <div class="signal-tile fade-in">
          <div class="signal-label">${escapeHtml(signal.label)}</div>
          <div class="signal-value">${escapeHtml(signal.value)}</div>
        </div>
      `,
    )
    .join("");
}

export function renderHeroChips(target, chips) {
  target.innerHTML = chips
    .map(
      (chip) => `
        <div class="hero-chip fade-in">
          <strong>${escapeHtml(chip.label)}:</strong> ${escapeHtml(chip.value)}
        </div>
      `,
    )
    .join("");
}

export function renderSavedProfile(target, profile, profileSummary) {
  if (!target) return;
  if (!profile) {
    target.innerHTML = `
      <div class="profile-badge">Awaiting profile</div>
      <div class="profile-title">Start with birth details.</div>
      <p class="profile-meta">Once you generate a horoscope, this card remembers the active birth profile and helps you return quickly.</p>
    `;
    return;
  }
  target.innerHTML = `
    <div class="profile-badge">Saved birth profile</div>
    <div class="profile-title">${escapeHtml(profile.place || "Current horoscope profile")}</div>
    <p class="profile-meta">${escapeHtml(profileSummary)}</p>
    <p class="profile-foot">The oracle reuses this profile for follow-up questions, so you do not need to re-enter your birth details every time.</p>
  `;
}

export function renderFocusPreview(target, preview) {
  target.innerHTML = `
    <div class="section-kicker">Current Focus</div>
    <h2>${escapeHtml(preview.title || "Current focus window")}</h2>
    <p class="section-copy">${escapeHtml(preview.summary || "Generate a horoscope to surface your strongest timing pattern.")}</p>
    <p class="profile-foot">${escapeHtml(preview.note || "")}</p>
  `;
}

export function renderNatalSummary(target, natal, scope) {
  const confidence = confidenceFromScope(scope);
  const yogas = Array.isArray(natal.yogas) ? natal.yogas : [];
  target.innerHTML = `
    <div class="card-title"><strong>Your Birth Chart</strong><span class="period-meta">Signal strength ${confidence}%</span></div>
    <div class="snapshot-grid">
      <div class="snapshot-tile">
        <div class="snapshot-eyebrow">Lagna</div>
        <div class="snapshot-value">${escapeHtml(natal.lagna)}</div>
      </div>
      <div class="snapshot-tile">
        <div class="snapshot-eyebrow">Moon Sign</div>
        <div class="snapshot-value">${escapeHtml(natal.moon_sign)}</div>
      </div>
      <div class="snapshot-tile">
        <div class="snapshot-eyebrow">Sun Sign</div>
        <div class="snapshot-value">${escapeHtml(natal.sun_sign)}</div>
      </div>
      <div class="snapshot-tile">
        <div class="snapshot-eyebrow">Nakshatra</div>
        <div class="snapshot-value">${escapeHtml(natal.nakshatra)} <span class="muted">• Pada ${escapeHtml(natal.nakshatra_pada)}</span></div>
      </div>
      <div class="snapshot-note">
        <div class="snapshot-eyebrow">Your chart in brief</div>
        <p>${escapeHtml(natal.note || "")}</p>
        ${yogas.length ? `<div class="yoga-row">${yogas.slice(0, 3).map((y) => `<span class="yoga-pill" title="${escapeHtml(y.meaning)}">${escapeHtml(y.name)}</span>`).join("")}</div>` : ""}
      </div>
    </div>
  `;
}

const SCOPE_POSSESSIVE = { daily: "Today’s", weekly: "This Week’s", monthly: "This Month’s", yearly: "This Year’s" };

export function renderCosmicMessage(target, scope) {
  const possessive = SCOPE_POSSESSIVE[scope.periodType] || `${escapeHtml(scope.dateRange?.label || "This year")}’s`;
  target.style.setProperty("--message-glow", dominantColor(scope));
  target.innerHTML = `
    <div class="card-title"><strong>${possessive} Cosmic Message</strong><span class="period-meta">${escapeHtml(scope.scope)}</span></div>
    <h3 class="headline-message">${escapeHtml(scope.headline)}</h3>
    <p class="message-body">${escapeHtml(scope.summary)}</p>
  `;
}

function listBlock(title, items, tone) {
  const rows = (items || []).filter(Boolean);
  if (!rows.length) return "";
  return `
    <div class="signal-list signal-list--${tone}">
      <div class="pill-label">${escapeHtml(title)}</div>
      <ul>${rows.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
  `;
}

export function renderPeriodSummary(target, scope) {
  const events = Array.isArray(scope.events) ? scope.events : [];
  target.innerHTML = `
    <div class="card-title"><strong>${escapeHtml(scope.scope)} Insight</strong><span class="period-meta">Energy ${averageEnergy(scope.scores)}%</span></div>
    <p class="message-body">${escapeHtml(scope.focus || "")}</p>
    <div class="signal-lists">
      ${listBlock("Helping you", scope.opportunities, "good")}
      ${listBlock("Needs care", scope.cautions, "care")}
    </div>
    ${events.length ? `
      <div class="key-dates">
        <div class="pill-label">Key dates</div>
        <ol class="key-dates__list">
          ${events.map((e) => `
            <li class="key-dates__item key-dates__item--${escapeHtml(e.tone || "mid")}">
              <span class="key-dates__when">${escapeHtml(e.when)}</span>
              <span class="key-dates__text">${escapeHtml(e.text)}</span>
            </li>`).join("")}
        </ol>
      </div>` : ""}
  `;
}

const TONE_LABEL = (score) => (score >= 62 ? "Supportive" : score <= 45 ? "Needs care" : "Mixed");

export function renderDetails(target, scope) {
  const sc = scope.scores || {};
  const ex = scope.extraScores || {};
  const why = scope.why || {};
  const rows = [
    ["emotional", "Emotional State", scope.details?.emotional, ex.emotional],
    ["career", "Career Movement", scope.details?.career, sc.career],
    ["relationships", "Relationship Dynamics", scope.details?.relationships, sc.love],
    ["finance", "Financial Outlook", scope.details?.finance, sc.finance],
    ["health", "Health & Energy", scope.details?.health, sc.health],
    ["spiritual", "Inner Life", scope.spiritualNote, ex.spiritual],
  ].filter((row) => row[2]);
  target.innerHTML = `
    <div class="card-title"><strong>Detailed Analysis</strong><span class="period-meta">${escapeHtml(scope.dominant_planet)} leads</span></div>
    <div class="analysis-grid">
      ${rows
        .map(
          ([key, label, text, score]) => `
            <article class="analysis-block analysis-block--${score >= 62 ? "good" : score <= 45 ? "care" : "mid"}">
              <div class="analysis-head">
                <h4>${escapeHtml(label)}</h4>
                <span class="tone-chip">${escapeHtml(TONE_LABEL(score))} · ${escapeHtml(score)}</span>
              </div>
              <p class="detail-paragraph">${escapeHtml(text)}</p>
              ${Array.isArray(why[key]) && why[key].length ? `
                <details class="why">
                  <summary>The astrology behind this</summary>
                  <ul>${why[key].map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
                </details>` : ""}
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

export function renderAdvice(target, scope) {
  const parts = scope.adviceParts || {};
  target.classList.add("feature-card", "feature-card--advice");
  target.classList.remove("feature-card--lucky");
  target.innerHTML = `
    <div class="card-title"><strong>Advice & Remedy</strong><span class="period-meta">${escapeHtml(scope.dominant_planet)} guidance</span></div>
    <div class="feature-card-body">
      <div class="feature-headline">
        <div class="pill-label">What to do</div>
        <h3>${escapeHtml(parts.headline || scope.advice)}</h3>
      </div>
      <div class="feature-grid">
        <article class="feature-tile">
          <div class="pill-label">Timing discipline</div>
          <p>${escapeHtml(parts.timing || "")}</p>
        </article>
        <article class="feature-tile">
          <div class="pill-label">Planetary remedy</div>
          <p>${escapeHtml(parts.posture || "")}</p>
        </article>
      </div>
      <div class="feature-foot">
        <span></span>
        <p>Krishna says: remedies are habits that steady the mind; they support your effort and never replace it.</p>
      </div>
    </div>
  `;
}

export function renderLucky(target, scope) {
  const lucky = scope?.lucky || {};
  target.classList.add("feature-card", "feature-card--lucky");
  target.classList.remove("feature-card--advice");
  target.innerHTML = `
    <div class="card-title"><strong>Lucky Elements</strong><span class="period-meta">${escapeHtml(lucky.planet || scope.dominant_planet)} favours you</span></div>
    <div class="feature-card-body">
      <div class="feature-headline">
        <div class="pill-label">Lucky colour</div>
        <h3>${escapeHtml(lucky.color || "Golden Saffron")}</h3>
        <p>${escapeHtml(lucky.why || "")}</p>
      </div>
      <div class="feature-grid">
        <div class="feature-tile">
          <div class="pill-label">Number</div>
          <strong>${escapeHtml(lucky.number)}</strong>
          <p>${escapeHtml(lucky.planet || "")}’s number</p>
        </div>
        <div class="feature-tile">
          <div class="pill-label">Lucky time</div>
          <strong>${escapeHtml(lucky.time)}</strong>
        </div>
        <div class="feature-tile">
          <div class="pill-label">Lucky planet</div>
          <strong>${escapeHtml(lucky.planet || scope.dominant_planet)}</strong>
        </div>
        <div class="feature-tile">
          <div class="pill-label">Best for</div>
          <strong>${escapeHtml(lucky.useFor || "Intentional action")}</strong>
        </div>
      </div>
    </div>
  `;
}

export function renderTimeline(target, scope) {
  const tiles = Array.isArray(scope.timing) && scope.timing.length
    ? scope.timing
    : [
        { label: "Dominant Planet", value: scope.dominant_planet },
        { label: "Mahadasha", value: scope.mahadasha },
        { label: "Antardasha", value: scope.antardasha },
      ];
  target.innerHTML = `
    <div class="card-title"><strong>Dasha & Timing</strong></div>
    <div class="timeline-grid">
      ${tiles
        .map(
          (tile) => `
            <div class="timeline-item">
              <div class="pill-label">${escapeHtml(tile.label)}</div>
              <strong>${escapeHtml(tile.value)}</strong>
              ${tile.note ? `<div class="timeline-note">${escapeHtml(tile.note)}</div>` : ""}
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

export function renderScores(target, scope) {
  const meters = [
    ["Love", scope.scores.love, "#e8628f"],
    ["Career", scope.scores.career, "#e0a21b"],
    ["Health", scope.scores.health, "#2fb98a"],
    ["Money", scope.scores.finance, "#4f86e8"],
    ["Signal strength", confidenceFromScope(scope), "#f08a3c"],
  ];
  target.innerHTML = `
    <div class="card-title"><strong>Your Scores</strong><span class="period-meta">${escapeHtml(scope.scope)} · out of 100</span></div>
    <div class="meter-grid">
      ${meters
        .map(
          ([label, value, color]) => `
            <div class="meter" style="--meter:${Number(value)};--meter-color:${escapeHtml(color)};">
              <div class="meter-visual" role="img" aria-label="${escapeHtml(label)} ${escapeHtml(value)} out of 100">
                <span class="meter-num">${escapeHtml(value)}</span>
              </div>
              <div class="meter-label">${escapeHtml(label)}</div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

export function renderPromptChips(target, prompts) {
  const promptList = Array.isArray(prompts) ? prompts : [];
  if (target?.parentElement) target.parentElement.hidden = !promptList.length;
  target.innerHTML = promptList
    .map(
      (prompt) => `
        <button class="prompt-chip" type="button" data-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>
      `,
    )
    .join("");
}

export function renderOracleHistory(target, history) {
  const items = Array.isArray(history) ? history : [];
  if (target?.parentElement) target.parentElement.hidden = !items.length;
  if (!items.length) {
    target.innerHTML = "";
    return;
  }
  target.innerHTML = items
    .map(
      (item) => `
        <button class="history-chip" type="button" data-question="${escapeHtml(item.question)}">${escapeHtml(item.question)}</button>
      `,
    )
    .join("");
}

export function renderOracleSections(target, answer) {
  const sections = [
    ["What to be careful about", answer.cautions],
    ["Best timing", answer.bestTiming],
    ["Remedy", answer.remedy],
    ["What is helping you", answer.opportunities],
  ];
  target.innerHTML = sections
    .map(
      ([label, text]) => `
        <article class="oracle-section fade-in">
          <h4>${escapeHtml(label)}</h4>
          <p>${escapeHtml(text)}</p>
        </article>
      `,
    )
    .join("");
}

export function renderOracleConversation(target, entries = [], onboarding = null) {
  if (!target) return;
  if (!entries.length) {
    target.innerHTML = `
      <div class="oracle-empty-state">
        <div class="oracle-empty-kicker">${escapeHtml(onboarding?.title || "Ask the Oracle")}</div>
        ${onboarding?.body ? `<p>${escapeHtml(onboarding.body)}</p>` : ""}
      </div>
    `;
    return;
  }
  target.innerHTML = entries
    .map((entry) => {
      const answer = entry.answer || {};
      const sections = [
        ["Direct answer", answer.directAnswer || ""],
        ["Why (from your chart)", answer.chartBasis || ""],
        ["What is helping you", answer.opportunities || ""],
        ["What to be careful about", answer.cautions || ""],
        ["Best timing", answer.bestTiming || ""],
        ["Remedy", answer.remedy || ""],
      ]
        .filter(([, value]) => value)
        .map(
          ([label, value]) => `
            <div class="oracle-message-section">
              <h4>${escapeHtml(label)}</h4>
              <p>${escapeHtml(value)}</p>
            </div>
          `,
        )
        .join("");
      const basis = Array.isArray(answer.astroBasisUsed) ? answer.astroBasisUsed.filter(Boolean) : [];
      const followUps = Array.isArray(answer.suggestedFollowUps) ? answer.suggestedFollowUps.filter(Boolean).slice(0, 3) : [];
      return `
        <article class="oracle-thread fade-in">
          <div class="oracle-query-row">
            <div class="oracle-query-avatar">◎</div>
            <p class="oracle-query-text">${escapeHtml(entry.question || "")}</p>
          </div>
          <div class="oracle-bubble oracle-bubble--answer${entry.pending ? " oracle-bubble--pending" : ""}">
            <div class="oracle-response-head">
              <div class="oracle-orb-mini">✦</div>
              <div>
                <div class="oracle-response-title">Krishna says</div>
                <div class="oracle-response-meta">Based on your birth chart</div>
              </div>
            </div>
            ${sections}
            ${entry.pending ? `<div class="oracle-inline-typing"><span></span><span></span><span></span></div>` : ""}
            ${
              basis.length
                ? `
                  <button class="oracle-basis-toggle" type="button" data-oracle-basis-toggle>
                    <span>Chart facts used</span>
                    <span>▾</span>
                  </button>
                  <div class="oracle-basis-body" data-oracle-basis-body hidden>
                    ${basis.map((item) => `<span class="oracle-basis-pill">${escapeHtml(item)}</span>`).join("")}
                  </div>
                `
                : ""
            }
            ${
              followUps.length
                ? `
                  <div class="oracle-followups">
                    ${followUps.map((item) => `<button class="oracle-followup-chip" type="button" data-followup="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("")}
                  </div>
                `
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");
}
