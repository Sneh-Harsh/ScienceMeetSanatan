function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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
      <div class="card-title"><strong>Wealth Alignment</strong></div>
      <div class="wealth-empty-state">
        <p>Generate the horoscope to unlock your kundali-based sector alignment lens.</p>
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
      <strong>Wealth Alignment</strong>
      <span class="period-meta">${escapeHtml(wealth.timingQuality || "Selective window")}</span>
    </div>

    <div class="wealth-grid">
      <article class="wealth-hero-panel">
        <div class="wealth-hero-top">
          <div>
            <div class="wealth-kicker">Astro Investment Lens</div>
            <h3>${escapeHtml(wealth.archetype || "Analytical Investor")}</h3>
            <p class="wealth-copy">${escapeHtml(wealth.riskStyleRationale || "Your chart currently favors measured sector alignment over blind speculation.")}</p>
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
            <p class="wealth-meter-note">Shows how much your current chart supports steady preservation versus higher-volatility investing.</p>
          </div>
          <div class="wealth-meter-card">
            <div class="pill-label">Timing quality</div>
            <strong>${escapeHtml(wealth.timingQuality || "Selective window")}</strong>
            <div class="wealth-meter-track wealth-meter-track--timing"><span style="width:${timingMeter}%"></span></div>
            <p class="wealth-meter-note">Shows how supportive the present dasha and transit cycle is for entering or reviewing sectors now.</p>
          </div>
        </div>

        <div class="wealth-pulse-grid">
          ${listOrFallback(pulse, [
            { label: "Conviction", score: 56, tone: "gold" },
            { label: "Timing", score: 52, tone: "blue" },
            { label: "Patience", score: 61, tone: "copper" },
            { label: "Volatility", score: 42, tone: "soft" },
          ])
            .map(
              (item) => `
                <div class="wealth-pulse-card wealth-pulse-card--${escapeHtml(item.tone || "gold")}">
                  <div class="pill-label">${escapeHtml(item.label)}</div>
                  <strong>${escapeHtml(Math.round(Number(item.score || 0)))}%</strong>
                  <p class="wealth-pulse-note">${escapeHtml(
                    item.label === "Conviction"
                      ? "How strongly your chart currently supports acting with clarity."
                      : item.label === "Timing"
                        ? "How favorable the current cycle is for sector decisions."
                        : item.label === "Patience"
                          ? "How much your chart supports accumulation and waiting power."
                          : "How much instability or sudden movement is active right now.",
                  )}</p>
                  <div class="wealth-pulse-bar"><span style="height:${Math.max(14, Number(item.score || 0))}%"></span></div>
                </div>
              `,
            )
            .join("")}
        </div>
      </article>

      <article class="wealth-list-panel">
        <div class="wealth-panel-head">
          <div class="pill-label">Recommended industries</div>
          <span class="period-meta">Ranked by chart support</span>
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

      <article class="wealth-side-panel wealth-side-panel--execution">
        <div class="wealth-panel-head">
          <div class="pill-label">Caution industries</div>
          <span class="period-meta">Lower alignment in current cycle</span>
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

      <article class="wealth-side-panel">
        <div class="wealth-panel-head">
          <div class="pill-label">Execution lens</div>
          <span class="period-meta">How to use this section</span>
        </div>
        <div class="wealth-basis-grid">
          <div class="wealth-basis-block">
            <div class="pill-label">Strongest planets</div>
            <div class="wealth-chip-row">
              ${strongestPlanets.map((row) => `<span class="wealth-chip">${escapeHtml(row.planet)} · ${escapeHtml(row.score)}</span>`).join("")}
            </div>
          </div>
          <div class="wealth-basis-block">
            <div class="pill-label">Supportive houses</div>
            <div class="wealth-chip-row">
              ${supportiveHouses.map((house) => `<span class="wealth-chip">House ${escapeHtml(house)}</span>`).join("")}
            </div>
          </div>
          <div class="wealth-basis-block">
            <div class="pill-label">Dasha support</div>
            <p>${escapeHtml(wealth.astroBasis?.dashaImpact || "")}</p>
          </div>
          <div class="wealth-basis-block">
            <div class="pill-label">Transit support</div>
            <p>${escapeHtml(wealth.astroBasis?.transitImpact || "")}</p>
          </div>
          <div class="wealth-basis-block wealth-basis-block--wide">
            <div class="pill-label">Action guide</div>
            <div class="wealth-action-list">
          ${listOrFallback(actionPoints, [
            "Use this lens to shortlist aligned sectors before doing financial research.",
            "Pair strong sectors with staggered entries instead of one-time allocation.",
            "Reduce exposure when caution signals cluster around wealth houses.",
          ])
            .map((item) => `<div class="wealth-action-item">${escapeHtml(item)}</div>`)
            .join("")}
            </div>
          </div>
          <div class="wealth-basis-block wealth-basis-block--wide">
            <div class="pill-label">Caution signals</div>
            <ul class="wealth-signal-list">
              ${(cautionSignals.length ? cautionSignals : ["No major caution signals are dominating the present cycle."])
                .map((item) => `<li>${escapeHtml(item)}</li>`)
                .join("")}
            </ul>
          </div>
        </div>
      </article>
    </div>

    <p class="wealth-disclaimer">${escapeHtml(wealth.disclaimer || "This feature offers a kundali-based sector alignment view for reflection and research, not guaranteed financial advice.")}</p>
  `;
}
