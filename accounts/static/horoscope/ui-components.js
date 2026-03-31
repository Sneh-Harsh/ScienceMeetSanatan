export function renderTabs(target, scopes, activeKey) {
  target.innerHTML = scopes
    .map(
      (scope) => `
        <button class="scope-tab${scope.key === activeKey ? " is-active" : ""}" type="button" data-scope="${scope.key}">
          ${scope.label}
        </button>
      `,
    )
    .join("");
}

export function renderNatalSummary(target, natal) {
  target.innerHTML = `
    <div class="card-title">Natal Snapshot</div>
    <div class="text-block">
      <strong>Lagna:</strong> ${natal.lagna}<br>
      <strong>Moon Sign:</strong> ${natal.moon_sign}<br>
      <strong>Sun Sign:</strong> ${natal.sun_sign}<br>
      <strong>Nakshatra:</strong> ${natal.nakshatra} • Pada ${natal.nakshatra_pada}
    </div>
  `;
}

export function renderCosmicMessage(target, scope) {
  target.innerHTML = `
    <div class="card-title">Today's Cosmic Message</div>
    <div class="message-title">${scope.cosmic_message}</div>
    <p class="muted">${scope.summary}</p>
  `;
}

export function renderSummary(target, scope) {
  target.innerHTML = `
    <div class="card-title">${scope.scope} Horoscope</div>
    <p class="text-block">${scope.summary}</p>
  `;
}

export function renderScores(target, scope) {
  const rows = [
    ["Love", scope.scores.love],
    ["Career", scope.scores.career],
    ["Health", scope.scores.health],
    ["Finance", scope.scores.finance],
  ];
  target.innerHTML = `
    <div class="card-title">Cosmic Energy Meter</div>
    <div class="score-grid">
      ${rows
        .map(
          ([label, value]) => `
            <div class="score-row">
              <div class="score-meta"><span>${label}</span><span>${value}</span></div>
              <div class="score-bar"><div class="score-fill" style="width:${value}%"></div></div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

export function renderDetails(target, scope) {
  target.innerHTML = `
    <div class="card-title">Detailed Analysis</div>
    <div class="details-grid">
      <div class="detail-item"><h4>Emotional State</h4><p>${scope.details.emotional}</p></div>
      <div class="detail-item"><h4>Career Movement</h4><p>${scope.details.career}</p></div>
      <div class="detail-item"><h4>Relationship Dynamics</h4><p>${scope.details.relationships}</p></div>
      <div class="detail-item"><h4>Financial Outlook</h4><p>${scope.details.finance}</p></div>
    </div>
  `;
}

export function renderAdvice(target, scope) {
  target.innerHTML = `
    <div class="card-title">Advice</div>
    <p class="text-block">${scope.advice}</p>
  `;
}

export function renderLucky(target, scope) {
  target.innerHTML = `
    <div class="card-title">Lucky Elements</div>
    <div class="lucky-grid">
      <div class="lucky-pill"><span>Color</span><strong>${scope.lucky.color}</strong></div>
      <div class="lucky-pill"><span>Number</span><strong>${scope.lucky.number}</strong></div>
      <div class="lucky-pill"><span>Time</span><strong>${scope.lucky.time}</strong></div>
    </div>
  `;
}

export function renderTimeline(target, scope) {
  target.innerHTML = `
    <div class="card-title">Timing Lens</div>
    <div class="text-block">
      <strong>Transit House:</strong> ${scope.transit_house}<br>
      <strong>Dominant Planet:</strong> ${scope.dominant_planet}<br>
      <strong>Mahadasha:</strong> ${scope.mahadasha}<br>
      <strong>Antardasha:</strong> ${scope.antardasha}
    </div>
  `;
}
