import { averageEnergy, confidenceFromScope, dominantColor } from "./prediction-generator.js";

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
  target.innerHTML = `
    <div class="card-title"><strong>Natal Snapshot</strong><span class="period-meta">Confidence ${confidence}%</span></div>
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
      <div class="snapshot-wheel">
        <div class="mini-wheel">
          <div class="mini-wheel-center">D1</div>
        </div>
        <div class="wheel-copy">
          <div class="snapshot-eyebrow">Natal axis</div>
          <div class="snapshot-value">${escapeHtml(natal.moon_sign)} rising through ${escapeHtml(natal.lagna)}</div>
          <p class="muted">Your horoscope is currently anchored by ${escapeHtml(scope.mahadasha)} Mahadasha and ${escapeHtml(scope.antardasha)} Antardasha, which is why the active period feels especially personal right now.</p>
        </div>
      </div>
    </div>
  `;
}

export function renderCosmicMessage(target, scope, aiSummary = null) {
  const headline = aiSummary?.headline || scope.cosmic_message;
  const summary = aiSummary?.summary || scope.summary;
  const timingCue = aiSummary?.timingCue || "";
  const dominant = aiSummary?.dominantPlanet || scope.dominant_planet;
  target.style.setProperty("--message-glow", dominantColor({ ...scope, dominant_planet: dominant }));
  target.innerHTML = `
    <div class="card-title"><strong>Today’s Cosmic Message</strong><span class="period-meta">${escapeHtml(scope.scope)}</span></div>
    <h3 class="headline-message">${escapeHtml(headline)}</h3>
    <p class="message-body">${escapeHtml(summary)}</p>
    ${timingCue ? `<p class="message-body message-body--timing">${escapeHtml(timingCue)}</p>` : ""}
  `;
}

export function renderPeriodSummary(target, scope) {
  target.innerHTML = `
    <div class="card-title"><strong>${escapeHtml(scope.scope)} Insight</strong><span class="period-meta">Energy ${averageEnergy(scope.scores)}%</span></div>
    <p class="message-body">${escapeHtml(scope.summary)}</p>
  `;
}

export function renderDetails(target, scope) {
  const rows = [
    ["Emotional State", scope.details.emotional],
    ["Career Movement", scope.details.career],
    ["Relationship Dynamics", scope.details.relationships],
    ["Financial Outlook", scope.details.finance],
  ];
  target.innerHTML = `
    <div class="card-title"><strong>Detailed Analysis</strong><span class="period-meta">${escapeHtml(scope.dominant_planet)} dominant</span></div>
    <div class="analysis-grid">
      ${rows
        .map(
          ([label, text]) => `
            <article class="analysis-block">
              <div class="snapshot-eyebrow">${escapeHtml(label)}</div>
              <h4>${escapeHtml(label)}</h4>
              <p class="detail-paragraph">${escapeHtml(text)}</p>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

export function renderAdvice(target, scope) {
  target.innerHTML = `
    <div class="card-title"><strong>Advice & Remedy</strong></div>
    <div class="analysis-list">
      <p>${escapeHtml(scope.advice)}</p>
      <p>Move deliberately during your stronger window, and let ${escapeHtml(scope.dominant_planet)} set the tone instead of reacting impulsively.</p>
    </div>
  `;
}

export function renderLucky(target, scope) {
  target.innerHTML = `
    <div class="card-title"><strong>Lucky Elements</strong></div>
    <div class="lucky-grid">
      <div class="lucky-pill">
        <div class="pill-label">Color</div>
        <strong>${escapeHtml(scope.lucky.color)}</strong>
      </div>
      <div class="lucky-pill">
        <div class="pill-label">Number</div>
        <strong>${escapeHtml(scope.lucky.number)}</strong>
      </div>
      <div class="lucky-pill">
        <div class="pill-label">Time</div>
        <strong>${escapeHtml(scope.lucky.time)}</strong>
      </div>
      <div class="lucky-pill">
        <div class="pill-label">Energy Cue</div>
        <strong>${escapeHtml(scope.dominant_planet)}</strong>
      </div>
    </div>
  `;
}

export function renderTimeline(target, scope) {
  const items = [
    ["Transit House", `House ${scope.transit_house}`],
    ["Dominant Planet", scope.dominant_planet],
    ["Mahadasha", scope.mahadasha],
    ["Antardasha", scope.antardasha],
  ];
  target.innerHTML = `
    <div class="card-title"><strong>Timing Lens</strong></div>
    <div class="timeline-grid">
      ${items
        .map(
          ([label, value]) => `
            <div class="timeline-item">
              <div class="pill-label">${escapeHtml(label)}</div>
              <strong>${escapeHtml(value)}</strong>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

export function renderScores(target, scope) {
  const meters = [
    ["Love", scope.scores.love, "#ff9dc2"],
    ["Career", scope.scores.career, "#f2ca50"],
    ["Health", scope.scores.health, "#7ce7c2"],
    ["Finance", scope.scores.finance, "#83aaff"],
    ["Confidence", confidenceFromScope(scope), "#ffb779"],
  ];
  target.innerHTML = `
    <div class="card-title"><strong>Premium Metrics</strong><span class="period-meta">${escapeHtml(scope.scope)} lens</span></div>
    <div class="meter-grid">
      ${meters
        .map(
          ([label, value, color]) => `
            <div class="meter" style="--meter:${Number(value)};--meter-color:${escapeHtml(color)};">
              <div class="meter-top">
                <div class="meter-label">${escapeHtml(label)}</div>
                <div class="meter-value">${escapeHtml(value)}</div>
              </div>
              <div class="meter-visual"></div>
              <div class="meter-center">
                <div class="meter-score">${escapeHtml(value)}%</div>
                <div class="meter-caption">${escapeHtml(label)}</div>
              </div>
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
    ["What to watch out for", answer.cautions],
    ["Best timing", answer.bestTiming],
    ["Gentle remedy", answer.remedy],
    ["Opportunity", answer.opportunities],
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
        ["What in the chart supports this", answer.chartBasis || ""],
        ["Opportunities", answer.opportunities || ""],
        ["What to watch out for", answer.cautions || ""],
        ["Best timing", answer.bestTiming || ""],
        ["Gentle remedy", answer.remedy || ""],
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
                <div class="oracle-response-title">The Oracle Speaks</div>
                <div class="oracle-response-meta">Using your active birth profile and current horoscope context</div>
              </div>
            </div>
            ${sections}
            ${entry.pending ? `<div class="oracle-inline-typing"><span></span><span></span><span></span></div>` : ""}
            ${
              basis.length
                ? `
                  <button class="oracle-basis-toggle" type="button" data-oracle-basis-toggle>
                    <span>Astrological Basis Used</span>
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
