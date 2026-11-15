import { setState } from "../state.js";
import { resolveSpacecraft } from "../core/resources.js";
import { validateSpacecraft } from "../core/validate.js";
import { runMonteCarlo } from "../uncertainty/monteCarlo.js";
import { computeHealth, riskLevelFor } from "../game/health.js";
import { renderHud, designSnapshot } from "./hud.js";
import { renderGauge } from "./gauge.js";
import { renderDashboard } from "./dashboard.js";
import { rolePicker, ROLES } from "./team.js";

const CATS = ["bus", "power", "battery", "comms", "computer", "pointing", "propulsion"];

// Debounce for the live success probability (Reality Check keeps the 1,000-trial version).
let probabilityTimer = null;

function getValue(value) {
  if (value && typeof value === "object" && "value" in value) return value.value;
  return value;
}

function formatNumber(value, digits = 0) {
  const actualValue = getValue(value);
  if (actualValue === undefined || actualValue === null || actualValue === "") return null;
  const number = Number(actualValue);
  return Number.isFinite(number) ? number.toFixed(digits) : null;
}

function componentSpecs(item) {
  const specs = [];
  const add = (v, cls, text) => { if (v !== null) specs.push(`<span class="spec-item ${cls}">${text(v)}</span>`); };
  add(formatNumber(item.mass_kg), "mass-spec", (v) => `⚖ Mass: ${v} kg`);
  add(formatNumber(item.cost_usd_m, 1), "cost-spec", (v) => `💰 Budget: ${v} M USD`);
  add(formatNumber(item.power_w), "power-spec", (v) => `⚡ Consumes: ${v} W`);
  add(formatNumber(item.power_generated_w), "generation-spec", (v) => `☀ Generates: ${v} W`);
  add(formatNumber(item.capacity_wh), "battery-spec", (v) => `🔋 Capacity: ${v} Wh`);
  add(formatNumber(item.data_rate_kbps), "", (v) => `📡 Data: ${v} kbit/s`);
  add(formatNumber(item.downlink_kbps), "", (v) => `📥 Downlink: ${v} kbit/s`);
  add(formatNumber(item.propellant_kg), "", (v) => `🚀 Propellant: ${v} kg`);
  add(formatNumber(item.isp_s), "", (v) => `Isp: ${v} s`);
  return `<div class="component-specs">${specs.join("")}</div>`;
}

// Trade-off chips: every part shows what it gives and what it costs. Text plus a +/- sign, never colour alone.
function tradeoffChips(item) {
  const pros = (item.pros || []).map((t) => `<span class="chip pro">+ ${t}</span>`);
  const cons = (item.cons || []).map((t) => `<span class="chip con">- ${t}</span>`);
  return pros.length || cons.length ? `<span class="chips">${pros.join("")}${cons.join("")}</span>` : "";
}

