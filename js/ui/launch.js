import { val } from "../core/units.js";
import {
  resolveSpacecraft,
  wetMassKg,
  massMarginFrac,
  powerGeneratedW,
  powerConsumedW,
  costUsdM,
  batteryCapacityWh,
  downlinkRateKbps,
} from "../core/resources.js";
import { validateSpacecraft } from "../core/validate.js";
import { deltaVms } from "../core/propulsion.js";
import { linkMarginDb } from "../core/comms.js";
import { runMonteCarlo } from "../uncertainty/monteCarlo.js";
import { createScene, destroyScene, showBeat } from "./scene.js";
import { setState } from "../state.js";
import { renderEventLog } from "./eventLog.js";
import { renderDecisionCard } from "./decisionCard.js";
import { formatMet } from "./hud.js";

const PREVIEW_RUNS = 200;

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

export function missingParts(r) {
  const m = [];
  if (!r.orbit) m.push("an orbit");
  if (!r.launcher) m.push("a launch vehicle");
  if (r.instruments.length === 0) m.push("at least one instrument");
  if (downlinkRateKbps(r) <= 0) m.push("a comms transmitter");
  if (batteryCapacityWh(r) <= 0) m.push("a battery");
  return m;
}

export function riskLabel(successRate) {
  return successRate >= 0.8 ? "Low" : successRate >= 0.55 ? "Moderate" : "High";
}

const n0 = (x) => Number(x).toFixed(0);

function row(label, value, status, note = "") {
  return { label, value, status, note };
}

export function preflightReport(r, mission, validation) {
  const missing = missingParts(r);
  const rows = [];
  const cap = r.launcher ? val(r.launcher.capacity_kg) : null;

  rows.push(
    r.launcher
      ? row(
          "Mass",
          `${n0(wetMassKg(r))} of ${n0(cap)} kg`,
          massMarginFrac(r) < 0
            ? "over"
            : massMarginFrac(r) < 0.05
              ? "low"
              : "ok",
          `${(massMarginFrac(r) * 100).toFixed(0)}% spare`,
        )
      : row("Mass", "No launch vehicle chosen", "unknown"),
  );

  const budget = mission.requirements.budget_usd_m;
  rows.push(
    row(
      "Cost",
      `${n0(costUsdM(r))} of ${n0(budget)} M USD`,
      costUsdM(r) > budget
        ? "over"
        : costUsdM(r) > budget * 0.95
          ? "low"
          : "ok",
    ),
  );

  const gen = powerGeneratedW(r),
    use = powerConsumedW(r);
  rows.push(
    row(
      "Power",
      `${n0(use)} W used, ${n0(gen)} W made`,
      use > gen ? "over" : gen < use * 1.1 ? "low" : "ok",
    ),
  );

  if (r.orbit) {
    const have = deltaVms(r),
      need = val(r.orbit.insertion_dv_ms);
    rows.push(
      row(
        "Delta-v",
        `${n0(have)} m/s, orbit needs ${n0(need)} m/s`,
        have < need ? "over" : have < need * 1.1 ? "low" : "ok",
      ),
    );
  } else rows.push(row("Delta-v", "No orbit chosen", "unknown"));

  const link = linkMarginDb(r);
  rows.push(
    row(
      "Radio link",
      link <= -99 ? "No working radio" : `${link.toFixed(1)} dB margin`,
      link < 0 ? "over" : link < 3 ? "low" : "ok",
    ),
  );

  return {
    missing,
    ready: missing.length === 0,
    rows,
    warnings: validation ? validation.warnings : [],
    cautions: validation ? validation.cautions : [],
  };
}

function ensureCss(href) {
  if (typeof document === "undefined") return;
  if (document.querySelector(`link[href$="${href}"]`)) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = href;
  document.head.appendChild(l);
}

const STATUS_TEXT = {
  ok: "OK",
  low: "Tight",
  over: "Over limit",
  unknown: "Not set",
};

let active = null;

