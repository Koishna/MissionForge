import { createMissionRun } from "../js/sim/missionRun.js";

function makeResult(name, fn) {
  try {
    const value = fn();

    return {
      name,
      ok: Boolean(value),
      err: value ? undefined : "Expected test to pass.",
    };
  } catch (e) {
    return {
      name,
      ok: false,
      err: e.message,
    };
  }
}

function makeDesign() {
  return {
    orbit: {
      period_s: 5400,
      eclipse_fraction: 0.35,
      insertion_dv_ms: 1000,
      contact_h_per_day: 8,
      eclipse_by_beta: null,
    },
    battery: {
      capacity_wh: 5000,
    },
    power: {
      generation_w: 500,
      consumption_w: 250,
    },
    instruments: [],
    communications: {
      data_rate_kbps: 10,
      downlink_rate_kbps: 20,
    },
    propulsion: {
      delta_v_ms: 2000,
    },
  };
}

function makeMission() {
  return {
    requirements: {
      lifetime_months: 1,
      min_data_gb: 0.01,
    },
  };
}

function makeDecisionData() {
  return {
    phases: {
      phases: [
        {
          id: "transfer",
          name: "Transfer",
          order: 1,
          startSeconds: 0,
        },
      ],
    },
    events: {
      events: [
        {
          id: "solar-storm",
          name: "Solar storm",
          phase: "transfer",
          chance: 1,
          severity: "high",
          effect: {
            solarScale: 0.9,
          },
        },
      ],
    },
    decisions: {
      decisions: [
        {
          id: "solar-storm-response",
          triggerEvent: "solar-storm",
          prompt: "How should the mission respond?",
          options: [
            {
              id: "safe-mode",
              label: "Enter Safe Mode",
              effect: {
                loadScale: 0.8,
                scienceScale: 0.5,
              },
            },
            {
              id: "continue-science",
              label: "Continue Science",
              effect: {
                loadScale: 1.1,
                scienceScale: 1,
              },
            },
          ],
        },
      ],
    },
  };
}

function runMission(data, seed, r = makeDesign()) {
  const run = createMissionRun({
    r,
    mission: makeMission(),
    data,
    seed,
    phaseDeg: 0,
  });

  const beats = [];

  for (let i = 0; i < 50; i++) {
    const beat = run.step();

    if (beat) {
      beats.push(beat);
    }

    if (run.snapshot().pendingDecision) {
      break;
    }

    if (beat?.kind === "result") {
      break;
    }
  }

  return {
    run,
    beats,
  };
}

function runMissionWithChoices(data, seed) {
  const run = createMissionRun({
    r: makeDesign(),
    mission: makeMission(),
    data,
    seed,
    phaseDeg: 0,
  });

  const beats = [];

  for (let i = 0; i < 50; i++) {
    const beat = run.step();

    if (beat) {
      beats.push(beat);
    }

    const pending = run.snapshot().pendingDecision;

    if (pending) {
      run.choose(pending.id, pending.options[0].id);
      continue;
    }

    if (beat?.kind === "result") {
      break;
    }
  }

  return {
    run,
    beats,
  };
}

export async function runMissionRunTests(data) {
  const results = [];

  results.push(
    makeResult("Same seed produces the same mission beats", () => {
      const first = runMission(data, 42);
      const second = runMission(data, 42);

      const firstIds = first.beats.map((beat) => beat.id);
      const secondIds = second.beats.map((beat) => beat.id);

      return JSON.stringify(firstIds) === JSON.stringify(secondIds);
    }),
  );

  results.push(
    makeResult("Different seeds can produce different event sequences", () => {
      const first = runMission(data, 1);
      const second = runMission(data, 9999);

      const firstEvents = first.beats
        .filter((beat) => beat.kind === "event")
        .map((beat) => beat.id);

      const secondEvents = second.beats
        .filter((beat) => beat.kind === "event")
        .map((beat) => beat.id);

      return JSON.stringify(firstEvents) !== JSON.stringify(secondEvents);
    }),
  );

  results.push(
    makeResult("MissionRun exposes the required snapshot API", () => {
      const { run } = runMission(data, 42);
      const snapshot = run.snapshot();

      return (
        "phaseId" in snapshot &&
        "phaseName" in snapshot &&
        "metSeconds" in snapshot &&
        "health" in snapshot &&
        "riskLevel" in snapshot &&
        "nextBeatPreview" in snapshot &&
        "pendingDecision" in snapshot
      );
    }),
  );

  results.push(
    makeResult("MissionRun exposes the required result API", () => {
      const { run } = runMission(data, 42);
      const result = run.result();

      return (
        "success" in result &&
        "criticalEvents" in result &&
        "survivedEvents" in result &&
        "decisions" in result &&
        "margins" in result &&
        "failure" in result
      );
    }),
  );

  results.push(
    makeResult("MissionRun can progress through mission phases", () => {
      const { beats } = runMission(data, 42);

      const phaseBeats = beats.filter((beat) => beat.kind === "phase");

      return phaseBeats.length >= 1;
    }),
  );

  results.push(
    makeResult("MissionRun does not exceed one event per phase", () => {
      const { beats } = runMission(data, 42);

      const eventCounts = {};

      for (const beat of beats) {
        if (beat.kind !== "event") {
          continue;
        }

        eventCounts[beat.phaseId] = (eventCounts[beat.phaseId] || 0) + 1;
      }

      return Object.values(eventCounts).every((count) => count <= 1);
    }),
  );

  results.push(
    makeResult("MissionRun is deterministic for the same seed", () => {
      const first = runMission(data, 12345);
      const second = runMission(data, 12345);

      return JSON.stringify(first.beats) === JSON.stringify(second.beats);
    }),
  );

  results.push(
    makeResult("Event effects persist after a decision", () => {
      const testData = makeDecisionData();

      const { run } = runMission(testData, 42);

      run.step();
      const eventBeat = run.step();

      if (eventBeat?.kind !== "event") {
        return false;
      }

      const choice = run.choose("solar-storm-response", "safe-mode");

      return (
        choice.assumptions.solarScale === 0.9 &&
        choice.assumptions.loadScale === 0.8 &&
        choice.assumptions.scienceScale === 0.5
      );
    }),
  );

  results.push(
    makeResult("Decision effects are applied to the simulation", () => {
      const testData = makeDecisionData();

      const { run } = runMission(testData, 42);

      run.step();
      run.step();

      const choice = run.choose("solar-storm-response", "continue-science");

      return (
        choice.assumptions.solarScale === 0.9 &&
        choice.assumptions.loadScale === 1.1 &&
        choice.assumptions.scienceScale === 1
      );
    }),
  );

  results.push(
    makeResult("Mission outcome is deterministic after decisions", () => {
      const first = runMissionWithChoices(data, 12345);
      const second = runMissionWithChoices(data, 12345);

      return (
        JSON.stringify(first.beats) === JSON.stringify(second.beats) &&
        JSON.stringify(first.run.result()) ===
          JSON.stringify(second.run.result())
      );
    }),
  );

  return results;
}
