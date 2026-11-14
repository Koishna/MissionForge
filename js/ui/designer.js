import { setState } from "../state.js";
import { resolveSpacecraft } from "../core/resources.js";
import { validateSpacecraft } from "../core/validate.js";
import { renderDashboard } from "./dashboard.js";
import { rolePicker, ROLES } from "./team.js";

const CATS = [
  "bus",
  "power",
  "battery",
  "comms",
  "computer",
  "pointing",
  "propulsion",
];

function getValue(value) {
  if (value && typeof value === "object" && "value" in value) {
    return value.value;
  }

  return value;
}

function formatNumber(value, digits = 0) {
  const actualValue = getValue(value);

  if (actualValue === undefined || actualValue === null || actualValue === "") {
    return null;
  }

  const number = Number(actualValue);

  return Number.isFinite(number) ? number.toFixed(digits) : null;
}

function componentSpecs(item) {
  const specs = [];

  const mass = formatNumber(item.mass_kg);
  if (mass !== null) {
    specs.push(`
      <span class="spec-item mass-spec">
        ⚖ Mass: ${mass} kg
      </span>
    `);
  }

  const budget = formatNumber(item.cost_usd_m, 1);
  if (budget !== null) {
    specs.push(`
      <span class="spec-item cost-spec">
        💰 Budget: ${budget} M USD
      </span>
    `);
  }

  const consumption = formatNumber(item.power_w);
  if (consumption !== null) {
    specs.push(`
      <span class="spec-item power-spec">
        ⚡ Consumes: ${consumption} W
      </span>
    `);
  }

  const generation = formatNumber(item.power_generated_w);
  if (generation !== null) {
    specs.push(`
      <span class="spec-item generation-spec">
        ☀ Generates: ${generation} W
      </span>
    `);
  }

  const battery = formatNumber(item.capacity_wh);
  if (battery !== null) {
    specs.push(`
      <span class="spec-item battery-spec">
        🔋 Capacity: ${battery} Wh
      </span>
    `);
  }

  const dataRate = formatNumber(item.data_rate_kbps);
  if (dataRate !== null) {
    specs.push(`
      <span class="spec-item">
        📡 Data: ${dataRate} kbit/s
      </span>
    `);
  }

  const downlink = formatNumber(item.downlink_kbps);
  if (downlink !== null) {
    specs.push(`
      <span class="spec-item">
        📥 Downlink: ${downlink} kbit/s
      </span>
    `);
  }

  const propellant = formatNumber(item.propellant_kg);
  if (propellant !== null) {
    specs.push(`
      <span class="spec-item">
        🚀 Propellant: ${propellant} kg
      </span>
    `);
  }

  const isp = formatNumber(item.isp_s);
  if (isp !== null) {
    specs.push(`
      <span class="spec-item">
        Isp: ${isp} s
      </span>
    `);
  }

  return `
    <div class="component-specs">
      ${specs.join("")}
    </div>
  `;
}

