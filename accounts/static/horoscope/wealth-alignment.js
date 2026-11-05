function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const HOUSE_AREA = { 1: "Self", 2: "Savings", 3: "Courage", 4: "Home", 5: "Learning", 6: "Work & health", 7: "Partnerships", 8: "Sudden change", 9: "Luck", 10: "Career", 11: "Gains", 12: "Rest & expenses" };

function riskIndex(label) {
  if (label === "Conservative") return 1;
  if (label === "Balanced") return 2;
  return 3;
}

function timingTone(label) {
  if (label === "Strong window") return "is-strong";
  if (label === "Selective window") return "is-selective";
  return "is-cautious";
}

function listOrFallback(items, fallback) {
  return items.length ? items : fallback;
}

export function renderWealthAlignment(target, wealth) {
  if (!target) return;
  if (!wealth) {
    target.innerHTML = `
      <div class="card-title"><strong>Money & Wealth</strong></div>
      <div class="wealth-empty-state">
        <p>Generate your horoscope to see which business sectors suit your chart.</p>
      </div>
    `;
    return;
  }

  const strongestPlanets = Array.isArray(wealth.astroBasis?.strongestPlanets) ? wealth.astroBasis.strongestPlanets : [];
  const supportiveHouses = Array.isArray(wealth.astroBasis?.supportiveHouses) ? wealth.astroBasis.supportiveHouses : [];
  const cautionSignals = Array.isArray(wealth.astroBasis?.cautionSignals) ? wealth.astroBasis.cautionSignals : [];
  const recommended = Array.isArray(wealth.recommendedIndustries) ? wealth.recommendedIndustries : [];
  const caution = Array.isArray(wealth.cautionIndustries) ? wealth.cautionIndustries : [];
  const pulse = Array.isArray(wealth.wealthPulse) ? wealth.wealthPulse : [];
  const actionPoints = Array.isArray(wealth.actionPoints) ? wealth.actionPoints : [];
  const confidenceScore = Number(wealth.confidence?.score || 0);
  const confidenceLabel = String(wealth.confidence?.label || "Moderate");
  const riskMeter = Number(wealth.riskMeter || riskIndex(wealth.riskStyle) * 30);
  const timingMeter = Number(wealth.timingMeter || 50);

  target.innerHTML = `
    <div class="card-title">
      <strong>Money & Wealth</strong>
      <span class="period-meta">${escapeHtml(wealth.timingQuality || "Selective window")}</span>
    </div>

    <div class="wealth-grid">
      <article class="wealth-hero-panel">
        <div class="wealth-hero-top">
          <div>
            <div class="wealth-kicker">Your money style</div>
            <h3>${escapeHtml(wealth.archetype || "Analytical Investor")}</h3>
            <p class="wealth-copy">${escapeHtml(wealth.riskStyleRationale || "Your chart supports careful, planned investing.")}</p>
          </div>
          <div class="wealth-confidence">
            <div class="wealth-confidence-ring" style="--wealth-score:${confidenceScore};">
              <div class="wealth-confidence-core">
                <strong>${escapeHtml(Math.round(confidenceScore))}%</strong>
                <span>${escapeHtml(confidenceLabel)}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="wealth-meta-pills">
          <span class="wealth-meta-pill">${escapeHtml(wealth.riskStyle || "Balanced")}</span>
          <span class="wealth-meta-pill">${escapeHtml(wealth.holdingStyle || "Medium-term trend")}</span>
          <span class="wealth-meta-pill wealth-meta-pill--timing ${timingTone(wealth.timingQuality)}">${escapeHtml(wealth.timingQuality || "Selective window")}</span>
        </div>

        <div class="wealth-meter-row">
          <div class="wealth-meter-card">
            <div class="pill-label">Risk style</div>
            <strong>${escapeHtml(wealth.riskStyle || "Balanced")}</strong>
            <div class="wealth-meter-track"><span style="width:${riskMeter}%"></span></div>
            <p class="wealth-meter-note">How safe or bold your chart suggests you invest.</p>
          </div>
          <div class="wealth-meter-card">
            <div class="pill-label">Timing quality</div>
            <strong>${escapeHtml(wealth.timingQuality || "Selective window")}</strong>
            <div class="wealth-meter-track wealth-meter-track--timing"><span style="width:${timingMeter}%"></span></div>
            <p class="wealth-meter-note">How good this period is to start or review investments.</p>
          </div>
        </div>

        <div class="wealth-pulse-grid">
          ${listOrFallback(pulse, [
            { label: "Conviction", score: 56, tone: "gold" },
            { label: "Timing", score: 52, tone: "blue" },
            { label: "Patience", score: 61, tone: "copper" },
            { label: "Volatility", score: 42, tone: "soft" },
          ])
            .map((item) => {
              const value = Math.round(Number(item.score || 0));
              const note = { Conviction: "How sure your chart is about acting now", Timing: "How good this period is for decisions", Patience: "How well you can wait for results", Volatility: "How much sudden change is around" }[item.label] || "";
              return `
                <div class="pulse-row pulse-row--${escapeHtml(item.tone || "gold")}">
                  <div class="pulse-row__top"><span class="pulse-row__label">${escapeHtml(item.label)}</span><strong class="pulse-row__value">${escapeHtml(value)}%</strong></div>
                  <div class="pulse-row__track" role="img" aria-label="${escapeHtml(item.label)} ${value} percent"><span style="width:${Math.max(4, Math.min(100, value))}%"></span></div>
                  <p class="pulse-row__note">${escapeHtml(note)}</p>
                </div>`;
            })
            .join("")}
        </div>
      </article>

      <article class="wealth-list-panel">
        <div class="wealth-panel-head">
          <div class="pill-label">Best sectors for you</div>
          <span class="period-meta">Strongest first</span>
        </div>
        <div class="wealth-rank-list">
          ${recommended
            .map(
              (item, index) => `
                <article class="wealth-rank-card" style="--industry-score:${Number(item.score || 0)};">
                  <div class="wealth-rank-top">
                    <div class="wealth-rank-index">${index + 1}</div>
                    <div>
                      <h4>${escapeHtml(item.name)}</h4>
                      <p>${escapeHtml(item.rationale)}</p>
                    </div>
                    <strong>${escapeHtml(item.score)}</strong>
                  </div>
                  <div class="wealth-bar"><span></span></div>
                </article>
              `,
            )
            .join("")}
        </div>
      </article>

      <article class="wealth-side-panel wealth-side-panel--execution wealth-area-caution">
        <div class="wealth-panel-head">
          <div class="pill-label">Go slow in these sectors</div>
          <span class="period-meta">Weaker support now</span>
        </div>
        <div class="wealth-caution-list">
          ${caution
            .map(
              (item) => `
                <div class="wealth-caution-item">
                  <strong>${escapeHtml(item.name)}</strong>
                  <span>${escapeHtml(item.score)}</span>
                  <p>${escapeHtml(item.rationale)}</p>
                </div>
              `,
            )
            .join("")}
        </div>
      </article>

      <article class="wealth-side-panel wealth-area-exec">
        <div class="wealth-panel-head">
          <div class="pill-label">Why and how</div>
          <span class="period-meta">Your chart facts</span>
        </div>
        <div class="wealth-basis-grid">
          <div class="wealth-basis-block">
            <div class="pill-label">Your strongest planets</div>
            <div class="wealth-chip-row">
              ${strongestPlanets.map((row) => `<span class="wealth-chip">${escapeHtml(row.planet)} · ${escapeHtml(row.score)}</span>`).join("")}
            </div>
          </div>
          <div class="wealth-basis-block">
            <div class="pill-label">Helpful life areas</div>
            <div class="wealth-chip-row">
              ${supportiveHouses.map((house) => `<span class="wealth-chip">${escapeHtml(HOUSE_AREA[house] || "Area " + house)}</span>`).join("")}
            </div>
          </div>
          <div class="wealth-basis-block">
            <div class="pill-label">Your Dasha</div>
            <p>${escapeHtml(wealth.astroBasis?.dashaImpact || "")}</p>
          </div>
          <div class="wealth-basis-block">
            <div class="pill-label">Planets today</div>
            <p>${escapeHtml(wealth.astroBasis?.transitImpact || "")}</p>
          </div>
          <div class="wealth-basis-block wealth-basis-block--wide">
            <div class="pill-label">What to do</div>
            <div class="wealth-action-list">
          ${listOrFallback(actionPoints, [
            "Krishna says: use this list to pick sectors to research first.",
            "Krishna says: invest in small steps instead of all at once.",
            "Krishna says: invest less when many warning signs appear together.",
          ])
            .map((item) => `<div class="wealth-action-item">${escapeHtml(item)}</div>`)
            .join("")}
            </div>
          </div>
          ${Array.isArray(wealth.wealthFacts) && wealth.wealthFacts.length ? `
          <div class="wealth-basis-block wealth-basis-block--wide">
            <div class="pill-label">What supports your money</div>
            <ul class="wealth-signal-list">
              ${wealth.wealthFacts.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>` : ""}
          <div class="wealth-basis-block wealth-basis-block--wide">
            <div class="pill-label">Be careful about</div>
            <ul class="wealth-signal-list">
              ${(cautionSignals.length ? cautionSignals : ["Nothing major to worry about right now."])
                .map((item) => `<li>${escapeHtml(String(item).startsWith("Krishna says") ? item : `Krishna says: ${item}`)}</li>`)
                .join("")}
            </ul>
          </div>
        </div>
      </article>
    </div>

    <p class="wealth-disclaimer">${escapeHtml(wealth.disclaimer || "Krishna says: this is a kundali-based sector view for reflection and research, not guaranteed financial advice.")}</p>
  `;

}