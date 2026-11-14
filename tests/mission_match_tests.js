// Run in Node: node tests/mission_match_tests.js
import fs from "node:fs";
import { closestMission } from "../js/sim/closestMission.js";
const missions = JSON.parse(
  fs.readFileSync(new URL("../data/missions.json", import.meta.url), "utf8"),
);
let fails = 0;
const t = (name, ok) => {
  console.log((ok ? "PASS " : "FAIL ") + name);
  if (!ok) fails++;
};

const lroLike = closestMission(
  { dryMassKg: 1000, altKm: 50, lifetimeMonths: 12, instrumentCount: 7 },
  missions,
);
t(
  "an LRO-sized design is a close match",
  lroLike.close && lroLike.best.id === "lro",
);
t("matching design has distance near 0", lroLike.best.distance < 0.1);

const small = closestMission(
  { dryMassKg: 10, altKm: 100, lifetimeMonths: 6, instrumentCount: 2 },
  missions,
);
t(
  "a 10 kg cubesat-like design is NOT called a close match",
  small.close === false,
);
t(
  "text says no close mission for the small design",
  /No close real mission/.test(small.text),
);

const lpLike = closestMission(
  { dryMassKg: 160, altKm: 100, lifetimeMonths: 12, instrumentCount: 6 },
  missions,
);
t(
  "a Lunar Prospector-sized design matches Lunar Prospector",
  lpLike.close && lpLike.best.id === "lunar-prospector",
);

const kp = closestMission(
  { dryMassKg: 550, altKm: 100, lifetimeMonths: 12, instrumentCount: 6 },
  missions,
);
t(
  "KPLO is in the ranking",
  kp.ranked.some((r) => r.id === "kplo"),
);
t(
  "KPLO (no dry mass) never blocks a real mass match",
  kp.close && kp.best.id !== "kplo",
);

t(
  "empty table is handled",
  closestMission({ dryMassKg: 100 }, { real_missions: [] }).best === null,
);
t("missing fields do not crash", closestMission({}, missions).text.length > 0);
console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
