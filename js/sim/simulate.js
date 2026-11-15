import { val, SECONDS_PER_MONTH } from "../core/units.js";
import {
  powerGeneratedW,
  powerConsumedW,
  batteryCapacityWh,
  dataRateKbps,
  downlinkRateKbps,
} from "../core/resources.js";
import { deltaVms } from "../core/propulsion.js";
import { betaAt, eclipseAtBeta } from "./orbital.js";

export const DEFAULT_ASSUMPTIONS = {
  batteryFadePerMonth: 0.01,
  solarScale: 1,
  downlinkScale: 1,
  loadScale: 1,
  contactScale: 1,
  deltaVScale: 1,
  scienceScale: 1,
  thermalScale: 1,
  sunPhaseDeg: 0,
};

export const FAILURE_LABELS = {
  NO_ORBIT: "No orbit chosen",
  DELTAV_SHORT: "Not enough delta-v to reach the orbit",
  BATTERY_DEPLETED: "Battery ran out",
  DATA_SHORTFALL: "Too little data reached the ground",
  THERMAL_OVERLOAD: "Thermal load exceeded the safe limit",
};

export function simulateNominal(r, mission, assumptions = {}) {
  const a = {
    ...DEFAULT_ASSUMPTIONS,
    ...assumptions,
  };

  const reasons = [];
  const codes = [];

  const fail = (code, text) => {
    codes.push(code);
    reasons.push(text);
  };

  if (!r.orbit) {
    fail("NO_ORBIT", "No orbit chosen.");

    return {
      success: false,
      reasons,
      codes,
      timeline: [],
    };
  }

  const lifetimeS = mission.requirements.lifetime_months * SECONDS_PER_MONTH;

  const period = val(r.orbit.period_s);
  const eclipseFrac = val(r.orbit.eclipse_fraction);

  const gen = powerGeneratedW(r) * a.solarScale;

  const load = powerConsumedW(r) * a.loadScale;

  const thermalLoad = load * a.thermalScale;

  const cap0 = batteryCapacityWh(r);

  const dvAvail = deltaVms(r);

  const dvNeed = val(r.orbit.insertion_dv_ms) * a.deltaVScale;

  const dvMarginFrac = dvNeed > 0 ? (dvAvail - dvNeed) / dvNeed : Infinity;

  if (dvAvail < dvNeed) {
    fail(
      "DELTAV_SHORT",
      `Delta-v ${dvAvail.toFixed(0)} m/s is short of the ${dvNeed.toFixed(
        0,
      )} m/s this orbit needs.`,
    );
  }

  const thermalLimit = load * 1.5;

  if (thermalLoad > thermalLimit) {
    fail(
      "THERMAL_OVERLOAD",
      `Thermal load ${thermalLoad.toFixed(
        0,
      )} W exceeds the illustrative safe limit of ${thermalLimit.toFixed(
        0,
      )} W.`,
    );
  }

  const tbl = r.orbit.eclipse_by_beta;

  const table = tbl ? val(tbl) : null;

  const stepDeg = tbl && tbl.step_deg ? tbl.step_deg : 5;

  let battery = cap0;
  let minBattery = cap0;

  let depletedAtS = null;
  let capAtDepletion = null;
  let demandAtDepletion = 0;
  let eclAtDepletionS = 0;

  let peakDemandWh = 0;
  let minEclS = Infinity;
  let maxEclS = 0;

  let reserveAtEclipseEntry = cap0;

  const timeline = [];

  const orbits = Math.ceil(lifetimeS / period);

  const sampleEvery = Math.max(1, Math.floor(orbits / 200));

  for (let k = 0; k < orbits; k++) {
    const t = k * period;

    const frac = table
      ? eclipseAtBeta(table, betaAt(t, a.sunPhaseDeg), stepDeg)
      : eclipseFrac;

    const eclS = frac * period;

    const sunS = period - eclS;

    const demandWh = (thermalLoad * eclS) / 3600;

    if (demandWh > peakDemandWh) {
      peakDemandWh = demandWh;
    }

    minEclS = Math.min(minEclS, eclS);

    maxEclS = Math.max(maxEclS, eclS);

    reserveAtEclipseEntry = battery;

    const cap =
      cap0 * Math.max(0, 1 - a.batteryFadePerMonth * (t / SECONDS_PER_MONTH));

    battery = Math.min(battery, cap);

    battery -= demandWh;

    if (battery < minBattery) {
      minBattery = battery;
    }

    if (battery <= 0 && depletedAtS === null) {
      depletedAtS = t + eclS;

      capAtDepletion = cap;

      demandAtDepletion = demandWh;

      eclAtDepletionS = eclS;
    }

    const lowest = battery;

    battery = Math.min(cap, battery + ((gen - thermalLoad) * sunS) / 3600);

    if (k % sampleEvery === 0) {
      timeline.push({
        tS: t,
        batteryWh: Math.max(0, lowest),
        capWh: cap,
        eclipseMin: eclS / 60,
      });
    }
  }

  if (depletedAtS !== null) {
    const when = `${(depletedAtS / SECONDS_PER_MONTH).toFixed(1)} months`;

    if (gen <= thermalLoad) {
      fail(
        "BATTERY_DEPLETED",
        `Battery ran out after ${when}: the spacecraft uses ${thermalLoad.toFixed(
          0,
        )} W but the array makes only ${gen.toFixed(
          0,
        )} W, so it drains even in sunlight.`,
      );
    } else {
      fail(
        "BATTERY_DEPLETED",
        `Battery ran out after ${when}: that eclipse lasted ${(
          eclAtDepletionS / 60
        ).toFixed(0)} min at ${thermalLoad.toFixed(
          0,
        )} W, which needs ${demandAtDepletion.toFixed(
          0,
        )} Wh, more than the ${capAtDepletion.toFixed(
          0,
        )} Wh the battery can hold by then.`,
      );
    }
  }

  const generatedGb =
    (dataRateKbps(r) * a.scienceScale * 1000 * lifetimeS) / (8 * 1e9);

  const contactSPerDay = val(r.orbit.contact_h_per_day) * 3600 * a.contactScale;

  const downlinkedMax =
    (downlinkRateKbps(r) *
      a.downlinkScale *
      1000 *
      contactSPerDay *
      (lifetimeS / 86400)) /
    (8 * 1e9);

  const dataDownlinkedGb = Math.min(generatedGb, downlinkedMax);

  if (dataDownlinkedGb < mission.requirements.min_data_gb) {
    fail(
      "DATA_SHORTFALL",
      `Only ${dataDownlinkedGb.toFixed(
        1,
      )} GB reached the ground; the requirement is ${mission.requirements.min_data_gb} GB.`,
    );
  }

  const minBatteryFrac = cap0 > 0 ? minBattery / cap0 : 0;

  return {
    success: reasons.length === 0,

    reasons,
    codes,

    minBatteryWh: minBattery,

    minBatteryFrac,

    reserveAtEclipseEntry,

    depletedAtS: depletedAtS,

    generatedGb,

    dataDownlinkedGb,

    eclipseDemandWh: peakDemandWh,

    eclipseMin: maxEclS / 60,

    eclipseMinShortest: minEclS / 60,

    periodS: period,

    dvAvailMs: dvAvail,

    dvNeedMs: dvNeed,

    dvMarginFrac,

    timeline,
  };
}
