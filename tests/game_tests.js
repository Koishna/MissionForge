import { ratingFor } from "../js/core/evaluate.js";
import { evaluateAchievements } from "../js/game/achievements.js";
import { explainFailure } from "../js/game/failureAnalysis.js";

const CODES = [
  "NO_ORBIT",
  "DELTAV_SHORT",
  "BATTERY_DEPLETED",
  "DATA_SHORTFALL",
  "THERMAL_OVERLOAD",
];

const good = () => ({
  success: true,
  criticalEvents: 3,
  survivedEvents: 3,
  decisions: [],
  margins: {
    batteryReserveFrac: 0.4,
    dvMarginFrac: 0.3,
    linkMarginDb: 6,
    dataGb: 350,
    massMarginFrac: 0.3,
    costUsdM: 90,
  },
  failure: null,
});

export function runGameTests(data) {
  const defs =
    (data && data.achievements && data.achievements.achievements) || [];
  const out = [];
  const t = (name, ok) => out.push({ name, ok: !!ok });

  const bands = [
    [100, 5],
    [90, 5],
    [89, 4],
    [75, 4],
    [74, 3],
    [60, 3],
    [59, 2],
    [40, 2],
    [39, 1],
    [0, 1],
  ];
  for (const [score, stars] of bands)
    t(`Stars: score ${score} -> ${stars}`, ratingFor(score).stars === stars);
  t("Rating label is set", ratingFor(95).ratingLabel === "EXCEPTIONAL");

  const ctx = { outcome: good(), reliability: 0.95 };
  const all = evaluateAchievements(ctx, defs);
  for (const a of defs)
    t(`Achievement unlocks on crafted outcome: ${a.id}`, all.includes(a.id));
  t("Six achievements defined", defs.length === 6);

  const bad = { ...good(), success: false };
  t(
    "No achievement unlocks on a failing outcome",
    evaluateAchievements({ outcome: bad, reliability: 0.95 }, defs).length ===
      0,
  );

  const thin = good();
  thin.margins.costUsdM = 120;
  thin.margins.dataGb = 100;
  thin.survivedEvents = 1;
  const got = evaluateAchievements({ outcome: thin, reliability: 0.5 }, defs);
  t(
    "Thresholds respected (budget, science, survivor, perfect stay locked)",
    !["budget_master", "science_machine", "survivor", "perfect_mission"].some(
      (id) => got.includes(id),
    ),
  );

  for (const code of CODES) {
    const e = explainFailure({
      ...good(),
      success: false,
      failure: { primaryCode: code, contributingCodes: [], numbers: {} },
    });
    t(
      `explainFailure gives cause, sentence and recommendation: ${code}`,
      e.primaryCause && e.sentence && e.recommendation,
    );
  }
  const b = explainFailure({
    ...good(),
    success: false,
    failure: {
      primaryCode: "BATTERY_DEPLETED",
      contributingCodes: ["DATA_SHORTFALL"],
      numbers: { reserveAtEclipseEntry: 0.08 },
    },
  });
  t(
    "Post-mortem shows the player's own number (8%)",
    b.sentence.includes("8%"),
  );
  t("Contributing factor is named", b.contributingFactor.includes("data"));
  t(
    "Successful run gives empty explanation",
    explainFailure(good()).sentence === "",
  );
  return out;
}
