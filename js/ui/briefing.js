export function renderBriefing(app, state) {
  const mission = state?.mission || {};
  const requirements = mission.requirements || {};

  const objective =
    mission.objective ||
    "Define and configure a mission capable of achieving the required scientific objectives.";

  const budget = requirements.budget_usd_m ?? "—";
  const lifetime = requirements.lifetime_months ?? "—";
  const data = requirements.min_data_gb ?? "—";

  app.innerHTML = `
    <main class="briefing-page">

      <header class="briefing-header">
        <div class="briefing-header-left">
          <div class="briefing-system-label">
            <span class="briefing-live-dot"></span>
            MISSION SYSTEM ONLINE
          </div>

          <h1>MissionForge</h1>
          <p>Mission Briefing &amp; Requirements</p>
        </div>

        <div class="briefing-status">
          <div class="briefing-status-label">Mission Status</div>
          <div class="briefing-status-value">
            <span class="briefing-status-dot"></span>
            READY
          </div>
        </div>
      </header>

      <section class="briefing-content">

        <section class="briefing-objective">
          <span class="briefing-section-label">
            Mission Objective
          </span>

          <h2>Primary Mission Goal</h2>

          <div class="briefing-objective-body">
            <div class="briefing-number">01</div>

            <div class="briefing-objective-info">
              <p class="briefing-objective-text">
                ${escapeHTML(objective)}
              </p>

              <p class="briefing-note">
                Configure the mission systems to satisfy the
                required mission constraints and scientific goals.
              </p>
            </div>
          </div>

          <a href="#designer" class="briefing-start-link">
            <button
              type="button"
              class="briefing-start-button"
            >
              START MISSION DESIGN
              <span>→</span>
            </button>
          </a>
        </section>

        <section class="briefing-requirements">

          <div class="briefing-requirements-heading">
            <div>
              <span class="briefing-section-label">
                Mission Constraints
              </span>

              <h2>Required Parameters</h2>
            </div>

            <span class="briefing-required-badge">
              REQUIRED
            </span>
          </div>

          <div class="briefing-requirements-row">

            <article class="briefing-requirement-card">
              <div class="briefing-card-top">
                <span class="briefing-requirement-icon">$</span>
              </div>

              <div class="briefing-requirement-label">
                Maximum Budget
              </div>

              <div class="briefing-requirement-value">
                ${formatBudget(budget)}
              </div>

              <div class="briefing-progress"></div>
            </article>

            <article class="briefing-requirement-card">
              <div class="briefing-card-top">
                <span class="briefing-requirement-icon">◷</span>
              </div>

              <div class="briefing-requirement-label">
                Mission Lifetime
              </div>

              <div class="briefing-requirement-value">
                ${formatLifetime(lifetime)}
              </div>

              <div class="briefing-progress"></div>
            </article>

            <article class="briefing-requirement-card">
              <div class="briefing-card-top">
                <span class="briefing-requirement-icon">◈</span>
              </div>

              <div class="briefing-requirement-label">
                Minimum Data
              </div>

              <div class="briefing-requirement-value">
                ${formatData(data)}
              </div>

              <div class="briefing-progress"></div>
            </article>

          </div>
        </section>
      </section>

      <section class="briefing-systems">

        <div class="briefing-systems-header">
          <div>
            <span class="briefing-section-label">
              Mission Architecture
            </span>

            <h2>Mission Systems</h2>
          </div>

          <span class="briefing-system-count">
            04 SYSTEM CATEGORIES
          </span>
        </div>

        <div class="briefing-system-grid">

          <article class="briefing-system-card">
            <span class="briefing-system-indicator"></span>

            <div class="briefing-system-info">
              <div class="briefing-system-name">
                Launch Vehicle
              </div>

              <div class="briefing-system-state">
                Vehicle selection
              </div>
            </div>

            <span class="briefing-system-arrow">→</span>
          </article>

          <article class="briefing-system-card">
            <span class="briefing-system-indicator"></span>

            <div class="briefing-system-info">
              <div class="briefing-system-name">
                Mission Orbit
              </div>

              <div class="briefing-system-state">
                Orbital configuration
              </div>
            </div>

            <span class="briefing-system-arrow">→</span>
          </article>

          <article class="briefing-system-card">
            <span class="briefing-system-indicator"></span>

            <div class="briefing-system-info">
              <div class="briefing-system-name">
                Science Instruments
              </div>

              <div class="briefing-system-state">
                Payload configuration
              </div>
            </div>

            <span class="briefing-system-arrow">→</span>
          </article>

          <article class="briefing-system-card">
            <span class="briefing-system-indicator"></span>

            <div class="briefing-system-info">
              <div class="briefing-system-name">
                Communications
              </div>

              <div class="briefing-system-state">
                Communication system
              </div>
            </div>

            <span class="briefing-system-arrow">→</span>
          </article>

        </div>
      </section>

      <footer class="briefing-footer">
        <span>MISSIONFORGE // BRIEFING</span>

        <span>
          Review mission requirements before beginning configuration.
        </span>
      </footer>

    </main>
  `;
}

function formatBudget(value) {
  if (value === "—" || value === null || value === undefined) {
    return "—";
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return escapeHTML(String(value));
  }

  return `$${number}M`;
}

function formatLifetime(value) {
  if (value === "—" || value === null || value === undefined) {
    return "—";
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return escapeHTML(String(value));
  }

  return `${number} months`;
}

function formatData(value) {
  if (value === "—" || value === null || value === undefined) {
    return "—";
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return escapeHTML(String(value));
  }

  return `${number} GB`;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
