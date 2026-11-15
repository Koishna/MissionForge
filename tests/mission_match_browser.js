// Browser version of mission_match_tests.js (same checks, takes data from the page).
import { closestMission } from "../js/sim/closestMission.js";

export function runMissionMatchTests(data) {
  const missions = data.missions;
  const res = [];
  const t = (name, fn) => {
    try { res.push({ name, ok: fn() !== false }); }
    catch (e) { res.push({ name, ok: false, err: e.message }); }
  };
  t("mission match: an LRO-sized design is a close match", () => {
    const m = closestMission({ dryMassKg: 1000, altKm: 50, lifetimeMonths: 12, instrumentCount: 7 }, missions);
    return m.close && m.best.id === "lro" && m.best.distance < 0.1;
  });
  t("mission match: a 10 kg design is not a close match", () =>
    closestMission({ dryMassKg: 10, altKm: 100, lifetimeMonths: 6, instrumentCount: 2 }, missions).close === false);
  t("mission match: a Lunar Prospector-sized design matches it", () => {
    const m = closestMission({ dryMassKg: 160, altKm: 100, lifetimeMonths: 12, instrumentCount: 6 }, missions);
    return m.close && m.best.id === "lunar-prospector";
  });
  t("mission match: a mission with no dry mass never blocks a real match", () => {
    const m = closestMission({ dryMassKg: 550, altKm: 100, lifetimeMonths: 12, instrumentCount: 6 }, missions);
    return m.close && m.best.id !== "kplo";
  });
  t("mission match: empty table and missing fields do not crash", () =>
    closestMission({ dryMassKg: 100 }, { real_missions: [] }).best === null &&
    closestMission({}, missions).text.length > 0);
  return { results: res };
}