function summaryHtml(rep) {
  return `<dl class="launch-rows">${rep.rows
    .map(
      (x) => `
    <div class="launch-row" data-status="${x.status}">
      <dt>${esc(x.label)}</dt>
      <dd>${esc(x.value)}${x.note ? ` <small>(${esc(x.note)})</small>` : ""}</dd>
      <dd class="launch-status">${STATUS_TEXT[x.status]}</dd>
    </div>`,
    )
    .join("")}</dl>`;
}

function oddsHtml(mc) {
  const pct = (x) => `${Math.round(x * 100)}%`;
  const rate = mc.successRate,
    lo = mc.ci95[0],
    hi = mc.ci95[1];
  return `<div class="launch-odds">
    <p class="launch-odds-main"><strong>${pct(rate)}</strong> chance of success
      <span class="launch-risk" data-risk="${riskLabel(rate).toLowerCase()}">${riskLabel(rate)} risk</span></p>
    <div class="launch-meter" role="img" aria-label="Success chance ${pct(rate)}, likely between ${pct(lo)} and ${pct(hi)}">
      <span class="launch-meter-range" style="left:${(lo * 100).toFixed(1)}%;width:${((hi - lo) * 100).toFixed(1)}%"></span>
      <span class="launch-meter-mark" style="left:${(rate * 100).toFixed(1)}%"></span>
    </div>
    <p><small>Likely between ${pct(lo)} and ${pct(hi)}. Conditions in space are uncertain, so this is a range, not a promise.
      It is a simulated estimate, not a real-world flight probability.</small></p>
  </div>`;
}

