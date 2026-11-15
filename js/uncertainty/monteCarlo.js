import { mulberry32, normal, triangular } from "./rng.js";
import * as sim from "../sim/simulate.js";
import { batteryCapacityWh } from "../core/resources.js";
import { riskLevelFor } from "../game/health.js";

const { simulateNominal } = sim;
const LABELS = sim.FAILURE_LABELS || {};

function validateConfig(cfg) {
  if (!cfg) {
    throw new Error("Monte Carlo configuration is missing.");
  }

  const validateNormal = (name, item) => {
    if (
      !item ||
      !Number.isFinite(item.mean) ||
      !Number.isFinite(item.sd) ||
      item.sd < 0
    ) {
      throw new Error(`Invalid normal distribution: ${name}`);
    }
  };

  const validateTriangular = (name, item) => {
    if (
      !item ||
      !Number.isFinite(item.min) ||
      !Number.isFinite(item.mode) ||
      !Number.isFinite(item.max) ||
      item.min > item.mode ||
      item.mode > item.max ||
      item.min === item.max
    ) {
      throw new Error(`Invalid triangular distribution: ${name}`);
    }
  };

  validateNormal("battery_fade_per_month", cfg.battery_fade_per_month);
  validateTriangular("solar_scale", cfg.solar_scale);
  validateTriangular("downlink_scale", cfg.downlink_scale);

  if (cfg.load_scale) {
    validateTriangular("load_scale", cfg.load_scale);
  }

  if (cfg.contact_scale) {
    validateTriangular("contact_scale", cfg.contact_scale);
  }
}

export function runMonteCarlo(r, mission, cfg, runs = 1000, seed = 42) {
  if (!Number.isInteger(runs) || runs <= 0) {
    throw new Error("Number of simulations must be a positive integer.");
  }

  validateConfig(cfg);

  if (typeof simulateNominal !== "function") {
    throw new Error("simulateNominal function is unavailable.");
  }

  const rng = mulberry32(seed);
  let ok = 0;

  const failures = {};
  const mins = [];
  const minimumBatteryFractions = [];
  const capacityWh = batteryCapacityWh(r);

  for (let i = 0; i < runs; i++) {
    const assumptions = {
      batteryFadePerMonth: Math.max(
        0,
        normal(
          rng,
          cfg.battery_fade_per_month.mean,
          cfg.battery_fade_per_month.sd,
        ),
      ),

      solarScale: triangular(
        rng,
        cfg.solar_scale.min,
        cfg.solar_scale.mode,
        cfg.solar_scale.max,
      ),

      downlinkScale: triangular(
        rng,
        cfg.downlink_scale.min,
        cfg.downlink_scale.mode,
        cfg.downlink_scale.max,
      ),
    };

    if (cfg.load_scale) {
      assumptions.loadScale = triangular(
        rng,
        cfg.load_scale.min,
        cfg.load_scale.mode,
        cfg.load_scale.max,
      );
    }

    if (cfg.contact_scale) {
      assumptions.contactScale = triangular(
        rng,
        cfg.contact_scale.min,
        cfg.contact_scale.mode,
        cfg.contact_scale.max,
      );
    }

    const res = simulateNominal(r, mission, assumptions);

    const minimumWh = Math.max(0, res.minBatteryWh ?? 0);
    mins.push(minimumWh);
    minimumBatteryFractions.push(
      capacityWh > 0 ? Math.min(1, minimumWh / capacityWh) : 0,
    );

    if (res.success) {
      ok++;
    } else {
      const code = res.codes?.[0];

      const key = code
        ? LABELS[code] || code
        : String(res.reasons?.[0] || "unknown")
            .split(":")[0]
            .replace(/\d+(\.\d+)?/g, "#");

      failures[key] = (failures[key] || 0) + 1;
    }
  }

  const p = ok / runs;
  const z = 1.96;
  const n = runs;

  const centre = (p + (z * z) / (2 * n)) / (1 + (z * z) / n);

  const half =
    (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) /
    (1 + (z * z) / n);

  const sorted = [...mins].sort((a, b) => a - b);
  const sortedFractions = [...minimumBatteryFractions].sort((a, b) => a - b);

  const percentile = (values, q) =>
    values[Math.min(n - 1, Math.floor(q * n))];
  const pct = (q) => percentile(sorted, q);

  const topFailure =
    Object.entries(failures).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return {
    runs,
    seed,
    successRate: p,
    riskLevel: riskLevelFor(p),

    ci95: [Math.max(0, centre - half), Math.min(1, centre + half)],

    failures,
    topFailure,

    minBatteryPercentiles: {
      p5: percentile(sortedFractions, 0.05),
      p50: percentile(sortedFractions, 0.5),
      p95: percentile(sortedFractions, 0.95),
    },

    minBatteryWhPercentiles: { p5: pct(0.05), p50: pct(0.5), p95: pct(0.95) },

    minBatteryWh: mins,
  };
}
