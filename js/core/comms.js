
import { K_DB, EARTH_MOON_KM, val, dB } from './units.js';

export const GROUND_STATION = { name: '34 m dish, X-band', gain_dbi: 68, noise_k: 25 };
const REQUIRED_EBN0_DB = 4.5;   

export const fsplDb = (rangeKm, freqMHz) => 20 * Math.log10(rangeKm) + 20 * Math.log10(freqMHz) + 32.44;


export function linkBudget(r, ground = GROUND_STATION) {
  const radio = r.parts.find((p) => p.rf_power_w && p.antenna_gain_dbi && p.frequency_mhz);
  const rateKbps = r.parts.reduce((s, p) => s + (val(p.downlink_kbps) || 0), 0);
  if (!radio || rateKbps <= 0) return null;
  const loss = fsplDb(EARTH_MOON_KM, val(radio.frequency_mhz));
  const prDbw = dB(val(radio.rf_power_w)) + val(radio.antenna_gain_dbi) + ground.gain_dbi - loss - MISC_LOSS_DB;
  const ebn0 = prDbw - K_DB - dB(ground.noise_k) - dB(rateKbps * 1000);
  return { fsplDb: loss, receivedDbw: prDbw, ebn0Db: ebn0, requiredDb: REQUIRED_EBN0_DB, marginDb: ebn0 - REQUIRED_EBN0_DB };
}

export function linkMarginDb(r, ground = GROUND_STATION) {
  const b = linkBudget(r, ground);
  return b ? b.marginDb : -99;
}