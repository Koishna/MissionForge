import {
  massMarginFrac,
  powerMarginFrac,
  batteryMarginFrac,
  scienceFrac,
  thermalMarginFrac,
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

function thermalHealth(r, simulation = null) {
  const margin =
    simulation && Number.isFinite(simulation.thermalMarginFrac)
      ? simulation.thermalMarginFrac
      : thermalMarginFrac(r);
  return {
    score: marginHealth(margin),
    status: margin < 0 ? "critical" : margin < 0.15 ? "warning" : "nominal",
    marginFrac: margin,
  };
}

function communicationsHealth(r) {
  const margin = linkMarginDb(r);
  return margin <= -99 || !Number.isFinite(margin)
    ? 0
    : clamp(((margin + 10) / 50) * 100);
}

// HUD scores: power is lowest battery fraction, fuel is delta-v reserve, comms is link margin,
// thermal is bus heat-rejection margin, and science is instrument value adjusted by delivered data.
export function computeHealth(
  r,
  mission,
  simulation = null,
  validation = null,
) {
  const powerMargin = powerMarginFrac(r);

  let power =
    simulation && Number.isFinite(simulation.minBatteryFrac)
      ? clamp(simulation.minBatteryFrac * 100)
      : Number.isFinite(powerMargin)
        ? clamp((powerMargin + 1) * 50)
        : 0;

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
      fuel = clamp((availableDv / requiredDv) * 50);
    }
  }

  const comms = communicationsHealth(r);

  const thermalResult = thermalHealth(r, simulation);
  const thermal = thermalResult.score;

  const scienceValue = scienceFrac(r);
  const requiredData = Number(mission?.requirements?.min_data_gb) || 0;
  const dataFraction =
    simulation && requiredData > 0 && Number.isFinite(simulation.dataDownlinkedGb)
      ? Math.max(0, Math.min(1, simulation.dataDownlinkedGb / requiredData))
      : 1;
  const science = Number.isFinite(scienceValue)
    ? clamp(scienceValue * dataFraction * 100)
    : 0;

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
      thermalMarginFrac: thermalResult.marginFrac,
      linkMarginDb: linkMarginDb(r),
      deltaVms: deltaVms(r),
    },
  };
}

// Shared risk bands for the Designer's Monte Carlo estimate.
export function riskLevelFor(successRate) {
  const rate = Number(successRate);
  if (!Number.isFinite(rate)) return "UNKNOWN";
  return rate >= 0.8 ? "LOW" : rate >= 0.55 ? "MODERATE" : "HIGH";
}