function stopPlayback() {
  if (!active) return;
  clearTimeout(active.timer);
  if (active.run && !active.done) setState({ run: null });
  destroyScene(active.scene);
  active = null;
}
function flightMarkup() {
  return `<div class="panel launch launch-flight"><h2>Mission in progress</h2><div class="launch-hud panel" id="flight-hud"></div><div id="launch-flight-scene"></div><div class="launch-flight-grid"><section><h3>Mission events</h3><div id="flight-log"></div></section><section><h3>Mission decision</h3><div id="flight-decision"></div></section></div><p class="launch-actions"><button id="flight-pause" type="button">Pause</button><button id="flight-speed" class="secondary" type="button" aria-pressed="false">Speed x2</button><button id="flight-skip" class="secondary" type="button">Skip beat</button></p><p id="flight-status" role="status" aria-live="polite"></p></div>`;
}
function scheduleBeat(delay = 1700) {
  if (!active || active.paused || active.waiting || active.done) return;
  clearTimeout(active.timer);
  active.timer = setTimeout(advanceBeat, active.double ? delay / 2 : delay);
}
function advanceBeat() {
  const flight = active;
  if (!flight || flight.paused || flight.waiting || flight.done) return;
  const beat = flight.run.step();
  if (!beat) {
    finishFlight(flight);
    return;
  }
  flight.beats.push(beat);
  showBeat(flight.scene, beat);
  flight.renderHud(
    document.getElementById("flight-hud"),
    flight.run.snapshot(),
  );
  renderEventLog(
    document.getElementById("flight-log"),
    flight.beats,
    formatMet,
  );
  const status = document.getElementById("flight-status");
  if (status) status.textContent = `${beat.title}. ${beat.text}`;
  if (beat.decision?.options?.length) {
    flight.waiting = true;
    renderDecisionCard(
      document.getElementById("flight-decision"),
      beat.decision,
      (_, optionId) => {
        if (active !== flight) return;
        try {
          flight.run.choose(beat.decision.id, optionId);
          flight.waiting = false;
          document.getElementById("flight-decision").replaceChildren();
          flight.renderHud(
            document.getElementById("flight-hud"),
            flight.run.snapshot(),
          );
          scheduleBeat();
        } catch (error) {
          document.getElementById("flight-status").textContent = error.message;
        }
      },
    );
    return;
  }
  scheduleBeat();
}
function finishFlight(flight) {
  if (active !== flight || flight.done) return;
  flight.done = true;
  clearTimeout(flight.timer);
  const outcome = flight.run.result();
  setState({ run: null, results: { ...(state.results || {}), outcome } });
  const status = document.getElementById("flight-status");
  if (status)
    status.textContent = outcome.success
      ? "Mission complete."
      : "Mission failed.";
  const actions = document.querySelector(".launch-flight .launch-actions");
  if (actions)
    actions.innerHTML =
      '<a href="#report"><button type="button">See results</button></a>';
}
export function renderLaunch(app, state) {
  stopPlayback();
  ensureCss("css/scene.css");
  ensureCss("css/launch.css");
  ensureCss("css/hud.css");
  const r = resolveSpacecraft(state.spacecraft, state.data);
  const validation = validateSpacecraft(r, state.mission);
  const rep = preflightReport(r, state.mission, validation);
  const seed = state.seed ?? 42;
  app.innerHTML = `
  <div class="panel launch"><h2>Ready to launch?</h2><p>Your spacecraft flies to the Moon and the mission plays out one step at a time. Events can happen on the way, and some will ask you to decide.</p><div id="launch-scene"></div></div>
  <div class="panel launch"><h2>Pre-flight check</h2>
   ${rep.missing.length ? `<p class="warn">Your design is not ready. Add ${esc(rep.missing.join(", "))} in the designer first.</p>` : ""}
   ${summaryHtml(rep)}<div id="launch-odds" aria-live="polite"></div>
   ${rep.ready && rep.warnings.length ? `<div class="launch-issues"><p><strong>The system check found ${rep.warnings.length} problem${rep.warnings.length === 1 ? "" : "s"}:</strong></p><ul>${rep.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul><p>You can still launch. The mission may fail, and the report will show why.</p></div>` : ""}
   ${rep.ready && !rep.warnings.length && rep.cautions.length ? `<ul class="launch-cautions">${rep.cautions.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}
   <p class="launch-actions"><button id="launch-go" ${rep.ready ? "" : "disabled"}>${rep.ready && rep.warnings.length ? "Launch anyway" : "Launch mission"}</button> <a href="#designer"><button type="button" class="secondary">Back to the designer</button></a></p><p id="launch-note" class="launch-note" role="status"></p>
  </div>`;
  const preview = createScene(app.querySelector("#launch-scene"));
  active = { app, scene: preview, timer: 0, done: true };
  if (rep.ready)
    app.querySelector("#launch-odds").innerHTML = oddsHtml(
      runMonteCarlo(
        r,
        state.mission,
        state.data.uncertainty,
        PREVIEW_RUNS,
        seed,
      ),
    );
  app.querySelector("#launch-go").addEventListener("click", async () => {
    const note = app.querySelector("#launch-note");
    try {
      const [{ createMissionRun }, { renderHud }] = await Promise.all([
        import("../sim/missionRun.js"),
        import("./hud.js"),
      ]);
      const run = createMissionRun({
        r,
        mission: state.mission,
        data: state.data,
        seed,
      });
      setState({ run });
      destroyScene(preview);
      app.innerHTML = flightMarkup();
      active = {
        app,
        run,
        scene: createScene(app.querySelector("#launch-flight-scene")),
        beats: [],
        timer: 0,
        paused: false,
        double: false,
        waiting: false,
        done: false,
        renderHud,
      };
      renderHud(document.getElementById("flight-hud"), run.snapshot());
      app.querySelector("#flight-pause").addEventListener("click", (e) => {
        if (!active) return;
        active.paused = !active.paused;
        e.currentTarget.textContent = active.paused ? "Resume" : "Pause";
        if (!active.paused && !active.waiting) scheduleBeat(0);
      });
      app.querySelector("#flight-speed").addEventListener("click", (e) => {
        if (!active) return;
        active.double = !active.double;
        e.currentTarget.setAttribute("aria-pressed", String(active.double));
        e.currentTarget.textContent = active.double ? "Speed x1" : "Speed x2";
      });
      app.querySelector("#flight-skip").addEventListener("click", () => {
        if (!active || active.done || active.waiting) return;
        clearTimeout(active.timer);
        advanceBeat();
      });
      advanceBeat();
    } catch (error) {
      note.textContent = `The flight could not start: ${error.message}`;
    }
  });
  if (!window.__missionForgeLaunchCleanup) {
    window.__missionForgeLaunchCleanup = true;
    window.addEventListener("hashchange", () => {
      if (location.hash !== "#launch") stopPlayback();
    });
  }
}
