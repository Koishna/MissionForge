import { val } from "../core/units.js";
import {
  wetMassKg,
  powerGeneratedW,
  powerConsumedW,
  costUsdM,
} from "../core/resources.js";

const WORD = { ok: "OK", low: "LOW", critical: "CRITICAL" };

// Over the limit (or no limit chosen yet) is critical, above 90% of the limit is low.
const statusFor = (used, limit) =>
  limit <= 0 || used > limit ? "critical" : used > 0.9 * limit ? "low" : "ok";

function bar(label, used, limit, unit) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const s = statusFor(used, limit);

  // Colour is never the only signal: every bar also says OK / LOW / CRITICAL in words.
  const text =
    limit <= 0
      ? "CRITICAL · NOT SET"
      : used > limit
        ? "CRITICAL · OVER LIMIT"
        : `${WORD[s]} · ${pct.toFixed(0)}%`;

  return `
    <div class="resource-item">

      <div class="resource-header">
        <span>${label}</span>

        <span>
          ${used.toFixed(0)} / ${limit.toFixed(0)} ${unit}
        </span>
      </div>

      <div class="bar ${used > limit ? "over" : ""}">
        <span style="width:${pct}%"></span>
      </div>

      <div class="resource-status ${s} ${s === "critical" ? "danger" : ""}">
        ${text}
      </div>

    </div>
  `;
}

export function renderDashboard(container, r, mission) {
  const cap = r.launcher ? val(r.launcher.capacity_kg) : 0;

  const mass = wetMassKg(r);
  const powerUsed = powerConsumedW(r);
  const powerGenerated = powerGeneratedW(r);
  const budgetUsed = costUsdM(r);
  const budgetLimit = mission.requirements.budget_usd_m;

  // The header status follows the worst of the three bars instead of always saying nominal.
  const states = [
    statusFor(mass, cap),
    statusFor(powerUsed, powerGenerated),
    statusFor(budgetUsed, budgetLimit),
  ];
  const worst = states.includes("critical")
    ? "critical"
    : states.includes("low")
      ? "low"
      : "ok";
  const headline = {
    ok: "SYSTEM NOMINAL",
    low: "MARGINS LOW",
    critical: "ATTENTION REQUIRED",
  }[worst];

  container.innerHTML = `

    <div class="mission-dashboard">

      <div class="dashboard-heading">

        <div>
          <span class="eyebrow">MISSION CONTROL</span>

          <h2>Resource Status</h2>

          <p>
            Live assessment of spacecraft resource margins.
          </p>
        </div>

        <div class="system-status ${worst}">
          <span class="status-dot"></span>
          ${headline}
        </div>

      </div>


      <div class="resource-grid">

        <div class="resource-card">
          <div class="card-icon">⚖</div>

          <div class="card-label">
            MASS
          </div>

          <div class="card-value">
            ${mass.toFixed(0)}
            <span>kg</span>
          </div>

          <div class="card-limit">
            Launch capacity:
            ${cap.toFixed(0)} kg
          </div>

          ${bar("Mass", mass, cap, "kg")}
        </div>


        <div class="resource-card">
          <div class="card-icon">⚡</div>

          <div class="card-label">
            POWER
          </div>

          <div class="card-value">
            ${powerUsed.toFixed(0)}
            <span>W</span>
          </div>

          <div class="card-limit">
            Generation:
            ${powerGenerated.toFixed(0)} W
          </div>

          ${bar("Power use", powerUsed, powerGenerated, "W")}
        </div>


        <div class="resource-card">
          <div class="card-icon">💰</div>

          <div class="card-label">
            BUDGET
          </div>

          <div class="card-value">
            ${budgetUsed.toFixed(1)}
            <span>M USD</span>
          </div>

          <div class="card-limit">
            Mission cap:
            ${budgetLimit.toFixed(1)} M USD
          </div>

          ${bar("Budget", budgetUsed, budgetLimit, "M USD")}
        </div>

      </div>


      <div class="dashboard-footer">

        <span>
          RESOURCE MONITOR
        </span>

        <span>
          All values are calculated from the current spacecraft configuration.
        </span>

      </div>

    </div>
  `;
}