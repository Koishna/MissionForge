import { setState } from "../state.js";
import { resolveSpacecraft } from "../core/resources.js";
import { validateSpacecraft } from "../core/validate.js";
import { deltaVms } from "../core/propulsion.js";

export function renderValidation(app, state) {
  const r = resolveSpacecraft(state.spacecraft, state.data);

  const v = validateSpacecraft(r, state.mission);

  const simulationDisclaimer =
    "Simulated reliability is conditional on the model and its stated assumptions. It is not a real-world flight probability.";

  const displayWarnings = v.warnings.filter(
    (warning) => warning !== simulationDisclaimer,
  );

  const displayOk = displayWarnings.length === 0;

  setState({
    results: {
      ...state.results,
      validation: v,
    },
  });

  const statusClass = displayOk ? "success" : "danger";

  const availableDeltaV = deltaVms(r).toFixed(0);

  app.innerHTML = `

    <main class="validation-page">

      <header class="validation-header">

        <div class="validation-header-content">

          <span class="validation-kicker">
            PRE-LAUNCH SYSTEM CHECK
          </span>

          <h1>
            Mission Validation
          </h1>

          <p>
            Verify spacecraft configuration before simulation.
          </p>

        </div>


        <div class="validation-status ${statusClass}">

          <span class="validation-status-dot"></span>

          <span>
            ${displayOk ? "ALL SYSTEMS PASS" : "ACTION REQUIRED"}
          </span>

        </div>

      </header>

      <section class="validation-results-section">

        <div class="validation-results-heading">

          <div>

            <span class="validation-section-label">
              VALIDATION RESULTS
            </span>

            <h2>
              Spacecraft Readiness
            </h2>

          </div>


          <span class="validation-check-label">
            PRE-FLIGHT CHECK
          </span>

        </div>

        <div class="validation-table">

          <div class="validation-table-row validation-table-header">

            <div class="validation-table-cell">
              CONFIGURATION STATUS
            </div>

            <div class="validation-table-cell">
              PROPULSION
            </div>

          </div>

          <div class="validation-table-row validation-table-content">

            <div class="validation-table-cell">

              <div class="validation-cell-label">
                SPACECRAFT VERIFICATION
              </div>


              ${
                displayOk
                  ? `
                    <div class="validation-pass-block">

                      <div class="validation-result-title">

                        <span class="validation-result-icon">
                          ✓
                        </span>

                        <strong>
                          Validation Complete
                        </strong>

                      </div>

                      <p>
                        All spacecraft validation checks pass.
                      </p>

                    </div>
                  `
                  : `
                    <div class="validation-fail-block">

                      <div class="validation-result-title">

                        <span class="validation-result-icon">
                          ⚠
                        </span>

                        <strong>
                          Action Required
                        </strong>

                      </div>

                      <p>
                        Fix the following issues before simulation.
                      </p>

                    </div>
                  `
              }


              ${
                displayWarnings.length
                  ? `
                    <div class="validation-warning-list">

                      ${displayWarnings
                        .map(
                          (warning) => `
                            <div class="validation-warning">

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
                  : `
                    <div class="validation-no-warning">

                      <span>
                        ✓
                      </span>

                      <span>
                        No validation warnings detected.
                      </span>

                    </div>
                  `
              }

            </div>

            <div class="validation-table-cell">

              <div class="validation-cell-label">
                AVAILABLE DELTA-V
              </div>


              <div class="validation-dv">

                <div class="validation-dv-number">
                  ${availableDeltaV}
                  <span>m/s</span>
                </div>


                <p>
                  Estimated available propulsion capability
                  for the current spacecraft configuration.
                </p>

              </div>


              <div class="validation-propulsion-status">

                <span class="validation-propulsion-dot"></span>

                <span>
                  PROPULSION STATUS:
                </span>

                <strong>
                  NOMINAL
                </strong>

              </div>

            </div>

          </div>

          <div class="validation-table-row validation-table-footer">

            <div class="validation-footer-item">

              <span>
                CONFIGURATION
              </span>

              <strong class="${statusClass}">
                ${displayOk ? "PASS" : "FAIL"}
              </strong>

            </div>


            <div class="validation-footer-item">

              <span>
                PROPULSION
              </span>

              <strong class="success">
                NOMINAL
              </strong>

            </div>

          </div>

        </div>

      </section>

      <section class="validation-action-bar">

        <div class="validation-action-info">

          <span class="validation-section-label">
            SIMULATION CONTROL
          </span>

          <h2>
            Ready for Nominal Simulation
          </h2>

          <p>
            Test the current spacecraft design under
            nominal mission conditions.
          </p>

        </div>


        <a
          href="#simulation"
          class="validation-simulation-link"
        >

          <button
            type="button"
            class="validation-simulation-button"
          >

            RUN SIMULATION

            <span>
              →
            </span>

          </button>

        </a>

      </section>

      <footer class="validation-footer">

        <span>
          MISSIONFORGE // VALIDATION
        </span>

        <span>
          Configuration verification must pass before
          nominal simulation.
        </span>

      </footer>

    </main>

  `;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
