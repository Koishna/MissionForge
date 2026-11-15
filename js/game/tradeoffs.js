import { wetMassKg, costUsdM, powerConsumedW, scienceFrac } from '../core/resources.js';
import { linkMarginDb } from '../core/comms.js';

export const prosCons = (part) => ({ pros: part.pros || [], cons: part.cons || [] });

// before and after are resolved spacecraft objects (resolveSpacecraft output).
export function netEffect(before, after) {
  const l0 = linkMarginDb(before), l1 = linkMarginDb(after);
  return {
    massKg: wetMassKg(after) - wetMassKg(before),
    costUsdM: costUsdM(after) - costUsdM(before),
    powerW: powerConsumedW(after) - powerConsumedW(before),
    linkDb: l0 > -99 && l1 > -99 ? l1 - l0 : null,
    science: scienceFrac(after) - scienceFrac(before),
  };
}

const sign = (n, d = 0) => `${n > 0 ? '+' : ''}${n.toFixed(d)}`;
export function describeChange(e) {
  const out = [];
  if (Math.abs(e.massKg) >= 0.5) out.push(`${sign(e.massKg)} kg`);
  if (Math.abs(e.costUsdM) >= 0.05) out.push(`${sign(e.costUsdM, 1)} M USD`);
  if (Math.abs(e.powerW) >= 0.5) out.push(`${sign(e.powerW)} W power use`);
  if (e.linkDb !== null && Math.abs(e.linkDb) >= 0.5) out.push(`${sign(e.linkDb, 1)} dB link`);
  if (Math.abs(e.science) >= 0.005) out.push(`${sign(e.science * 100)}% science`);
  return out.length ? out.join(', ') : 'no change';
}