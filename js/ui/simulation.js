import { setState } from "../state.js";
import { resolveSpacecraft } from "../core/resources.js";
import { simulateNominal } from "../sim/simulate.js";
import { applyEvents } from "../sim/events.js";
import { SECONDS_PER_MONTH } from "../core/units.js";
import { badge } from "./badge.js";

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

const STYLE = `
.sim-scroll{overflow-x:auto}
.sim-scroll:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.sim-chart{width:100%;min-width:600px;height:auto;display:block}
.sim-chart text{fill:var(--muted);font-size:11px;font-family:inherit}
.sim-axis{stroke:var(--line);stroke-width:1;fill:none}
.sim-cap{stroke:var(--muted);stroke-width:1.5;stroke-dasharray:5 4;fill:none}
.sim-base{stroke:var(--muted);stroke-width:1.5;stroke-dasharray:1 3;fill:none}
.sim-low{stroke:var(--accent);stroke-width:2.5;fill:none;stroke-linejoin:round}
.sim-ecl{fill:var(--line);stroke:var(--muted);stroke-width:1}
.sim-fail{stroke:var(--bad);stroke-width:2}
.sim-chart text.sim-failtxt{fill:var(--bad);font-weight:600}
.sim-chart text.sim-lead{fill:var(--text)}
.sim-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.5rem 1.25rem;margin:1rem 0 0}
.sim-stats dt{color:var(--muted);font-size:.85rem}
.sim-stats dd{margin:0 0 .25rem;font-weight:600}
.sim-controls label.row{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center}
.sim-controls input[type=range]{flex:1 1 220px;max-width:360px}
.sim-controls small{display:block;color:var(--muted)}
`;
function injectStyle() {
  if (typeof document === "undefined" || document.getElementById("sim-style"))
    return;
  const el = document.createElement("style");
  el.id = "sim-style";
  el.textContent = STYLE;
  document.head.appendChild(el);
}

export function eclipseFreeWindows(timeline) {
  const out = [];
  let start = null;
  timeline.forEach((p, i) => {
    const m = p.tS / SECONDS_PER_MONTH,
      free = p.eclipseMin < 0.5;
    if (free && start === null) start = m;
    if ((!free || i === timeline.length - 1) && start !== null) {
      out.push([start, m]);
      start = null;
    }
  });
  return out;
}

const niceMax = (x) => {
  const p = 10 ** Math.floor(Math.log10(Math.max(x, 1)));
  return Math.ceil(x / p) * p;
};

