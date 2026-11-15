import { clamp01 } from "./units.js";

const FULL_MARGIN = 0.3;

export const RATING_BANDS = [
  [90, 5, "EXCEPTIONAL"],
  [75, 4, "EXCELLENT"],
  [60, 3, "GOOD"],
  [40, 2, "MARGINAL"],
  [0, 1, "POOR"],
];

export function ratingFor(score) {
  const [, stars, ratingLabel] =
    RATING_BANDS.find(([min]) => score >= min) || RATING_BANDS.at(-1);
  return { stars, ratingLabel };
}

export function evaluateMission(validation, nominal, monteCarlo, mission) {
  const m = (validation && validation.metrics) || {};
  const minData = mission.requirements.min_data_gb;
  const dataShare = nominal ? clamp01(nominal.dataDownlinkedGb / minData) : 0;
  const cap = mission.requirements.budget_usd_m;

  const parts = {
    science: (m.scienceFrac || 0) * dataShare,
    requirements: nominal && nominal.success ? 1 : 0,
    feasibility: validation && validation.ok ? 1 : 0,
    budget:
      m.costUsdM === undefined || m.costUsdM > cap
        ? 0
        : 0.5 + 0.5 * (1 - m.costUsdM / cap),
    margins:
      validation && validation.metrics
        ? clamp01(
            Math.min(m.massMargin, m.powerMargin, m.batteryMargin) /
              FULL_MARGIN,
          )
        : 0,
    reliability: monteCarlo ? monteCarlo.successRate : 0,
  };
  const score = Math.round(
    (Object.values(parts).reduce((a, b) => a + b, 0) / 6) * 100,
  );

  const why = [];
  if (validation && !validation.ok) why.push(...validation.warnings);
  if (validation && validation.cautions) why.push(...validation.cautions);
  if (nominal && !nominal.success) why.push(...nominal.reasons);
  if (monteCarlo && monteCarlo.successRate < 1) {
    why.push(
      `In ${(100 * (1 - monteCarlo.successRate)).toFixed(1)}% of ${monteCarlo.runs} uncertain trials the mission failed. Most common cause: ${monteCarlo.topFailure || "n/a"}.`,
    );
  }
  if (parts.margins < 0.5 && validation && validation.metrics)
    why.push(
      "Resource margins are thin: the weakest of mass, power or battery has under 15% spare.",
    );
  return { score, parts, why, ...ratingFor(score) };
}
