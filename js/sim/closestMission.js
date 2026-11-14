// This compares the players design with real ones
import { val } from "../core/units.js";

const ratio = (a, b) => (a > 0 && b > 0 ? a / b : null);
const logGap = (r) => (r === null ? 1 : Math.abs(Math.log(r)));
export const CLOSE_FACTOR = 3; // within 3x on mass counts as a resemblance

export function closestMission(design, missionsFile) {
  const list = (missionsFile && missionsFile.real_missions) || [];
  const rows = list.map((m) => {
    const mass = ratio(design.dryMassKg, val(m.dry_mass_kg));
    const alt = ratio(design.altKm, val(m.mission_orbit_alt_km));
    const life = ratio(design.lifetimeMonths, val(m.primary_lifetime_months));
    const inst = ratio(design.instrumentCount, (m.instruments || []).length);
    const distance =
      (logGap(mass) + logGap(alt) + logGap(life) + logGap(inst)) / 4;
    return {
      id: m.id,
      name: m.name,
      distance,
      ratios: { mass, alt, life, inst },
    };
  });
  rows.sort((x, y) => x.distance - y.distance);
  const best = rows[0] || null;
  const close =
    best !== null &&
    best.ratios.mass !== null &&
    best.ratios.mass <= CLOSE_FACTOR &&
    best.ratios.mass >= 1 / CLOSE_FACTOR;
  const times = (r) => (r === null ? "n/a" : `${r.toFixed(2)}x`);
  const text = !best
    ? "No real missions to compare with."
    : close
      ? `Most like ${best.name}. Compared with it: mass ${times(best.ratios.mass)}, orbit altitude ${times(best.ratios.alt)}, lifetime ${times(best.ratios.life)}, instruments ${times(best.ratios.inst)}.`
      : `No close real mission. The nearest in our small table is ${best.name}, but your dry mass is ${times(best.ratios.mass)} of its mass.`;
  return { best, close, ranked: rows, text };
}
