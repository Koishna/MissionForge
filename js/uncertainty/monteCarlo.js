import { mulberry32, normal, triangular } from "./rng.js";
import * as sim from "../sim/simulate.js";
const { simulateNominal } = sim;
const LABELS = sim.FAILURE_LABELS || {};

export function runMonteCarlo(r, mission, cfg, runs = 1000, seed = 42) {
  const rng = mulberry32(seed);
  let ok = 0;
  const failures = {};
  const mins = [];
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
    if (cfg.load_scale)
      assumptions.loadScale = triangular(
        rng,
        cfg.load_scale.min,
        cfg.load_scale.mode,
        cfg.load_scale.max,
      );
    if (cfg.contact_scale)
      assumptions.contactScale = triangular(
        rng,
        cfg.contact_scale.min,
        cfg.contact_scale.mode,
        cfg.contact_scale.max,
      );
    const res = simulateNominal(r, mission, assumptions);
    mins.push(res.minBatteryWh ?? 0);
    if (res.success) ok++;
    else {
      const code = res.codes && res.codes[0];

      const k = code
        ? LABELS[code] || code
        : String(res.reasons[0] || "unknown")
            .split(":")[0]
            .replace(/\d+(\.\d+)?/g, "#");
      failures[k] = (failures[k] || 0) + 1;
    }
  }
  const p = ok / runs,
    z = 1.96,
    n = runs;
  const centre = (p + (z * z) / (2 * n)) / (1 + (z * z) / n);
  const half =
    (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) /
    (1 + (z * z) / n);
  const sorted = [...mins].sort((x, y) => x - y);
  const pct = (q) => sorted[Math.min(n - 1, Math.floor(q * n))];
  const topFailure =
    Object.entries(failures).sort((x, y) => y[1] - x[1])[0]?.[0] || null;
  return {
    runs,
    seed,
    successRate: p,
    ci95: [centre - half, centre + half],
    failures,
    topFailure,
    minBatteryPercentiles: { p5: pct(0.05), p50: pct(0.5), p95: pct(0.95) },
    minBatteryWh: mins,
  };
}
