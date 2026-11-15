import {
  massMarginFrac,
  powerMarginFrac,
  batteryMarginFrac,
  scienceFrac,
  powerConsumedW,
} from "../core/resources.js";
import { linkMarginDb } from "../core/comms.js";
import { deltaVms } from "../core/propulsion.js";

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function marginHealth(margin, target = 1) {
  if (!Number.isFinite(margin)) {
    return 0;
  }

  return clamp(((margin + target) / (2 * target)) * 100);
}

function thermalHealth(r) {
  const totalPower = powerConsumedW(r);

  const warningLimit = 200;
  const criticalLimit = 300;

  if (totalPower >= criticalLimit) {
    return {
      score: 0,
      status: "critical",
      powerW: totalPower,
    };
  }

  if (totalPower <= warningLimit) {
    return {
      score: 100,
      status: "nominal",
      powerW: totalPower,
    };
  }

  const score =
    ((criticalLimit - totalPower) / (criticalLimit - warningLimit)) * 100;

  return {
    score: clamp(score),
    status: "warning",
    powerW: totalPower,
  };
}

function communicationsHealth(r) {
  const margin = linkMarginDb(r);

  if (margin <= -99 || !Number.isFinite(margin)) {
    return 0;
  }

  const radio = r.parts.find(
    (p) => p.rf_power_w && p.antenna_gain_dbi && p.frequency_mhz,
  );

  if (!radio) {
    return 0;
  }

  const rfPower =
    Number(radio.rf_power_w?.value) || Number(radio.rf_power_w) || 0;

  const antennaGain =
    Number(radio.antenna_gain_dbi?.value) ||
    Number(radio.antenna_gain_dbi) ||
    0;

  const downlink = r.parts.reduce(
    (sum, p) =>
      sum + (Number(p.downlink_kbps?.value) || Number(p.downlink_kbps) || 0),
    0,
  );

  const marginScore = clamp(((margin + 10) / 20) * 100);

  const capabilityScore = clamp(
    (rfPower / 10) * 30 + (antennaGain / 25) * 30 + (downlink / 2000) * 40,
  );

  return clamp(marginScore * 0.5 + capabilityScore * 0.5);
}

export function computeHealth(
  r,
  mission,
  simulation = null,
  validation = null,
) {
  const powerMargin = powerMarginFrac(r);

  let power = Number.isFinite(powerMargin) ? clamp((powerMargin + 1) * 50) : 0;

  const hasBattery = r.parts.some(
    (part) =>
      (Number(part.capacity_wh?.value) || Number(part.capacity_wh) || 0) > 0,
  );

  if (!hasBattery) {
    power = 0;
  }

  let fuel;

  if (simulation && Number.isFinite(simulation.dvMarginFrac)) {
    fuel = clamp((simulation.dvMarginFrac + 1) * 50);
  } else {
    const availableDv = deltaVms(r);

    const requiredDv =
      Number(mission?.requirements?.insertion_dv_ms) ||
      Number(mission?.requirements?.delta_v_ms) ||
      0;

    if (requiredDv <= 0) {
      fuel = availableDv > 0 ? 100 : 0;
    } else {
      fuel = clamp((availableDv / requiredDv) * 100);
    }
  }

  const comms = communicationsHealth(r);

  const thermalResult = thermalHealth(r);
  const thermal = thermalResult.score;

  const scienceValue = scienceFrac(r);

  const science = Number.isFinite(scienceValue) ? clamp(scienceValue * 100) : 0;

  const massMargin = massMarginFrac(r);

  const mass = Number.isFinite(massMargin) ? clamp((massMargin + 1) * 50) : 0;

  const batteryMargin = batteryMarginFrac(r);

  const battery = hasBattery
    ? Number.isFinite(batteryMargin)
      ? clamp((batteryMargin + 1) * 50)
      : 0
    : 0;

  let overall = (power + fuel + comms + thermal + science) / 5;

  if (validation && validation.ok === false) {
    overall = Math.min(overall, 49);
  }

  const status = {
    power: power <= 20 ? "critical" : power < 50 ? "warning" : "nominal",

    fuel: fuel <= 20 ? "critical" : fuel < 50 ? "warning" : "nominal",

    comms: comms <= 20 ? "critical" : comms < 50 ? "warning" : "nominal",

    thermal: thermalResult.status,

    science: science <= 20 ? "critical" : science < 50 ? "warning" : "nominal",

    mass: mass <= 20 ? "critical" : mass < 50 ? "warning" : "nominal",

    battery: battery <= 20 ? "critical" : battery < 50 ? "warning" : "nominal",
  };

  return {
    overall: clamp(overall),
    power: clamp(power),
    fuel: clamp(fuel),
    comms: clamp(comms),
    thermal: clamp(thermal),
    science: clamp(science),

    status,

    details: {
      mass,
      battery,
      thermalPowerW: thermalResult.powerW,
      linkMarginDb: linkMarginDb(r),
      deltaVms: deltaVms(r),
    },
  };
}
