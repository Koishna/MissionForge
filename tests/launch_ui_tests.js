import {
  sceneStateFor,
  SCENE_STATES,
  SCENE_LABELS,
  sceneLabel,
} from "../js/ui/scene.js";
import { preflightReport, missingParts, riskLabel } from "../js/ui/launch.js";
import { resolveSpacecraft } from "../js/core/resources.js";
import { validateSpacecraft } from "../js/core/validate.js";

export function runLaunchUiTests(data) {
  const mission = {
    requirements: { budget_usd_m: 150, lifetime_months: 6, min_data_gb: 200 },
  };
  const base = {
    components: [
      "bus-small",
      "solar-300",
      "battery-small",
      "comms-xband",
      "computer-basic",
      "pointing-basic",
      "prop-biprop",
    ],
    instruments: ["camera", "spectrometer"],
    orbitId: "llo-100-polar",
    launcherId: "launch-small",
  };
  const R = (sc) => resolveSpacecraft(sc, data);
  const res = [];
  const t = (name, fn) => {
    try {
      res.push({ name, ok: fn() !== false });
    } catch (e) {
      res.push({ name, ok: false, err: e.message });
    }
  };
  const ev = (id, extra = {}) => ({
    kind: "event",
    id,
    phaseId: "transfer",
    severity: "warn",
    outcome: null,
    ...extra,
  });

  t(
    "scene: no beat means idle",
    () =>
      sceneStateFor(null) === "idle" &&
      sceneStateFor(undefined) === "idle" &&
      sceneStateFor("x") === "idle",
  );
  t(
    "scene: phase beats map to their picture",
    () =>
      sceneStateFor({ kind: "phase", phaseId: "launch" }) === "launch" &&
      sceneStateFor({ kind: "phase", phaseId: "separation" }) === "launch" &&
      sceneStateFor({ kind: "phase", phaseId: "transfer" }) === "transfer" &&
      sceneStateFor({ kind: "phase", phaseId: "insertion" }) === "insertion" &&
      sceneStateFor({ kind: "phase", phaseId: "science" }) === "science",
  );
  t(
    "scene: unknown phase falls back to idle",
    () => sceneStateFor({ kind: "phase", phaseId: "nope" }) === "idle",
  );
  t(
    "scene: pending solar storm shows the storm",
    () => sceneStateFor(ev("solar-storm")) === "storm",
  );
  t(
    "scene: pending comms event shows the lost link",
    () =>
      sceneStateFor(ev("comms-outage")) === "comms-lost" &&
      sceneStateFor(ev("comms-degraded")) === "comms-lost",
  );
  t("scene: other pending events show a generic warning", () =>
    ["battery-degraded", "instrument-overdraw", "extra-maneuver"].every(
      (id) => sceneStateFor(ev(id)) === "warning",
    ),
  );
  t(
    "scene: resolved event returns to the phase picture",
    () =>
      sceneStateFor(ev("solar-storm", { outcome: "recovered" })) ===
        "transfer" &&
      sceneStateFor(ev("solar-storm", { outcome: "ok" })) === "transfer",
  );
  t(
    "scene: recovered event in the science phase shows plain orbit",
    () =>
      sceneStateFor(
        ev("comms-outage", { phaseId: "science", outcome: "recovered" }),
      ) === "orbit",
  );
  t(
    "scene: lost comms event shows lost link, other lost events show failure",
    () =>
      sceneStateFor(ev("comms-outage", { outcome: "lost" })) === "comms-lost" &&
      sceneStateFor(ev("battery-degraded", { outcome: "lost" })) === "failure",
  );
  t(
    "scene: info events do not raise a hazard",
    () =>
      sceneStateFor(
        ev("stage-separation", { severity: "info", phaseId: "separation" }),
      ) === "launch",
  );
  t(
    "scene: decision beats show the hazard being decided",
    () =>
      sceneStateFor({
        kind: "decision",
        id: "solar-storm-decision",
        phaseId: "transfer",
      }) === "storm",
  );
  t(
    "scene: result beat is success unless the outcome is lost",
    () =>
      sceneStateFor({ kind: "result", outcome: "ok" }) === "success" &&
      sceneStateFor({ kind: "result", outcome: null }) === "success" &&
      sceneStateFor({ kind: "result", outcome: "lost" }) === "failure",
  );
  t("scene: every state name the mapper can return is a known state", () => {
    const beats = [
      { kind: "result", outcome: "lost" },
      { kind: "phase", phaseId: "science" },
      ev("solar-storm"),
      ev("x"),
      ev("comms-outage"),
    ];
    return beats.every((b) => SCENE_STATES.includes(sceneStateFor(b)));
  });
  t("scene: every state has a label", () =>
    SCENE_STATES.every(
      (s) => typeof SCENE_LABELS[s] === "string" && SCENE_LABELS[s].length > 0,
    ),
  );
  t(
    "scene: unknown state label falls back to idle",
    () => sceneLabel("zzz") === SCENE_LABELS.idle,
  );

  t("launch: base design is ready and has no missing parts", () => {
    const r = R(base);
    return (
      missingParts(r).length === 0 &&
      preflightReport(r, mission, validateSpacecraft(r, mission)).ready === true
    );
  });
  t("launch: no orbit blocks launch and says so", () => {
    const r = R({ ...base, orbitId: null });
    const rep = preflightReport(r, mission, validateSpacecraft(r, mission));
    return !rep.ready && rep.missing.includes("an orbit");
  });
  t("launch: no launcher, battery or instrument are each reported", () => {
    const m = missingParts(
      R({
        ...base,
        launcherId: null,
        instruments: [],
        components: base.components.filter((c) => c !== "battery-small"),
      }),
    );
    return (
      m.includes("a launch vehicle") &&
      m.includes("at least one instrument") &&
      m.includes("a battery")
    );
  });
  t("launch: no comms part is reported as a missing transmitter", () =>
    missingParts(
      R({
        ...base,
        components: base.components.filter((c) => c !== "comms-xband"),
      }),
    ).includes("a comms transmitter"),
  );
  t("launch: summary has five rows with a valid status each", () => {
    const r = R(base);
    const rep = preflightReport(r, mission, validateSpacecraft(r, mission));
    return (
      rep.rows.length === 5 &&
      rep.rows.every((x) => ["ok", "low", "over", "unknown"].includes(x.status))
    );
  });
  t("launch: a tiny budget marks cost as over the limit", () => {
    const tight = {
      requirements: { ...mission.requirements, budget_usd_m: 10 },
    };
    const r = R(base);
    return (
      preflightReport(r, tight, validateSpacecraft(r, tight)).rows.find(
        (x) => x.label === "Cost",
      ).status === "over"
    );
  });
  t(
    "launch: validation warnings pass through so the screen can offer Launch anyway",
    () => {
      const tight = {
        requirements: { ...mission.requirements, budget_usd_m: 10 },
      };
      const r = R(base);
      const rep = preflightReport(r, tight, validateSpacecraft(r, tight));
      return rep.ready && rep.warnings.length > 0;
    },
  );
  t(
    "launch: risk label bands",
    () =>
      riskLabel(0.95) === "Low" &&
      riskLabel(0.8) === "Low" &&
      riskLabel(0.6) === "Moderate" &&
      riskLabel(0.2) === "High",
  );
  return res;
}