export function renderDesigner(app, currentState) {
  clearTimeout(probabilityTimer);
  const d = currentState.data;
  const sc = currentState.spacecraft;
  const allowed = ROLES[currentState.role].controls;
  const resolved = resolveSpacecraft(sc, d);
  const check = validateSpacecraft(resolved, currentState.mission);
  // No nominal run yet in the designer, so health uses the downlink-capacity estimate.
  const health = computeHealth(resolved, currentState.mission, null, check);

  const updateSpacecraft = (patch) => {
    const newSpacecraft = { ...currentState.spacecraft, ...patch };
    setState({ spacecraft: newSpacecraft });
    renderDesigner(app, { ...currentState, spacecraft: newSpacecraft });
  };

  const componentBlock = (category) => {
    const categoryAllowed = allowed.includes(category);
    const components = d.components.components.filter((item) => item.category === category);
    return `<div class="category-card">
      <div class="category-title"><h3>${category}</h3>
        ${!categoryAllowed ? `<span class="permission-label">Not assigned</span>` : ""}</div>
      <div class="component-options">${components.map((component) => {
        const selected = sc.components.includes(component.id);
        const disabled = !categoryAllowed && !selected;
        return `<label class="component-option ${selected ? "selected" : ""} ${disabled ? "disabled" : ""}">
          <input type="checkbox" class="component-checkbox" data-category="${category}" value="${component.id}" ${selected ? "checked" : ""} ${disabled ? "disabled" : ""}>
          <div class="component-info"><span class="component-name">${component.name}</span>
            ${componentSpecs(component)}${tradeoffChips(component)}</div>
          ${selected ? `<span class="selected-mark">✓</span>` : ""}</label>`;
      }).join("")}</div></div>`;
  };

  const instrumentBlock = () => {
    const instrumentsAllowed = allowed.includes("instruments");
    return `<div class="category-card instrument-card">
      <div class="category-title"><h3>Science Instruments</h3>
        <span class="permission-label">${!instrumentsAllowed ? "Not assigned" : "Multiple allowed"}</span></div>
      <div class="component-options">${d.components.instruments.map((instrument) => {
        const selected = sc.instruments.includes(instrument.id);
        const why = check.locked?.[instrument.id];
        const disabled = !instrumentsAllowed && !selected;
        return `<label class="component-option instrument-option ${selected ? "selected" : ""} ${disabled ? "disabled" : ""}">
          <input type="checkbox" class="instrument-checkbox" value="${instrument.id}" ${selected ? "checked" : ""} ${disabled ? "disabled" : ""}>
          <div class="component-info"><span class="component-name">${instrument.name}</span>
            ${componentSpecs(instrument)}${tradeoffChips(instrument)}
            ${why ? `<small class="locked-message">Warning: ${why}</small>` : ""}</div>
          ${selected ? `<span class="selected-mark">✓</span>` : ""}</label>`;
      }).join("")}</div></div>`;
  };

  const selectBlock = (id, label, list, currentValue, permissionKey) => {
    const enabled = allowed.includes(permissionKey);
    return `<div class="select-card"><label for="${id}"><strong>${label}</strong>
      <select id="${id}" ${enabled ? "" : "disabled"}><option value="">Choose ${label.toLowerCase()}...</option>
        ${list.map((item) => `<option value="${item.id}" ${currentValue === item.id ? "selected" : ""}>${item.name}</option>`).join("")}
      </select></label></div>`;
  };

  const allWarnings = [...check.warnings, ...check.cautions];
  const warningsHTML = allWarnings.length
    ? allWarnings.map((w) => `<div class="warning-item">⚠ ${w}</div>`).join("")
    : `<div class="success-item">✓ No warnings</div>`;

  app.innerHTML = `<div class="designer-page">
    <div class="panel role-panel" id="roles"></div>
    <div class="designer-header"><div>
      <span class="screen-kicker">MISSIONFORGE / MISSION CONFIGURATION</span>
      <h2>Spacecraft Designer</h2>
      <p>Configure your spacecraft by selecting components, science instruments, mission orbit and launch vehicle.</p></div></div>

    <div class="panel" id="hud"></div>
    <div class="panel" id="gauge"></div>

    <div class="designer-layout">
      <div class="panel components-panel">
        <div class="section-heading"><div>
          <span class="screen-kicker">CONFIGURATION</span><h2>Spacecraft Components</h2>
          <p>Select one component from each category. Click a selected component again to remove it.</p></div></div>
        <div class="component-grid">${CATS.map(componentBlock).join("")}</div>
        <div class="instruments-section">${instrumentBlock()}</div>
        <div class="mission-selection">
          ${selectBlock("orbit", "Mission Orbit", d.orbits.orbits, sc.orbitId, "orbit")}
          ${selectBlock("launcher", "Launch Vehicle", d.components.launchers, sc.launcherId, "launcher")}
        </div>
      </div>

      <div class="designer-sidebar">
        <div class="panel dashboard-panel" id="dash"></div>
        <div class="panel warnings-panel">
          <span class="screen-kicker">SYSTEM CHECK</span><h2>Design Status</h2>${warningsHTML}</div>
        <button type="button" id="start-validation-btn" style="display:block;visibility:visible;opacity:1;width:100%;padding:16px;margin-top:20px;background:#6c63ff;color:#ffffff;border:none;border-radius:10px;font-size:16px;font-weight:bold;cursor:pointer;position:relative;z-index:10;">Start Validation →</button>
      </div>
    </div></div>`;

  rolePicker(app.querySelector("#roles"));
  renderDashboard(app.querySelector("#dash"), resolved, currentState.mission);

  // HUD first (risk still being estimated), then the live success probability after a short pause.
  const hud = app.querySelector("#hud"), gauge = app.querySelector("#gauge");
  renderHud(hud, designSnapshot(health, "estimating…"));
  if (!resolved.orbit || !resolved.launcher) {
    gauge.innerHTML = "<p>Choose an orbit and a launch vehicle to see the simulated success probability.</p>";
  } else {
    gauge.innerHTML = "<p>Estimating success probability…</p>";
    probabilityTimer = setTimeout(() => {
      if (!gauge.isConnected) return; // the player left this screen or the design changed
      try {
        const mc = runMonteCarlo(resolved, currentState.mission, d.uncertainty, 200, currentState.seed ?? 42);
        renderGauge(gauge, { value: mc.successRate, low: mc.ci95[0], high: mc.ci95[1], label: "Simulated success (200 trials)" });
        gauge.insertAdjacentHTML("beforeend", "<p><small>Simulated under stated assumptions, not a real-world flight probability.</small></p>");
        renderHud(hud, designSnapshot(health, mc.riskLevel || riskLevelFor(mc.successRate)));
      } catch (e) {
        gauge.innerHTML = "<p>Success probability is not available for this design yet.</p>";
      }
    }, 300);
  }

  app.querySelectorAll(".component-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const category = checkbox.dataset.category;
      const componentId = checkbox.value;
      let components = [...currentState.spacecraft.components];
      if (checkbox.checked) {
        components = components.filter((id) => {
          const component = d.components.components.find((item) => item.id === id);
          return !component || component.category !== category;
        });
        components.push(componentId);
      } else {
        components = components.filter((id) => id !== componentId);
      }
      updateSpacecraft({ components });
    });
  });

  app.querySelectorAll(".instrument-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      let instruments = [...currentState.spacecraft.instruments];
      const instrumentId = checkbox.value;
      if (checkbox.checked) {
        if (!instruments.includes(instrumentId)) instruments.push(instrumentId);
      } else {
        instruments = instruments.filter((id) => id !== instrumentId);
      }
      updateSpacecraft({ instruments });
    });
  });

  const orbitSelect = app.querySelector("#orbit");
  if (orbitSelect) orbitSelect.addEventListener("change", (e) => updateSpacecraft({ orbitId: e.target.value || null }));
  const launcherSelect = app.querySelector("#launcher");
  if (launcherSelect) launcherSelect.addEventListener("change", (e) => updateSpacecraft({ launcherId: e.target.value || null }));
  const validationButton = app.querySelector("#start-validation-btn");
  if (validationButton) validationButton.addEventListener("click", () => { window.location.hash = "validation"; });
}