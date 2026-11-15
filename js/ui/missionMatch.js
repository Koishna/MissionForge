// "Closest real mission" card for the report screen.
// Compares the player's design with real lunar orbiters in data/missions.json.
import { resolveSpacecraft, dryMassKg } from "../core/resources.js";
import { closestMission } from "../sim/closestMission.js";
import { val } from "../core/units.js";

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c],
  );

const STYLE = `
.mm-card{padding:.25rem 0}
.mm-card h3{margin:.1rem 0 .5rem}
.mm-ratios{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.5rem 1rem;margin:.75rem 0 0}
.mm-ratios dt{color:var(--muted);font-size:.85rem}
.mm-ratios dd{margin:0 0 .25rem;font-weight:600}
.mm-note{color:var(--muted);font-size:.85rem;margin:.75rem 0 0}
`;

// Mean altitude of the chosen orbit (a 30 x 216 km orbit counts as 123 km).
const altKm = (orbit) =>
  (val(orbit.perilune_alt_km) + val(orbit.apolune_alt_km)) / 2;

export function designSummary(state) {
  const r = resolveSpacecraft(state.spacecraft, state.data);
  if (!r.orbit) return null;
  return {
    dryMassKg: dryMassKg(r),
    altKm: altKm(r.orbit),
    lifetimeMonths: state.mission?.requirements?.lifetime_months,
    instrumentCount: r.instruments.length,
  };
}

export function renderMissionMatch(container, state) {
  if (!document.getElementById("mm-style")) {
    const st = document.createElement("style");
    st.id = "mm-style";
    st.textContent = STYLE;
    document.head.appendChild(st);
  }
  const design = state.data?.missions ? designSummary(state) : null;
  if (!design) {
    container.innerHTML = `<div class="mm-card"><h3>Closest real mission</h3><p>Choose an orbit and parts in the designer to compare your design with real lunar orbiters.</p></div>`;
    return;
  }
  const m = closestMission(design, state.data.missions);
  const x = (r) => (r === null ? "n/a" : `${r.toFixed(2)}x`);
  const rt = m.best ? m.best.ratios : null;
  container.innerHTML = `<div class="mm-card">
    <h3>Closest real mission</h3>
    <p>${esc(m.text)}</p>
    ${
      m.close && rt
        ? `<dl class="mm-ratios">
      <div><dt>Dry mass vs ${esc(m.best.name)}</dt><dd>${x(rt.mass)}</dd></div>
      <div><dt>Orbit altitude</dt><dd>${x(rt.alt)}</dd></div>
      <div><dt>Lifetime</dt><dd>${x(rt.life)}</dd></div>
      <div><dt>Instruments</dt><dd>${x(rt.inst)}</dd></div></dl>`
        : ""
    }
    <p class="mm-note">Compared on mass, orbit altitude, lifetime and instrument count only, against ${state.data.missions.real_missions.length} real orbiters from NASA sources. A resemblance, not a validation.</p>
  </div>`;
}