export function chartSvg(res, base, months, label = "") {
  const W = 720,
    L = 52,
    R = 14,
    T = 30,
    PH = 210,
    PW = W - L - R,
    stripTop = T + PH + 28,
    SH = 46,
    H = stripTop + SH + 40;
  const xMax = months * SECONDS_PER_MONTH,
    X = (tS) => L + (tS / xMax) * PW;
  const tl = res.timeline;
  const yMax = niceMax(
    Math.max(
      ...tl.map((p) => p.capWh),
      ...(base ? base.timeline.map((p) => p.capWh) : [0]),
    ),
  );
  const Y = (wh) => T + PH - (Math.max(0, wh) / yMax) * PH;
  const line = (pts, f) =>
    pts
      .map((p, i) => `${i ? "L" : "M"}${X(p.tS).toFixed(1)},${f(p).toFixed(1)}`)
      .join("");
  const eclMax = Math.max(1, ...tl.map((p) => p.eclipseMin));
  const E = (min) => stripTop + SH - (min / eclMax) * SH;

  let svg = `<svg class="sim-chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(label)}">`;
  [0, 0.5, 1].forEach((f) => {
    const y = Y(yMax * f);
    svg += `<path class="sim-axis" d="M${L},${y} H${W - R}"/><text x="${L - 8}" y="${y + 4}" text-anchor="end">${Math.round(yMax * f)}</text>`;
  });
  svg += `<text x="${L - 8}" y="${T - 14}" text-anchor="end">Wh</text>`;
  svg += `<path class="sim-cap" d="${line(tl, (p) => Y(p.capWh))}"/>`;
  if (base)
    svg += `<path class="sim-base" d="${line(base.timeline, (p) => Y(p.batteryWh))}"/>`;
  svg += `<path class="sim-low" d="${line(tl, (p) => Y(p.batteryWh))}"/>`;
  svg += `<text class="sim-lead" x="${L + 6}" y="${Y(tl[0].capWh) - 6}">Battery capacity (dashed) and lowest level in each orbit</text>`;
  if (res.depletedAtS != null) {
    const x = X(res.depletedAtS);
    svg += `<path class="sim-fail" d="M${x},${T} V${T + PH}"/><text class="sim-failtxt" x="${Math.min(x + 6, W - 120)}" y="${T + 14}">Battery empty</text>`;
  }
  const area = `M${X(tl[0].tS)},${stripTop + SH} ${tl.map((p) => `L${X(p.tS).toFixed(1)},${E(p.eclipseMin).toFixed(1)}`).join("")} L${X(tl[tl.length - 1].tS)},${stripTop + SH} Z`;
  svg += `<path class="sim-ecl" d="${area}"/>`;
  svg += `<text x="${L - 8}" y="${stripTop + 12}" text-anchor="end">${eclMax.toFixed(0)}</text><text x="${L - 8}" y="${stripTop + SH}" text-anchor="end">0</text>`;
  svg += `<text x="${L + 4}" y="${stripTop - 8}">Eclipse per orbit, minutes (the Sun's angle to the orbit plane sets its length)</text>`;
  eclipseFreeWindows(tl).forEach(([a, b]) => {
    const xa = X(a * SECONDS_PER_MONTH),
      xb = X(b * SECONDS_PER_MONTH);
    if (xb - xa > 56)
      svg += `<text class="sim-lead" x="${(xa + xb) / 2}" y="${stripTop + SH / 2 + 4}" text-anchor="middle">no eclipse</text>`;
  });
  const step = months <= 12 ? 1 : months <= 24 ? 2 : 3;
  for (let m = 0; m <= months; m += step) {
    svg += `<path class="sim-axis" d="M${X(m * SECONDS_PER_MONTH)},${stripTop + SH} v4"/><text x="${X(m * SECONDS_PER_MONTH)}" y="${stripTop + SH + 17}" text-anchor="middle">${m}</text>`;
  }
  svg += `<text x="${W - R}" y="${H - 2}" text-anchor="end">months since launch</text></svg>`;
  return svg;
}

const seasonText = (deg) =>
  deg <= 15
    ? "Sun in the orbit plane: the longest eclipses come first"
    : deg >= 75
      ? "Sun across the orbit plane: no eclipses at first"
      : "Sun part-way out of the orbit plane";

