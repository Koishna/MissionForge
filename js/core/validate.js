import { val } from './units.js';
import { wetMassKg, powerGeneratedW, powerConsumedW, costUsdM, batteryCapacityWh, eclipseEnergyWh,
         massMarginFrac, powerMarginFrac, batteryMarginFrac, scienceFrac, thermalMarginFrac } from './resources.js';
import { deltaVms, propellantNeededKg } from './propulsion.js';
import { linkMarginDb } from './comms.js';

export function validateSpacecraft(r, mission) {
  const warnings = [];   
  const cautions = [];
  const locked = {};     

  if (!r.launcher) warnings.push('Choose a launch vehicle: without one, mass cannot be checked.');
  if (!r.orbit) warnings.push('Choose an orbit: without one, delta-v and eclipse time are unknown.');

  if (r.launcher) {
    const cap = val(r.launcher.capacity_kg);
    if (wetMassKg(r) > cap) warnings.push(`Mass ${wetMassKg(r).toFixed(0)} kg exceeds the launcher capacity of ${cap} kg.`);
    else if (massMarginFrac(r) < 0.05) cautions.push(`Mass margin is only ${(massMarginFrac(r) * 100).toFixed(1)}%: any growth will not fit.`);
  }

  if (powerConsumedW(r) > powerGeneratedW(r)) {
    warnings.push(`Power use ${powerConsumedW(r).toFixed(0)} W is above generation ${powerGeneratedW(r).toFixed(0)} W: the battery drains.`);
  }

  if (r.orbit) {
    const need = val(r.orbit.insertion_dv_ms), have = deltaVms(r);
    if (have < need) {
      const extra = propellantNeededKg(r, need);
      warnings.push(`Delta-v ${have.toFixed(0)} m/s is below the ${need} m/s needed to enter this orbit` +
        (isFinite(extra) ? ` (about ${extra.toFixed(0)} kg of propellant would be needed).` : ' (no thruster selected).'));
    } else if (have < need * 1.1) {
      cautions.push('Delta-v margin is under 10%: small insertion errors could use all the fuel.');
    }
    const eclipseWh = eclipseEnergyWh(r), cap = batteryCapacityWh(r);
    if (cap < eclipseWh) {
      warnings.push(`Battery ${cap.toFixed(0)} Wh cannot carry the ${eclipseWh.toFixed(0)} Wh needed through one eclipse.`);
    }
  }

  if (costUsdM(r) > mission.requirements.budget_usd_m) warnings.push(`Cost exceeds the budget cap of ${mission.requirements.budget_usd_m} M USD.`);

  const thermal = thermalMarginFrac(r);
  if (thermal < 0.15) {
    cautions.push(`THERMAL MARGIN LOW (${(thermal * 100).toFixed(0)}%): the bus may overheat. Reduce power use or choose a bus that rejects more heat.`);
  }

  const link = linkMarginDb(r);
  if (link < 0) warnings.push(`Link margin is ${link.toFixed(1)} dB: data cannot be sent reliably.`);
  else if (link < 3) cautions.push(`Link margin is ${link.toFixed(1)} dB; aim for at least 3 dB.`);

  const headroom = powerGeneratedW(r) - powerConsumedW(r);
  const massRoom = r.launcher ? val(r.launcher.capacity_kg) - wetMassKg(r) : Infinity;
  for (const inst of r.allInstruments || []) {
    if (r.instruments.includes(inst)) continue;
    if (val(inst.power_w) > headroom) {
      locked[inst.id] = `Needs ${val(inst.power_w)} W but only ${Math.max(0, headroom).toFixed(0)} W of headroom is left.`;
    } else if (val(inst.mass_kg) > massRoom) {
      locked[inst.id] = `Weighs ${val(inst.mass_kg)} kg but only ${Math.max(0, massRoom).toFixed(0)} kg of launch capacity is left.`;
    }
  }

  const metrics = {
    costUsdM: costUsdM(r),
    massMargin: massMarginFrac(r),
    powerMargin: powerMarginFrac(r),
    batteryMargin: batteryMarginFrac(r),
    scienceFrac: scienceFrac(r),
    linkMarginDb: link,
    thermalMargin: thermal,
  };
  return { ok: warnings.length === 0, warnings, cautions, locked, metrics };
}