export function renderDesigner(app, currentState) {
  const d = currentState.data;
  const sc = currentState.spacecraft;

  const allowed = ROLES[currentState.role].controls;
  const resolved = resolveSpacecraft(sc, d);

  const check = validateSpacecraft(resolved, currentState.mission);

  const updateSpacecraft = (patch) => {
    const newSpacecraft = {
      ...currentState.spacecraft,
      ...patch,
    };

    setState({
      spacecraft: newSpacecraft,
    });

    renderDesigner(app, {
      ...currentState,
      spacecraft: newSpacecraft,
    });
  };

  const componentBlock = (category) => {
    const categoryAllowed = allowed.includes(category);

    const components = d.components.components.filter(
      (item) => item.category === category,
    );

    return `

      <div class="category-card">

        <div class="category-title">

          <h3>${category}</h3>

          ${
            !categoryAllowed
              ? `
                <span class="permission-label">
                  Not assigned
                </span>
              `
              : ""
          }

        </div>

        <div class="component-options">

          ${components
            .map((component) => {
              const selected = sc.components.includes(component.id);

              const disabled = !categoryAllowed && !selected;

              return `

                <label class="
                  component-option
                  ${selected ? "selected" : ""}
                  ${disabled ? "disabled" : ""}
                ">

                  <input
                    type="checkbox"
                    class="component-checkbox"
                    data-category="${category}"
                    value="${component.id}"
                    ${selected ? "checked" : ""}
                    ${disabled ? "disabled" : ""}
                  >

                  <div class="component-info">

                    <span class="component-name">
                      ${component.name}
                    </span>

                    ${componentSpecs(component)}

                  </div>

                  ${
                    selected
                      ? `
                        <span class="selected-mark">
                          ✓
                        </span>
                      `
                      : ""
                  }

                </label>

              `;
            })
            .join("")}

        </div>

      </div>

    `;
  };

  const instrumentBlock = () => {
    const instrumentsAllowed = allowed.includes("instruments");

    return `

      <div class="category-card instrument-card">

        <div class="category-title">

          <h3>Science Instruments</h3>

          ${
            !instrumentsAllowed
              ? `
                <span class="permission-label">
                  Not assigned
                </span>
              `
              : `
                <span class="permission-label">
                  Multiple allowed
                </span>
              `
          }

        </div>

        <div class="component-options">

          ${d.components.instruments
            .map((instrument) => {
              const selected = sc.instruments.includes(instrument.id);

              const why = check.locked?.[instrument.id];

              const disabled = !instrumentsAllowed && !selected;

              return `

                  <label class="
                    component-option
                    instrument-option
                    ${selected ? "selected" : ""}
                    ${disabled ? "disabled" : ""}
                  ">

                    <input
                      type="checkbox"
                      class="instrument-checkbox"
                      value="${instrument.id}"
                      ${selected ? "checked" : ""}
                      ${disabled ? "disabled" : ""}
                    >

                    <div class="component-info">

                      <span class="component-name">
                        ${instrument.name}
                      </span>

                      ${componentSpecs(instrument)}

                      ${
                        why
                          ? `
                            <small class="locked-message">
                              Warning: ${why}
                            </small>
                          `
                          : ""
                      }

                    </div>

                    ${
                      selected
                        ? `
                          <span class="selected-mark">
                            ✓
                          </span>
                        `
                        : ""
                    }

                  </label>

                `;
            })
            .join("")}

        </div>

      </div>

    `;
  };

  const selectBlock = (id, label, list, currentValue, permissionKey) => {
    const enabled = allowed.includes(permissionKey);

    return `

      <div class="select-card">

        <label for="${id}">

          <strong>${label}</strong>

          <select
            id="${id}"
            ${enabled ? "" : "disabled"}
          >

            <option value="">
              Choose ${label.toLowerCase()}...
            </option>

            ${list
              .map(
                (item) => `

                <option
                  value="${item.id}"
                  ${currentValue === item.id ? "selected" : ""}
                >
                  ${item.name}
                </option>

              `,
              )
              .join("")}

          </select>

        </label>

      </div>

    `;
  };

  const allWarnings = [...check.warnings, ...check.cautions];

  const warningsHTML = allWarnings.length
    ? allWarnings
        .map(
          (warning) => `

            <div class="warning-item">
              ⚠ ${warning}
            </div>

          `,
        )
        .join("")
    : `

          <div class="success-item">
            ✓ No warnings
          </div>

        `;

  app.innerHTML = `

    <div class="designer-page">

      <div
        class="panel role-panel"
        id="roles"
      ></div>

      <div class="designer-header">

        <div>

          <span class="screen-kicker">
            MISSIONFORGE / MISSION CONFIGURATION
          </span>

          <h2>
            Spacecraft Designer
          </h2>

          <p>
            Configure your spacecraft by selecting
            components, science instruments,
            mission orbit and launch vehicle.
          </p>

        </div>

      </div>

      <div class="designer-layout">

        <div class="panel components-panel">

          <div class="section-heading">

            <div>

              <span class="screen-kicker">
                CONFIGURATION
              </span>

              <h2>
                Spacecraft Components
              </h2>

              <p>
                Select one component from each category.
                Click a selected component again to remove it.
              </p>

            </div>

          </div>

          <div class="component-grid">

            ${CATS.map(componentBlock).join("")}

          </div>

          <div class="instruments-section">

            ${instrumentBlock()}

          </div>

          <div class="mission-selection">

            ${selectBlock(
              "orbit",
              "Mission Orbit",
              d.orbits.orbits,
              sc.orbitId,
              "orbit",
            )}

            ${selectBlock(
              "launcher",
              "Launch Vehicle",
              d.components.launchers,
              sc.launcherId,
              "launcher",
            )}

          </div>

        </div>

        <div class="designer-sidebar">

          <div
            class="panel dashboard-panel"
            id="dash"
          ></div>

          <div class="panel warnings-panel">

            <span class="screen-kicker">
              SYSTEM CHECK
            </span>

            <h2>
              Design Status
            </h2>

            ${warningsHTML}

          </div>

          <button
            type="button"
            id="start-validation-btn"
            style="
              display: block;
              visibility: visible;
              opacity: 1;
              width: 100%;
              padding: 16px;
              margin-top: 20px;
              background: #6c63ff;
              color: #ffffff;
              border: none;
              border-radius: 10px;
              font-size: 16px;
              font-weight: bold;
              cursor: pointer;
              position: relative;
              z-index: 10;
            "
          >
            Start Validation →
          </button>

        </div>

      </div>

    </div>

  `;

  rolePicker(app.querySelector("#roles"));

  renderDashboard(app.querySelector("#dash"), resolved, currentState.mission);

  app.querySelectorAll(".component-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const category = checkbox.dataset.category;

      const componentId = checkbox.value;

      let components = [...currentState.spacecraft.components];

      if (checkbox.checked) {
        components = components.filter((id) => {
          const component = d.components.components.find(
            (item) => item.id === id,
          );

          return !component || component.category !== category;
        });

        components.push(componentId);
      } else {
        components = components.filter((id) => id !== componentId);
      }

      updateSpacecraft({
        components,
      });
    });
  });

  app.querySelectorAll(".instrument-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      let instruments = [...currentState.spacecraft.instruments];

      const instrumentId = checkbox.value;

      if (checkbox.checked) {
        if (!instruments.includes(instrumentId)) {
          instruments.push(instrumentId);
        }
      } else {
        instruments = instruments.filter((id) => id !== instrumentId);
      }

      updateSpacecraft({
        instruments,
      });
    });
  });

  const orbitSelect = app.querySelector("#orbit");

  if (orbitSelect) {
    orbitSelect.addEventListener("change", (event) => {
      updateSpacecraft({
        orbitId: event.target.value || null,
      });
    });
  }

  const launcherSelect = app.querySelector("#launcher");

  if (launcherSelect) {
    launcherSelect.addEventListener("change", (event) => {
      updateSpacecraft({
        launcherId: event.target.value || null,
      });
    });
  }

  const validationButton = app.querySelector("#start-validation-btn");

  if (validationButton) {
    validationButton.addEventListener("click", () => {
      window.location.hash = "validation";
    });
  }
}
