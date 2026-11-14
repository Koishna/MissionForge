import { val } from '../core/units.js';

export const DEFAULT_BODY = { mu: 4.90e12, r: 1.7374e6 };   
export const MU_MOON = DEFAULT_BODY.mu;                      
export const R_MOON = DEFAULT_BODY.r;

export const bodyFrom = (constants) => ({ mu: val(constants.mu_moon), r: val(constants.r_moon) });


export const visViva = (mu, r, a) => Math.sqrt(mu * (2 / r - 1 / a));

export const periodS = (mu, a) => 2 * Math.PI * Math.sqrt((a ** 3) / mu);


export function orbitFromAltitudes(periKm, apoKm, body = DEFAULT_BODY) {
  if (!(periKm > 0) || !(apoKm >= periKm)) throw new Error('Need 0 < perilune altitude <= apolune altitude.');
  const rp = body.r + periKm * 1000, ra = body.r + apoKm * 1000;
  const a = (rp + ra) / 2, e = (ra - rp) / (ra + rp);
  return { a, e, rp, ra, periodS: periodS(body.mu, a), vPeriMs: visViva(body.mu, rp, a), vApoMs: visViva(body.mu, ra, a) };
}

export function circularOrbit(altitudeKm, body = DEFAULT_BODY) {
  const o = orbitFromAltitudes(altitudeKm, altitudeKm, body);
  return { a: o.a, speedMs: o.vPeriMs, periodS: o.periodS };
}


export function eclipseFraction(a, e, betaRad = 0, psiRad = 0, body = DEFAULT_BODY, steps = 3600) {
  const cb = Math.cos(betaRad), p = a * (1 - e * e), dth = (2 * Math.PI) / steps;
  let shadow = 0;
  for (let i = 0; i < steps; i++) {
    const th = (i + 0.5) * dth, r = p / (1 + e * Math.cos(th)), c = Math.cos(th - psiRad);
    if (c < 0 && r * r * (1 - cb * cb * c * c) < body.r * body.r) shadow += r * r * dth;
  }
  return shadow / (2 * Math.PI * a * a * Math.sqrt(1 - e * e));
}

export function worstCaseEclipseFraction(a, e, body = DEFAULT_BODY) {
  if (e < 1e-9) return eclipseFraction(a, e, 0, 0, body);
  let best = 0;
  for (let k = 0; k < 72; k++) best = Math.max(best, eclipseFraction(a, e, 0, (k * Math.PI) / 36, body, 1440));
  return best;
}


export function describeOrbit(periKm, apoKm, body = DEFAULT_BODY) {
  const o = orbitFromAltitudes(periKm, apoKm, body);
  const eclipse = worstCaseEclipseFraction(o.a, o.e, body);
  return { ...o, eclipseFraction: eclipse, eclipseS: eclipse * o.periodS, eclipseByBeta: eclipseTable(o.a, o.e, body) };
}

export const YEAR_S = 365.25 * 86400;
export const BETA_STEP_DEG = 5;
export const betaAt = (tS, phaseDeg = 0) => Math.asin(Math.abs(Math.sin((phaseDeg * Math.PI) / 180 + (2 * Math.PI * tS) / YEAR_S)));


export function eclipseTable(a, e, body = DEFAULT_BODY, stepDeg = BETA_STEP_DEG) {
  const out = [];
  for (let d = 0; d <= 90; d += stepDeg) out.push(Number(eclipseFraction(a, e, (d * Math.PI) / 180, Math.PI / 2, body, 7200).toFixed(4)));
  return out;
}


export function eclipseAtBeta(table, betaRad, stepDeg = BETA_STEP_DEG) {
  const x = Math.min(90, Math.max(0, (betaRad * 180) / Math.PI)) / stepDeg;
  const i = Math.min(table.length - 2, Math.floor(x));
  return table[i] + (table[i + 1] - table[i]) * (x - i);
}
