import { G0, val } from './units.js';
import { dryMassKg, wetMassKg } from './resources.js';

const thruster = (r) => r.parts.find((p) => p.isp_s);

export function deltaVms(r) {
  const prop = thruster(r);
  if (!prop) return 0;
  const m0 = wetMassKg(r), mf = dryMassKg(r);
  if (m0 <= mf) return 0;
  return val(prop.isp_s) * G0 * Math.log(m0 / mf);
}

export function propellantNeededKg(r, dvMs) {
  const prop = thruster(r);
  if (!prop) return Infinity;
  return dryMassKg(r) * (Math.exp(dvMs / (val(prop.isp_s) * G0)) - 1);
}

