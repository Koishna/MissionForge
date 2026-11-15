import { resolveSpacecraft, massMarginFrac } from '../js/core/resources.js';
import { validateSpacecraft } from '../js/core/validate.js';
import { computeHealth } from '../js/game/health.js';
import { netEffect } from '../js/game/tradeoffs.js';

export function runHealthTests(data) {
  const mission = { requirements: { budget_usd_m: 150, lifetime_months: 6, min_data_gb: 200 } };
  const base = { components: ['bus-small','solar-300','battery-small','comms-xband','computer-basic','pointing-basic','prop-biprop'],
                 instruments: ['camera','spectrometer'], orbitId: 'llo-100-polar', launcherId: 'launch-small' };
  const R = (sc) => resolveSpacecraft(sc, data);
  const H = (sc) => computeHealth(R(sc), mission, null, validateSpacecraft(R(sc), mission));
  const swap = (from, to) => ({ ...base, components: base.components.map((c) => (c === from ? to : c)) });
  const res = []; const t = (name, fn) => { try { res.push({ name, ok: fn() !== false }); } catch (e) { res.push({ name, ok: false, err: e.message }); } };

  t('health: base design gives every meter in 0..100', () => {
    const h = H(base); return ['overall','power','fuel','comms','thermal','science'].every((k) => h[k] >= 0 && h[k] <= 100);
  });
  t('health: removing the battery drops power to 0', () => H({ ...base, components: base.components.filter((c) => c !== 'battery-small') }).power === 0);
  t('health: a heavier radio lowers mass margin but raises comms', () => {
    const light = swap('comms-xband', 'comms-sband'), heavy = base;
    return massMarginFrac(R(heavy)) < massMarginFrac(R(light)) && H(heavy).comms > H(light).comms;
  });
  t('health: radar overloads the thermal budget', () => H({ ...base, instruments: ['camera','spectrometer','radar'] }).status.thermal === 'critical');
  t('health: a design that fails validation cannot look healthy', () => H({ ...base, launcherId: null }).overall <= 49);
  t('tradeoffs: the high-gain dish costs about 45 kg and 8 M USD more', () => {
    const e = netEffect(R(base), R(swap('comms-xband', 'comms-highgain')));
    return Math.abs(e.massKg - 45) < 0.5 && Math.abs(e.costUsdM - 8) < 0.5;
  });
  t('catalogue: every selectable part has at least one pro and one con', () => {
    const all = [...data.components.components, ...data.components.instruments, ...data.components.launchers];
    return all.every((x) => x.pros && x.pros.length && x.cons && x.cons.length);
  });
  return { results: res };
}