import { resolveSpacecraft, eclipseEnergyWh } from '../js/core/resources.js';
import { validateSpacecraft } from '../js/core/validate.js';
import { evaluateMission } from '../js/core/evaluate.js';
import { linkMarginDb, fsplDb, linkBudget } from '../js/core/comms.js';
import { propellantNeededKg, deltaVms } from '../js/core/propulsion.js';
import { dB, fromDB, kmToM, val } from '../js/core/units.js';

export function runPart2Tests(data) {
  const mission = { requirements: { budget_usd_m: 150, lifetime_months: 6, min_data_gb: 200 } };
  const base = { components: ['bus-small','solar-300','battery-small','comms-xband','computer-basic','pointing-basic','prop-biprop'],
                 instruments: ['camera','spectrometer'], orbitId: 'llo-100-polar', launcherId: 'launch-small' };
  const R = (sc) => resolveSpacecraft(sc, data);
  const res = [];
  const t = (name, fn) => { try { res.push({ name, ok: fn() !== false }); } catch (e) { res.push({ name, ok: false, err: e.message }); } };

  t('units: kmToM and dB round-trip', () => kmToM(1) === 1000 && Math.abs(fromDB(dB(50)) - 50) < 1e-9);
  t('comms: free-space loss to the Moon at 2.25 GHz is about 211 dB', () => Math.abs(fsplDb(384400, 2250) - 211) < 1);
  t('comms: base design has a working link', () => linkMarginDb(R(base)) > 3);
  t('comms: a much weaker ground station lowers the margin', () => linkMarginDb(R(base), { gain_dbi: 40, noise_k: 100 }) < linkMarginDb(R(base)));
  t('comms: no radio gives a failing margin', () => linkMarginDb(R({ ...base, components: base.components.filter((c) => c !== 'comms-xband') })) < 0);
  t('propulsion: propellant needed inverts delta-v', () => {
    const r = R(base); const dv = deltaVms(r);
    return Math.abs(propellantNeededKg(r, dv) - 90) < 0.5;   // base design carries 90 kg
  });
  t('resources: eclipse energy matches load x eclipse time', () => {
    const r = R(base); const o = r.orbit;
    const load = [...r.parts, ...r.instruments].reduce((s, x) => s + (val(x.power_w) || 0), 0);
    return Math.abs(eclipseEnergyWh(r) - (load * val(o.eclipse_fraction) * val(o.period_s)) / 3600) < 1e-6;
  });
  t('validate: a battery too small for the eclipse is flagged', () => {
    const v = validateSpacecraft(R({ ...base, instruments: ['camera','spectrometer','radar'], components: base.components.concat([]) }), mission);
    return v.warnings.some((w) => w.startsWith('Battery') || w.startsWith('Power'));
  });
  t('validate: metrics are returned for scoring', () => 'costUsdM' in validateSpacecraft(R(base), mission).metrics);
  t('evaluate: every part is within 0..1', () => {
    const v = validateSpacecraft(R(base), mission);
    const e = evaluateMission(v, { success: true, dataDownlinkedGb: 250, reasons: [] }, { successRate: 0.8, runs: 1000 }, mission);
    return Object.values(e.parts).every((x) => x >= 0 && x <= 1) && e.score >= 0 && e.score <= 100;
  });
  t('evaluate: an invalid design scores lower than a valid one', () => {
    const nom = { success: true, dataDownlinkedGb: 250, reasons: [] }, mc = { successRate: 0.8, runs: 1000 };
    const good = evaluateMission(validateSpacecraft(R(base), mission), nom, mc, mission).score;
    const bad = evaluateMission(validateSpacecraft(R({ ...base, launcherId: null }), mission), nom, mc, mission).score;
    return bad < good;
  });
  return { results: res };
}