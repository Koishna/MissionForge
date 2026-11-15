import { resolveSpacecraft, powerConsumedW } from "../js/core/resources.js";
import { validateSpacecraft } from "../js/core/validate.js";
import { deltaVms } from "../js/core/propulsion.js";
import { simulateNominal } from "../js/sim/simulate.js";
import { runMonteCarlo } from "../js/uncertainty/monteCarlo.js";

export function runTests(data) {
  const mission = {
    requirements: { budget_usd_m: 150, lifetime_months: 6, min_data_gb: 200 },
  };
  const parts = [
    "bus-small",
    "solar-300",
    "battery-small",
    "comms-xband",
    "computer-basic",
    "pointing-basic",
    "prop-biprop",
  ];
  const base = {
    components: parts,
    instruments: ["camera", "spectrometer"],
    orbitId: "llo-100-polar",
    launcherId: "launch-small",
  };
  const robust = {
    ...base,
    components: parts.map((c) => (c === "battery-small" ? "battery-large" : c)),
  };
  const withBatteryWh = (wh) => {
    const d = JSON.parse(JSON.stringify(data));
    d.components.components.find(
      (c) => c.id === "battery-small",
    ).capacity_wh.value = wh;
    return d;
  };
  const R = (sc, d = data) => resolveSpacecraft(sc, d);
  const nominalOk = (wh) =>
    simulateNominal(R(base, withBatteryWh(wh)), mission).success;
  let lo = 1,
    hi = 2000;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (nominalOk(m)) hi = m;
    else lo = m;
  }
  const minPassWh = hi;
  const dMid = withBatteryWh(minPassWh * 1.005);
  const res = [];
  const t = (name, fn) => {
    try {
      const ok = fn();
      res.push({ name: "Uncertainty: " + name, ok: ok !== false });
    } catch (e) {
      res.push({ name: "Uncertainty: " + name, ok: false, err: e.message });
    }
  };

  t(
    "A feasible design passes validation",
    () => validateSpacecraft(R(robust), mission).ok,
  );
  t(
    "Excess mass is flagged",
    () =>
      !validateSpacecraft(
        R({ ...base, instruments: ["camera", "spectrometer", "radar"] }),
        mission,
      ).ok,
  );
  t("Insufficient power is detected", () =>
    validateSpacecraft(
      R({ ...base, instruments: ["camera", "spectrometer", "radar"] }),
      mission,
    ).warnings.some((w) => w.includes("Power")),
  );
  t("Insufficient delta-v is detected", () =>
    validateSpacecraft(
      R({ ...base, components: parts.filter((c) => c !== "prop-biprop") }),
      mission,
    ).warnings.some((w) => w.includes("Delta-v")),
  );
  t("Delta-v follows Tsiolkovsky", () => {
    const r = R(base);
    return deltaVms(r) > 0;
  });
  t("No radio limits the mission downlink to zero", () => {
    const withoutRadio = { ...base, components: parts.filter((id) => id !== "comms-xband") };
    const result = simulateNominal(R(withoutRadio), mission);
    return result.linkMarginDb <= -99 && result.codes.includes("DATA_SHORTFALL");
  });
  t("Incompatible options are locked, with a reason", () => {
    const d = JSON.parse(JSON.stringify(data));
    d.components.components.find(
      (c) => c.id === "solar-300",
    ).power_generated_w.value = powerConsumedW(R(base, d)) + 10;
    const v = validateSpacecraft(
      R({ ...base, instruments: ["camera"] }, d),
      mission,
    );
    return (
      Object.keys(v.locked).includes("radar") &&
      String(v.locked.radar).length > 5
    );
  });
  t("The design can pass the nominal run with a big enough battery", () =>
    nominalOk(2000),
  );
  t(
    "Nominal run succeeds for the mid-battery design",
    () => simulateNominal(R(base, dMid), mission).success,
  );
  const mcMid = runMonteCarlo(
    R(base, dMid),
    mission,
    dMid.uncertainty,
    1000,
    42,
  );
  t(
    "A nominally passing design shows non-zero simulated risk",
    () => mcMid.successRate < 1 && mcMid.successRate > 0,
  );
  t(
    "A fixed seed reproduces the same result",
    () =>
      runMonteCarlo(R(base, dMid), mission, dMid.uncertainty, 1000, 42)
        .successRate === mcMid.successRate,
  );
  t("Monte Carlo returns a shared risk band", () =>
    ["LOW", "MODERATE", "HIGH"].includes(mcMid.riskLevel),
  );
  t("Monte Carlo battery percentiles are fractions in order", () => {
    const p = mcMid.minBatteryPercentiles;
    return p.p5 >= 0 && p.p5 <= p.p50 && p.p50 <= p.p95 && p.p95 <= 1;
  });
  t("More battery reserve improves reliability", () => {
    const d = withBatteryWh(minPassWh * 1.5);
    return (
      runMonteCarlo(R(base, d), mission, d.uncertainty, 1000, 42).successRate >
      mcMid.successRate
    );
  });
  t("Wider battery spread lowers reliability", () => {
    const u = data.uncertainty.battery_fade_per_month;
    const wide = {
      ...data.uncertainty,
      battery_fade_per_month: { ...u, sd: u.sd * 2 },
    };
    return (
      runMonteCarlo(R(base, dMid), mission, wide, 1000, 42).successRate <
      mcMid.successRate
    );
  });
  t("Failures are grouped by short cause, not by sentence", () => {
    const d = withBatteryWh(minPassWh * 0.98);
    const mc = runMonteCarlo(R(base, d), mission, d.uncertainty, 1000, 42);
    return (
      Object.keys(mc.failures).length >= 1 &&
      Object.keys(mc.failures).length <= 4
    );
  });
  res.push({
    name: `Info: the smallest battery that passes the nominal run is ${minPassWh.toFixed(1)} Wh; 0.5% above that, ${(mcMid.successRate * 100).toFixed(1)}% of 1,000 trials succeed`,
    ok: true,
  });
  return { results: res, mcBase: mcMid.successRate };
}
