import { state } from "../state.js";
import { resolveSpacecraft } from "../core/resources.js";
import { deltaVms } from "../core/propulsion.js";
import { renderMissionMatch } from "./missionMatch.js";

export function renderReport(app, currentState) {
  const s = currentState || state;

  const mission = s.mission || {};
  const spacecraft = s.spacecraft || {};
  const results = s.results || {};

  const validation = results.validation || null;
  const nominal = results.nominal || null;
  const monteCarlo = results.monteCarlo || null;

  const warnings = Array.isArray(validation?.warnings)
    ? validation.warnings
    : [];

  const simulationDisclaimer =
    "Simulated reliability is conditional on the model and its stated assumptions. It is not a real-world flight probability.";

  const displayWarnings = warnings.filter(
    (warning) => warning !== simulationDisclaimer,
  );

  const validationAvailable = validation !== null;
  const validationPassed = validationAvailable && displayWarnings.length === 0;

  const missionName = mission.name || mission.title || "MissionForge Mission";

  const objective = mission.objective || "Mission objective not specified.";

  const spacecraftName =
    spacecraft.name || spacecraft.bus || "Configured Spacecraft";
  let deltaV = nominal?.dvAvailMs ?? null;

  if (deltaV === null || deltaV === undefined) {
    try {
      const resolved = resolveSpacecraft(spacecraft, s.data);

      if (resolved) {
        deltaV = deltaVms(resolved);
      }
    } catch (error) {
      console.warn("Could not calculate available Delta-V:", error);
    }
  }
  const simulationRun = nominal !== null;

  const simulationStatus = !simulationRun
    ? "NOT RUN"
    : nominal.success
      ? "COMPLETED — SUCCESS"
      : "COMPLETED — FAILED";
  let reliability = null;

  if (monteCarlo !== null) {
    if (typeof monteCarlo === "number") {
      reliability = monteCarlo;
    } else {
      reliability =
        monteCarlo.reliability ??
        monteCarlo.successProbability ??
        monteCarlo.success_probability ??
        monteCarlo.successRate ??
        monteCarlo.success_rate ??
        monteCarlo.probability ??
        null;
    }
  }

  const requirements = mission.requirements || {};

  const budget = requirements.budget_usd_m ?? null;

  const lifetime = requirements.lifetime_months ?? null;

  const data = requirements.min_data_gb ?? null;

  app.innerHTML = `

    <main class="report-page">
      <header class="report-header">

        <div class="report-header-content">

          <span class="report-kicker">
            MISSION ANALYSIS // FINAL REPORT
          </span>

          <h1>
            Mission Report
          </h1>

          <p>
            Consolidated assessment of the current spacecraft
            configuration and mission performance.
          </p>

        </div>

        <div class="report-header-status">

          <span class="report-status-dot"></span>

          <span>
            ${
              validationPassed
                ? "CONFIGURATION VERIFIED"
                : validationAvailable
                  ? "ACTION REQUIRED"
                  : "VALIDATION PENDING"
            }
          </span>

        </div>

      </header>

      <section class="report-overview">

        <div class="report-overview-heading">

          <div>

            <span class="report-section-label">
              MISSION OVERVIEW
            </span>

            <h2>
              ${escapeHTML(missionName)}
            </h2>

          </div>

          <span class="report-classification">
            MISSIONFORGE // ANALYSIS
          </span>

        </div>


        <div class="report-overview-grid">

          <div class="report-overview-item">

            <span class="report-item-label">
              OBJECTIVE
            </span>

            <p>
              ${escapeHTML(objective)}
            </p>

          </div>


          <div class="report-overview-item">

            <span class="report-item-label">
              SPACECRAFT
            </span>

            <p>
              ${escapeHTML(spacecraftName)}
            </p>

          </div>

        </div>

      </section>

      <section class="report-section">

        <div class="report-section-heading">

          <div>

            <span class="report-section-label">
              MISSION REQUIREMENTS
            </span>

            <h2>
              Required Parameters
            </h2>

          </div>

        </div>


        <div class="report-requirements-grid">

          <article class="report-metric-card">

            <span class="report-metric-icon">
              $
            </span>

            <span class="report-metric-label">
              MAXIMUM BUDGET
            </span>

            <strong class="report-metric-value">
              ${formatBudget(budget)}
            </strong>

          </article>


          <article class="report-metric-card">

            <span class="report-metric-icon">
              ◷
            </span>

            <span class="report-metric-label">
              MISSION LIFETIME
            </span>

            <strong class="report-metric-value">
              ${formatLifetime(lifetime)}
            </strong>

          </article>


          <article class="report-metric-card">

            <span class="report-metric-icon">
              ◈
            </span>

            <span class="report-metric-label">
              MINIMUM DATA
            </span>

            <strong class="report-metric-value">
              ${formatData(data)}
            </strong>

          </article>

        </div>

      </section>

      <section class="report-section">

        <div class="report-section-heading">

          <div>

            <span class="report-section-label">
              PERFORMANCE
            </span>

            <h2>
              Mission Performance
            </h2>

          </div>

          <span class="report-section-code">
            PERF-01
          </span>

        </div>


        <div class="report-performance-table">

          <div class="report-performance-row report-performance-header">

            <div>
              PARAMETER
            </div>

            <div>
              RESULT
            </div>

            <div>
              STATUS
            </div>

          </div>

          <div class="report-performance-row">

            <div>
              AVAILABLE DELTA-V
            </div>

            <div class="report-performance-value">
              ${
                deltaV !== null && Number.isFinite(Number(deltaV))
                  ? `${formatNumber(deltaV)} m/s`
                  : "—"
              }
            </div>

            <div>
              <span class="report-status-badge ${
                deltaV !== null && Number.isFinite(Number(deltaV))
                  ? "success"
                  : "neutral"
              }">
                ${
                  deltaV !== null && Number.isFinite(Number(deltaV))
                    ? "AVAILABLE"
                    : "NOT AVAILABLE"
                }
              </span>
            </div>

          </div>

          <div class="report-performance-row">

            <div>
              SIMULATION STATUS
            </div>

            <div class="report-performance-value">
              ${escapeHTML(simulationStatus)}
            </div>

            <div>
              <span class="report-status-badge ${
                simulationRun
                  ? nominal.success
                    ? "success"
                    : "danger"
                  : "neutral"
              }">
                ${
                  !simulationRun
                    ? "PENDING"
                    : nominal.success
                      ? "SUCCESS"
                      : "FAILED"
                }
              </span>
            </div>

          </div>

          <div class="report-performance-row">

            <div>
              RELIABILITY
            </div>

            <div class="report-performance-value">
              ${reliability !== null ? formatReliability(reliability) : "—"}
            </div>

            <div>
              <span class="report-status-badge ${
                reliability !== null ? "success" : "neutral"
              }">
                ${reliability !== null ? "SIMULATED" : "NOT RUN"}
              </span>
            </div>

          </div>

        </div>

      </section>

      <section class="report-section">

        <div class="report-section-heading">

          <div>

            <span class="report-section-label">
              SYSTEM VALIDATION
            </span>

            <h2>
              Configuration Readiness
            </h2>

          </div>

          <span class="report-section-code">
            VALIDATION-01
          </span>

        </div>


        <div class="report-validation">

          <div class="report-validation-status ${
            !validationAvailable
              ? "danger"
              : validationPassed
                ? "success"
                : "danger"
          }">

            <span class="report-validation-icon">
              ${!validationAvailable ? "!" : validationPassed ? "✓" : "!"}
            </span>


            <div>

              <strong>
                ${
                  !validationAvailable
                    ? "Validation Not Performed"
                    : validationPassed
                      ? "Configuration Valid"
                      : "Configuration Requires Attention"
                }
              </strong>

              <p>
                ${
                  !validationAvailable
                    ? "Run spacecraft validation to check the current configuration."
                    : validationPassed
                      ? "All spacecraft validation checks pass."
                      : "The spacecraft configuration contains validation issues."
                }
              </p>

            </div>

          </div>


          ${
            displayWarnings.length
              ? `
                <div class="report-warning-list">

                  ${displayWarnings
                    .map(
                      (warning) => `
                        <div class="report-warning">

                          <span>
                            ⚠
                          </span>

                          <span>
                            ${escapeHTML(warning)}
                          </span>

                        </div>
                      `,
                    )
                    .join("")}

                </div>
              `
              : validationAvailable
                ? `
                  <div class="report-no-warning">
                    ✓ No validation warnings detected.
                  </div>
                `
                : ""
          }

        </div>

      </section>

      <section class="report-assessment">

        <div class="report-assessment-content">

          <span class="report-section-label">
            FINAL ASSESSMENT
          </span>

          <h2>
            ${
              !validationAvailable
                ? "Validation Pending"
                : validationPassed
                  ? "Mission Configuration Ready"
                  : "Mission Configuration Requires Review"
            }
          </h2>

          <p>
            ${
              !validationAvailable
                ? "Run validation to determine whether the current spacecraft configuration is ready for simulation."
                : validationPassed
                  ? "The current spacecraft configuration has passed the available validation checks and can proceed to simulation."
                  : "Resolve the reported configuration issues before proceeding with mission simulation."
            }
          </p>

        </div>


        <div class="report-assessment-status ${
          !validationAvailable
            ? "danger"
            : validationPassed
              ? "success"
              : "danger"
        }">

          <span class="report-assessment-dot"></span>

          ${
            !validationAvailable
              ? "PENDING"
              : validationPassed
                ? "READY"
                : "REVIEW REQUIRED"
          }

        </div>

      </section>

      <footer class="report-footer">

        <span>
          MISSIONFORGE // REPORT
        </span>

        <span>
          Simulated results are conditional on the model
          and its stated assumptions.
        </span>

      </footer>

    </main>

  `;

  const matchTarget = app.querySelector(".report-page") || app;
  const matchBox = document.createElement("section");
  matchBox.className = "report-section";
  matchTarget.insertBefore(matchBox, matchTarget.querySelector(":scope > footer"));
  renderMissionMatch(matchBox, s);
}

function formatBudget(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return escapeHTML(String(value));
  }

  return `$${number}M`;
}

function formatLifetime(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return escapeHTML(String(value));
  }

  return `${number} months`;
}

function formatData(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return escapeHTML(String(value));
  }

  return `${number} GB`;
}

function formatNumber(value) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return escapeHTML(String(value));
  }

  return number.toLocaleString();
}

function formatReliability(value) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return escapeHTML(String(value));
  }

  const percentage = number <= 1 ? number * 100 : number;

  return `${percentage.toFixed(1)}%`;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
