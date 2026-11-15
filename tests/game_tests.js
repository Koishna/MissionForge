import { ratingFor } from "../js/core/evaluate.js";
import { evaluateAchievements } from "../js/game/achievements.js";
import { explainFailure } from "../js/game/failureAnalysis.js";
import { buildOutcome, starsText } from "../js/ui/resultsBanner.js";
import { designSummary, nextSeed } from "../js/ui/retryPanel.js";
import {
  loadProgress,
  saveProgress,
  recordAttempt,
  useStorage,
} from "../js/game/storage.js";

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

  const mem = () => {
    const d = {};
    return {
      getItem: (k) => (k in d ? d[k] : null),
      setItem: (k, v) => {
        d[k] = v;
      },
    };
  };
  const blocked = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  useStorage(mem());
  t(
    "Storage: empty store gives defaults",
    loadProgress().best === 0 && loadProgress().attempts.length === 0,
  );
  const p1 = recordAttempt(
    loadProgress(),
    {
      designSummary: { massKg: 100 },
      score: 70,
      success: true,
      seed: 42,
      at: 1,
    },
    ["survivor"],
  );
  t("Storage: save returns true", saveProgress(p1) === true);
  const back = loadProgress();
  t(
    "Storage: round trip keeps best, achievements, last design",
    back.best === 70 &&
      back.achievements[0] === "survivor" &&
      back.lastDesign.massKg === 100,
  );
  const p2 = recordAttempt(
    back,
    { designSummary: null, score: 50, success: false, seed: 7, at: 2 },
    ["survivor", "lightweight"],
  );
  t(
    "Storage: best never goes down, achievements merge without duplicates",
    p2.best === 70 && p2.achievements.length === 2 && p2.attempts.length === 2,
  );
  let many = loadProgress();
  for (let i = 0; i < 30; i++)
    many = recordAttempt(many, { score: i, success: true, seed: i, at: i });
  t("Storage: attempts capped at 20", many.attempts.length === 20);
  useStorage(blocked);
  t(
    "Storage: blocked storage does not throw",
    loadProgress().best === 0 && saveProgress(p1) === false,
  );
  const corrupt = mem();
  corrupt.setItem("missionforge.progress.v1", "{not json");
  useStorage(corrupt);
  t("Storage: corrupt data gives defaults", loadProgress().best === 0);
  useStorage(undefined);

  const st = {
    results: {
      validation: {
        metrics: {
          massMargin: 0.25,
          costUsdM: 92.5,
          powerMargin: 0.1,
          linkMarginDb: 3.2,
        },
      },
    },
  };
  const rows = designSummary(st);
  t(
    "Retry: summary has mass, cost, power, comms rows",
    rows.length === 4 && rows[1][1] === "92.5 M USD" && rows[0][1] === "25%",
  );
  t(
    "Retry: no validation gives empty summary",
    designSummary({ results: {} }).length === 0 &&
      designSummary(null).length === 0,
  );
  t(
    "Retry: new seed always differs from current",
    (() => {
      const seq = [41 / 1000000, 0.5];
      return nextSeed(42, () => seq.shift()) === 500001;
    })(),
  );

  t(
    "Banner: stars text",
    starsText(3) === "\u2605\u2605\u2605\u2606\u2606" &&
      starsText(9) === "\u2605".repeat(5),
  );
  t("Banner: nothing flown gives null", buildOutcome({ results: {} }) === null);
  const real = good();
  const b1 = buildOutcome({ results: { outcome: real } });
  t(
    "Banner: real outcome is passed through",
    b1.outcome === real && b1.fromRun === true,
  );
  const nomFail = {
    success: false,
    codes: ["DELTAV_SHORT", "DATA_SHORTFALL"],
    dvAvailMs: 900,
    dvNeedMs: 1200,
    dataDownlinkedGb: 50,
  };
  const b2 = buildOutcome({
    mission: { requirements: { min_data_gb: 200 } },
    results: { nominal: nomFail, validation: { metrics: { linkMarginDb: 2 } } },
  });
  t(
    "Banner: failed nominal gives primary and contributing codes",
    b2.fromRun === false &&
      b2.outcome.failure.primaryCode === "DELTAV_SHORT" &&
      b2.outcome.failure.contributingCodes[0] === "DATA_SHORTFALL",
  );
  t(
    "Banner: nominal failure carries the player's numbers",
    b2.outcome.failure.numbers.dvNeedMs === 1200 &&
      b2.outcome.failure.numbers.minDataGb === 200,
  );
  const b3 = buildOutcome({
    results: { nominal: { success: true, codes: [] } },
  });
  t(
    "Banner: successful nominal has no failure",
    b3.outcome.success === true && b3.outcome.failure === null,
  );
  return out;
}