export function renderSimulation(app, state) {
  injectStyle();
  const d = state.data,
    months = state.mission.requirements.lifetime_months;
  const r = resolveSpacecraft(state.spacecraft, d);
  if (!r.orbit) {
    app.innerHTML = `<div class="panel"><h2>Nominal run</h2><p class="warn">Choose an orbit in the designer first. The run needs it.</p><p><a href="#designer"><button>Go to the designer</button></a></p></div>`;
    return;
  }
  const events = (d.events && d.events.events) || [];
  let phase = state.launchPhaseDeg ?? 0,
    active = state.activeEvents || [];

  app.innerHTML = `<div class="panel sim-controls"><h2>Nominal run</h2>
    <p>The spacecraft you designed, flown for ${months} months in the ${esc(r.orbit.name)} orbit.</p>
    <label class="row" for="sim-phase"><span>Launch season</span>
      <input id="sim-phase" type="range" min="0" max="180" step="5" value="${phase}" aria-describedby="sim-phase-note">
      <output id="sim-phase-out" for="sim-phase"></output></label>
    <small id="sim-phase-note">Where the Sun sits relative to the orbit plane at launch. It changes when the longest eclipses meet an ageing battery.</small>
    ${
      events.length
        ? `<fieldset><legend>What if something goes wrong?</legend>${events
            .map(
              (e) => `
      <label class="opt"><input type="checkbox" value="${esc(e.id)}" ${active.includes(e.id) ? "checked" : ""}> ${esc(e.name)} ${badge(e)}
      <small>Your response: ${esc(e.response)}</small></label>`,
            )
            .join("")}</fieldset>`
        : ""
    }</div>
    <div class="panel" id="sim-out" aria-live="polite"></div>`;

  const out = app.querySelector("#sim-out"),
    phaseOut = app.querySelector("#sim-phase-out");

  const update = () => {
    phaseOut.textContent = `${phase}°: ${seasonText(phase)}`;
    const base = simulateNominal(r, state.mission, { sunPhaseDeg: phase }); // the plain run
    const res = active.length
      ? simulateNominal(
          r,
          state.mission,
          applyEvents({ sunPhaseDeg: phase }, active, d.events),
        )
      : base;
    setState({
      launchPhaseDeg: phase,
      activeEvents: active,
      results: {
        ...state.results,
        nominal: base,
        scenario: active.length ? { events: active, result: res } : null,
      },
    });

    const verdict = (x) =>
      x.success ? "Success on paper." : "Mission failed.";
    const names = active
      .map((id) => events.find((e) => e.id === id)?.name)
      .filter(Boolean);
    const cap0 = res.timeline[0].capWh,
      ecl = `${res.eclipseMinShortest.toFixed(0)} to ${res.eclipseMin.toFixed(0)} min`;
    const need = state.mission.requirements.min_data_gb;
    out.innerHTML = `
      <p><strong>${verdict(res)}</strong>${active.length ? ` Event applied: ${esc(names.join(", "))}. Without it: ${verdict(base).toLowerCase()}` : ""}</p>
      ${res.reasons.map((x) => `<p class="warn">${esc(x)}</p>`).join("")}
      <figure style="margin:0">
        <div class="sim-scroll" tabindex="0">${chartSvg(res, active.length ? base : null, months, `Chart of the battery over ${months} months. Lowest level ${Math.max(0, res.minBatteryWh).toFixed(0)} watt-hours against a starting capacity of ${cap0.toFixed(0)}. ${res.success ? "The battery never runs out." : "The battery runs out."} Eclipse length per orbit ranges from ${ecl}.`)}</div>
        <figcaption><small>${active.length ? "Dotted line: the same flight without the event. " : ""}Eclipse length is ${badge(r.orbit.eclipse_by_beta || r.orbit.eclipse_fraction)} for a polar orbit fixed in space; event effects are game assumptions.</small></figcaption>
      </figure>
      <dl class="sim-stats">
        <div><dt>Orbit</dt><dd>${esc(r.orbit.name)}, ${(res.periodS / 60).toFixed(0)} min per orbit</dd></div>
        <div><dt>Eclipse per orbit</dt><dd>${ecl}</dd></div>
        <div><dt>Lowest battery level</dt><dd>${res.minBatteryWh < 0 ? `Empty: short by ${(-res.minBatteryWh).toFixed(0)} Wh` : `${res.minBatteryWh.toFixed(0)} Wh of ${cap0.toFixed(0)} Wh`}</dd></div>
        <div><dt>Data to the ground</dt><dd>${res.dataDownlinkedGb.toFixed(0)} GB of ${need} GB needed</dd></div>
        <div><dt>Delta-v</dt><dd>${res.dvAvailMs.toFixed(0)} m/s available, ${res.dvNeedMs.toFixed(0)} m/s needed</dd></div>
      </dl>
      <p><a href="#launch"><button>Launch mission</button></a> <a href="#reality"><button>Reality Check</button></a></p>`;
  };

  app.querySelector("#sim-phase").addEventListener("input", (e) => {
    phase = Number(e.target.value);
    update();
  });
  app.querySelectorAll("fieldset input[type=checkbox]").forEach((c) =>
    c.addEventListener("change", () => {
      active = [
        ...app.querySelectorAll("fieldset input[type=checkbox]:checked"),
      ].map((x) => x.value);
      update();
    }),
  );
  update();
}
