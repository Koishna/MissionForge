import { setState } from "../state.js";
import {
  resolveSpacecraft,
  downlinkRateKbps,
  batteryCapacityWh,
} from "../core/resources.js";
import { runMonteCarlo } from "../uncertainty/monteCarlo.js";
import { badge } from "./badge.js";

const RUNS = 1000,
  SEED = 42;

function missingParts(r) {
  const m = [];
  if (!r.orbit) m.push("an orbit");
  if (!r.launcher) m.push("a launch vehicle");
  if (r.instruments.length === 0) m.push("at least one instrument");
  if (downlinkRateKbps(r) <= 0) m.push("a comms transmitter");
  if (batteryCapacityWh(r) <= 0) m.push("a battery");
  return m;
}

function histogram(mc) {
  const bins = 20,
    mins = mc.minBatteryWh;
  const lo = Math.min(...mins),
    hi = Math.max(...mins, lo + 1);
  const counts = Array(bins).fill(0);
  mins.forEach((m) => {
    counts[Math.min(bins - 1, Math.floor(((m - lo) / (hi - lo)) * bins))]++;
  });
  const top = Math.max(...counts);
  const bars = counts
    .map((c, i) => {
      const from = lo + (i * (hi - lo)) / bins,
        to = lo + ((i + 1) * (hi - lo)) / bins;
      return `<div style="height:${(c / top) * 100}%" title="${from.toFixed(0)}-${to.toFixed(0)} Wh: ${c} trials"></div>`;
    })
    .join("");
  return `<div class="hist" role="img" aria-label="Histogram of the lowest battery level reached in each trial">${bars}</div>
    <div style="display:flex;justify-content:space-between;font-size:.85rem">
      <span>${lo.toFixed(0)} Wh</span>
      <span>lowest battery level reached in a trial (Wh)</span>
      <span>${hi.toFixed(0)} Wh</span>
    </div>
    <p><small>Each bar counts trials. Trials at or below 0 Wh ran out of battery.</small></p>`;
}

function show(mc) {
  const pct = (x) => (x * 100).toFixed(1) + "%";
  const failed = mc.runs - Math.round(mc.successRate * mc.runs);
  const causes = Object.entries(mc.failures)
    .sort((a, b) => b[1] - a[1])
    .map(([why, n]) => `<li>${why} (${n} trials)</li>`)
    .join("");
  return `<p><strong>${pct(mc.successRate)}</strong> of ${mc.runs} trials succeeded.
      We are 95% confident the true rate under these assumptions is between ${pct(mc.ci95[0])} and ${pct(mc.ci95[1])}.</p>
    <p>${failed} trials failed.</p>
    ${causes ? `<p>Why they failed:</p><ul>${causes}</ul>` : "<p>No trial failed.</p>"}
    ${histogram(mc)}
    <p><small>Settings: ${mc.runs} runs, random seed ${mc.seed}. The same seed repeats the same result.</small></p>`;
}

export function renderRealityCheck(app, state) {
  const cfg = state.data.uncertainty;
  app.innerHTML = `<div class="panel"><h2>Reality Check</h2>
    <p>The same design, re-run ${RUNS} times with uncertain parameters.</p>
    <p>Battery fade ${badge(cfg.battery_fade_per_month)} Solar output ${badge(cfg.solar_scale)} Downlink ${badge(cfg.downlink_scale)}</p>
    <button id="run">Run ${RUNS} trials</button>
    <div id="out">${state.results.monteCarlo ? show(state.results.monteCarlo) : ""}</div>
    <p><a href="#report"><button>See the report</button></a></p></div>
    <div class="panel"><h2>Limitations</h2><ul>
      <li>Battery spread comes from only 4 NASA lab cells and a straight-line fit. They are an analogue, not a flight battery.</li>
      <li>The average battery fade (1% per month) is a game assumption. Only the spread between cells comes from the data.</li>
      <li>Solar output and downlink ranges are illustrative game assumptions.</li>
      <li>This is simulated reliability under stated assumptions, not a flight probability.</li></ul></div>`;
  app.querySelector("#run").addEventListener("click", () => {
    const r = resolveSpacecraft(state.spacecraft, state.data);
    const missing = missingParts(r);
    const out = app.querySelector("#out");
    if (missing.length) {
      out.innerHTML = `<p class="warn">Your design is incomplete. Add ${missing.join(", ")} in the Designer first.</p>`;
      return;
    }
    const mc = runMonteCarlo(r, state.mission, cfg, RUNS, SEED);
    setState({ results: { ...state.results, monteCarlo: mc } });
    out.innerHTML = show(mc);
  });
}
