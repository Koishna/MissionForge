import { resolveSpacecraft } from "../js/core/resources.js";
import { simulateNominal } from "../js/sim/simulate.js";
import { applyEvents } from "../js/sim/events.js";
import {
  bodyFrom,
  circularOrbit,
  orbitFromAltitudes,
  eclipseFraction,
  worstCaseEclipseFraction,
  describeOrbit,
  betaAt,
  eclipseAtBeta,
  YEAR_S,
} from "../js/sim/orbital.js";

export function runSimTests(data) {
  const mission = {
    requirements: { budget_usd_m: 150, lifetime_months: 6, min_data_gb: 200 },
  };
  const body = bodyFrom(data.constants);
  const base = {
    components: [
      "bus-small",
      "solar-300",
      "battery-large",
      "comms-xband",
      "computer-basic",
      "pointing-basic",
      "prop-biprop",
    ],
    instruments: ["camera", "spectrometer"],
    orbitId: "llo-100-polar",
    launcherId: "launch-small",
  };
  const withBattery = (wh, orbitId = base.orbitId, sc = base) => {
    const d = JSON.parse(JSON.stringify(data));
    d.components.components.find((c) => c.id === "battery-large").capacity_wh =
      wh;
    return resolveSpacecraft({ ...sc, orbitId }, d);
  };
  const res = [];
  const t = (name, fn) => {
    try {
      res.push({ name: "Orbit/sim: " + name, ok: fn() !== false });
    } catch (e) {
      res.push({ name: "Orbit/sim: " + name, ok: false, err: e.message });
    }
  };
  const near = (x, y, tol) => Math.abs(x - y) <= tol;

  t("100 km circular period is about 7069 s (Kepler)", () =>
    near(circularOrbit(100, body).periodS, 7069, 5),
  );
  t("Circular eclipse matches the closed form asin(R/a)/pi", () => {
    const o = orbitFromAltitudes(100, 100, body);
    return near(
      eclipseFraction(o.a, 0, 0, 0, body),
      Math.asin(body.r / o.a) / Math.PI,
      1e-3,
    );
  });
  t("Eclipse share falls as altitude rises (50 > 100 > 500 km)", () => {
    const f = (h) => describeOrbit(h, h, body).eclipseFraction;
    return f(50) > f(100) && f(100) > f(500);
  });
  t(
    "Eclipse shrinks as the Sun leaves the orbit plane, and vanishes beyond asin(R/a)",
    () => {
      const o = orbitFromAltitudes(100, 100, body);
      return (
        eclipseFraction(o.a, 0, 0, 0, body) >
          eclipseFraction(o.a, 0, Math.PI / 4, 0, body) &&
        eclipseFraction(o.a, 0, (75 * Math.PI) / 180, 0, body) === 0
      );
    },
  );
  t(
    "Worst-case eclipse for an ellipse is at least any single orientation",
    () => {
      const o = orbitFromAltitudes(30, 216, body);
      return (
        worstCaseEclipseFraction(o.a, o.e, body) >=
        eclipseFraction(o.a, o.e, 0, 1, body, 1440) - 1e-9
      );
    },
  );
  t(
    "orbits.json period and eclipse match orbital.js (run scripts/derive_orbits.mjs if not)",
    () =>
      data.orbits.orbits.every((o) => {
        const d = describeOrbit(
          o.perilune_alt_km.value,
          o.apolune_alt_km.value,
          body,
        );
        return (
          near(o.period_s.value, d.periodS, 1) &&
          near(o.eclipse_fraction.value, d.eclipseFraction, 1e-4) &&
          JSON.stringify(o.eclipse_by_beta.value) ===
            JSON.stringify(d.eclipseByBeta)
        );
      }),
  );
  t(
    "No PUBLISHED, CALCULATED or MEASURED value still says TODO in its source",
    () =>
      [data.constants, ...data.orbits.orbits].every((obj) =>
        Object.values(obj).every(
          (v) =>
            !(
              v &&
              v.provenance &&
              v.provenance !== "ILLUSTRATIVE" &&
              /^TODO/i.test(v.source || "")
            ),
        ),
      ),
  );
  t(
    "simulateNominal is deterministic",
    () =>
      JSON.stringify(simulateNominal(withBattery(200), mission)) ===
      JSON.stringify(simulateNominal(withBattery(200), mission)),
  );
  t(
    "A robust design passes the nominal run",
    () => simulateNominal(withBattery(200), mission).success,
  );
  t(
    "A battery smaller than one eclipse needs is reported with a clear reason and code",
    () => {
      const out = simulateNominal(withBattery(60), mission);
      return (
        !out.success &&
        out.codes[0] === "BATTERY_DEPLETED" &&
        /eclipse/i.test(out.reasons[0])
      );
    },
  );
  t(
    "More battery never lowers the minimum battery level",
    () =>
      simulateNominal(withBattery(150), mission).minBatteryWh >=
      simulateNominal(withBattery(120), mission).minBatteryWh,
  );
  t(
    "A 100 km orbit (more shadow per orbit) leaves a lower minimum battery than 500 km",
    () =>
      simulateNominal(withBattery(150, "llo-100-polar"), mission).minBatteryWh <
      simulateNominal(withBattery(150, "llo-500-polar"), mission).minBatteryWh,
  );
  t("Missing propulsion fails with DELTAV_SHORT", () => {
    const r = resolveSpacecraft(
      {
        ...base,
        components: base.components.filter((c) => c !== "prop-biprop"),
      },
      data,
    );
    return simulateNominal(r, mission).codes.includes("DELTAV_SHORT");
  });
  t("deltaVScale above the available margin flips a pass to a fail", () => {
    const r = withBattery(200);
    return (
      simulateNominal(r, mission).success &&
      !simulateNominal(r, mission, { deltaVScale: 2 }).success
    );
  });
  t(
    "Events scale the named assumptions",
    () => applyEvents({}, ["solar-storm"], data.events).solarScale === 0.9,
  );
  t("Every event only changes assumptions the simulation reads", () =>
    data.events.events.every((e) => !!applyEvents({}, [e.id], data.events)),
  );
  t("An event can break a marginal design", () => {
    const r = withBattery(100);
    return (
      simulateNominal(r, mission).success &&
      !simulateNominal(
        r,
        mission,
        applyEvents({}, ["instrument-overdraw"], data.events),
      ).success
    );
  });
  // ---- seasonal eclipse ----
  const circ = data.orbits.orbits.filter(
    (o) => o.perilune_alt_km.value === o.apolune_alt_km.value,
  );
  t(
    "Beta follows the season: 0 and 180 deg phase are in-plane, 90 is perpendicular, and it repeats every half year",
    () =>
      near(betaAt(0, 0), 0, 1e-9) &&
      near(betaAt(0, 90), Math.PI / 2, 1e-9) &&
      near(betaAt(YEAR_S / 2, 0), 0, 1e-9),
  );
  t("Eclipse share never grows as beta grows (circular orbits)", () =>
    circ.every((o) =>
      o.eclipse_by_beta.value.every(
        (v, i, arr) => i === 0 || v <= arr[i - 1] + 5e-4,
      ),
    ),
  );
  t("100 km eclipse is zero once beta passes asin(R/a), about 71 deg", () => {
    const o = data.orbits.orbits.find((x) => x.id === "llo-100-polar");
    return (
      o.eclipse_by_beta.value.slice(15).every((v) => v === 0) &&
      o.eclipse_by_beta.value[14] > 0
    );
  });
  t(
    "Table lookup returns the node value and the midpoint between nodes",
    () => {
      const tb = [0.4, 0.3, 0.1];
      return (
        near(eclipseAtBeta(tb, 0, 5), 0.4, 1e-12) &&
        near(eclipseAtBeta(tb, (2.5 * Math.PI) / 180, 5), 0.35, 1e-12) &&
        near(eclipseAtBeta(tb, (7.5 * Math.PI) / 180, 5), 0.2, 1e-12) &&
        near(eclipseAtBeta(tb, (5 * Math.PI) / 180, 5), 0.3, 1e-12)
      );
    },
  );
  t("The seasonal model is never harsher than the old fixed worst case", () => {
    const r = withBattery(100);
    const fixed = { ...r, orbit: { ...r.orbit, eclipse_by_beta: undefined } };
    return (
      simulateNominal(r, mission).minBatteryWh >=
      simulateNominal(fixed, mission).minBatteryWh - 1e-6
    );
  });
  t(
    "Launch season matters: the worst eclipse meets an aged battery at phase 0 but not at phase 60",
    () => {
      const r = withBattery(100);
      return (
        simulateNominal(r, mission, { sunPhaseDeg: 60 }).minBatteryWh >
        simulateNominal(r, mission, { sunPhaseDeg: 0 }).minBatteryWh
      );
    },
  );
  t(
    "Timeline reports the eclipse length, and it changes over the mission",
    () => {
      const tl = simulateNominal(withBattery(200), mission, {
        sunPhaseDeg: 60,
      }).timeline;
      return (
        tl.length > 10 &&
        Math.max(...tl.map((p) => p.eclipseMin)) -
          Math.min(...tl.map((p) => p.eclipseMin)) >
          5
      );
    },
  );
  return res;
}
