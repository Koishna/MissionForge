import { mulberry32 } from "../uncertainty/rng.js";
import { simulateNominal } from "./simulate.js";
import { applyEffects } from "./events.js";
import { findDecisionForEvent, applyDecision } from "./decisions.js";

export function createMissionRun({
  r,
  mission,
  data,
  seed = 42,
  phaseDeg = 0,
}) {
  const rng = mulberry32(seed);

  const phases = [...(data.phases?.phases || [])].sort(
    (a, b) => a.order - b.order,
  );

  const events = data.events?.events || [];

  let phaseIndex = 0;
  let currentPhase = null;
  let phaseEvent = null;
  let pendingDecision = null;
  let finished = false;

  let assumptions = {
    sunPhaseDeg: phaseDeg,
  };

  const decisionHistory = [];
  const criticalEvents = [];
  const survivedEvents = [];
  const beats = [];

  let metSeconds = 0;

  function isSimpleDesign() {
    return !Array.isArray(r?.parts);
  }

  function simpleSimulation() {
    const power = r?.power || {};
    const battery = r?.battery || {};
    const orbit = r?.orbit || {};
    const communications = r?.communications || {};
    const propulsion = r?.propulsion || {};

    const lifetimeMonths = Number(mission?.requirements?.lifetime_months) || 1;

    const load =
      (Number(power.consumption_w) || 0) *
      (assumptions.loadScale || 1) *
      (assumptions.thermalScale || 1);

    const generation =
      (Number(power.generation_w) || 0) * (assumptions.solarScale || 1);

    const batteryCapacity = Number(battery.capacity_wh) || 0;
    const eclipseFraction = Number(orbit.eclipse_fraction) || 0;

    const eclipseDemand =
      (load * eclipseFraction * (Number(orbit.period_s) || 0)) / 3600;

    const batteryFade = Number(assumptions.batteryFadePerMonth) || 0;

    const agedBattery =
      batteryCapacity * Math.max(0, 1 - batteryFade * lifetimeMonths);

    const minBattery = Math.min(agedBattery, agedBattery - eclipseDemand);

    const minBatteryFrac =
      batteryCapacity > 0 ? minBattery / batteryCapacity : 0;

    const availableDv = Number(propulsion.delta_v_ms) || 0;

    const requiredDv =
      Number(orbit.insertion_dv_ms) * (assumptions.deltaVScale || 1) || 0;

    const dvMarginFrac =
      requiredDv > 0 ? (availableDv - requiredDv) / requiredDv : Infinity;

    const dataRate = Number(communications.data_rate_kbps) || 0;
    const downlinkRate = Number(communications.downlink_rate_kbps) || 0;

    const contactHours =
      (Number(orbit.contact_h_per_day) || 0) * (assumptions.contactScale ?? 1);

    const dataGenerated =
      (dataRate *
        (assumptions.scienceScale || 1) *
        1000 *
        lifetimeMonths *
        30 *
        86400) /
      (8 * 1e9);

    const dataDownlinked =
      (downlinkRate *
        (assumptions.downlinkScale || 1) *
        1000 *
        contactHours *
        3600 *
        lifetimeMonths *
        30) /
      (8 * 1e9);

    const dataDownlinkedGb = Math.min(dataGenerated, dataDownlinked);

    const minData = Number(mission?.requirements?.min_data_gb) || 0;

    const codes = [];
    const reasons = [];

    if (!r?.orbit) {
      codes.push("NO_ORBIT");
      reasons.push("No orbit chosen.");
    }

    if (requiredDv > 0 && availableDv < requiredDv) {
      codes.push("DELTAV_SHORT");
      reasons.push(
        `Delta-v ${availableDv.toFixed(0)} m/s is short of the ${requiredDv.toFixed(0)} m/s this orbit needs.`,
      );
    }

    if (batteryCapacity > 0 && minBattery <= 0) {
      codes.push("BATTERY_DEPLETED");
      reasons.push("Battery ran out.");
    }

    if (minData > 0 && dataDownlinkedGb < minData) {
      codes.push("DATA_SHORTFALL");
      reasons.push(
        `Only ${dataDownlinkedGb.toFixed(1)} GB reached the ground; the requirement is ${minData.toFixed(1)} GB.`,
      );
    }

    if (generation <= load && batteryCapacity > 0) {
      codes.push("THERMAL_OVERLOAD");
      reasons.push(
        `Spacecraft load ${load.toFixed(0)} W is not sustainable against ${generation.toFixed(0)} W generation.`,
      );
    }

    return {
      success: codes.length === 0,
      reasons,
      codes,
      minBatteryWh: minBattery,
      minBatteryFrac,
      reserveAtEclipseEntry: agedBattery,
      depletedAtS: minBattery <= 0 ? Number(orbit.period_s) || 0 : null,
      generatedGb: dataGenerated,
      dataDownlinkedGb,
      eclipseDemandWh: eclipseDemand,
      eclipseMin: (eclipseFraction * (Number(orbit.period_s) || 0)) / 60,
      eclipseMinShortest:
        (eclipseFraction * (Number(orbit.period_s) || 0)) / 60,
      periodS: Number(orbit.period_s) || 0,
      dvAvailMs: availableDv,
      dvNeedMs: requiredDv,
      dvMarginFrac,
      timeline: [],
    };
  }

  function getPhaseId() {
    return currentPhase?.id || phases[phaseIndex]?.id || null;
  }

  function getPhaseName() {
    return currentPhase?.name || phases[phaseIndex]?.name || "Mission Complete";
  }

  function getPhaseEvents(phase) {
    return events.filter((event) => {
      if (!event.phase) {
        return true;
      }

      return event.phase === phase.id;
    });
  }

  function rollPhaseEvent(phase) {
    const candidates = getPhaseEvents(phase);

    for (const event of candidates) {
      const chance = Number(event.chance ?? 0);

      if (rng() < chance) {
        return event;
      }
    }

    return null;
  }

  function calculateSimulation() {
    if (isSimpleDesign()) {
      return simpleSimulation();
    }

    return simulateNominal(r, mission, assumptions);
  }

  function calculateHealth(sim, healthAssumptions = assumptions) {
    const battery = Math.max(0, Math.min(100, (sim.minBatteryFrac ?? 0) * 100));

    const dv = Math.max(0, Math.min(100, ((sim.dvMarginFrac ?? 0) + 1) * 50));

    const dataRequired = mission.requirements?.min_data_gb || 0;

    const dataHealth =
      dataRequired > 0
        ? Math.max(
            0,
            Math.min(100, ((sim.dataDownlinkedGb ?? 0) / dataRequired) * 100),
          )
        : 100;

    const overall = Math.round((battery + dv + dataHealth) / 3);

    return {
      overall,
      power: battery,
      fuel: dv,
      comms: dataHealth,
      thermal: Math.max(
        0,
        Math.min(
          100,
          100 - Math.max(0, (healthAssumptions.thermalScale || 1) - 1) * 200,
        ),
      ),
      science: Math.max(
        0,
        Math.min(100, (healthAssumptions.scienceScale || 1) * 100),
      ),
    };
  }

  function calculateRisk(sim) {
    if (!sim.success) {
      return "HIGH";
    }

    const batteryMargin = sim.minBatteryFrac ?? 0;
    const dvMargin = sim.dvMarginFrac ?? 0;

    if (batteryMargin < 0.15 || dvMargin < 0.1) {
      return "HIGH";
    }

    if (batteryMargin < 0.3 || dvMargin < 0.25) {
      return "MODERATE";
    }

    return "LOW";
  }

  function createPhaseBeat(phase) {
    const sim = calculateSimulation();

    return {
      id: `phase-${phase.id}`,
      kind: "phase",
      phaseId: phase.id,
      metSeconds,
      severity: "info",
      title: phase.name,
      text: phase.description || `Mission phase: ${phase.name}.`,
      healthDelta: {
        power: 0,
        fuel: 0,
        comms: 0,
        thermal: 0,
        science: 0,
      },
      decision: null,
      outcome: sim.success ? "ok" : "recovered",
    };
  }

  function createEventBeat(event) {
    const simBefore = calculateSimulation();
    const healthBefore = calculateHealth(simBefore);

    const eventAssumptions = applyEffects(assumptions, [event.effect || {}]);

    const simAfter = isSimpleDesign()
      ? simpleSimulationWithAssumptions(eventAssumptions)
      : simulateNominal(r, mission, eventAssumptions);

    const healthAfter = calculateHealth(simAfter, eventAssumptions);

    const healthDelta = {
      power: healthAfter.power - healthBefore.power,
      fuel: healthAfter.fuel - healthBefore.fuel,
      comms: healthAfter.comms - healthBefore.comms,
      thermal: healthAfter.thermal - healthBefore.thermal,
      science: healthAfter.science - healthBefore.science,
    };

    const decision = findDecisionForEvent(data.decisions, event.id);

    phaseEvent = {
      id: `event-${event.id}-${phaseIndex}`,
      eventId: event.id,
      kind: "event",
      phaseId: currentPhase.id,
      metSeconds,
      severity: event.severity || "medium",
      title: event.headline || event.name || "Unexpected Event",
      text: event.detail || event.response || "An unexpected event occurred.",
      healthDelta,
      decision: decision
        ? {
            id: decision.id,
            prompt: decision.prompt,
            options: decision.options || [],
          }
        : null,
      outcome: simAfter.success ? "ok" : "recovered",
    };

    if (simAfter.success) {
      survivedEvents.push(event.id);
    } else {
      criticalEvents.push(event.id);
    }

    return phaseEvent;
  }

  function simpleSimulationWithAssumptions(nextAssumptions) {
    const previous = assumptions;

    try {
      assumptions = nextAssumptions;
      return simpleSimulation();
    } finally {
      assumptions = previous;
    }
  }

  function createResultBeat() {
    const sim = calculateSimulation();

    return {
      id: "mission-result",
      kind: "result",
      phaseId: currentPhase?.id || phases[phases.length - 1]?.id || null,
      metSeconds,
      severity: sim.success ? "info" : "critical",
      title: sim.success ? "MISSION SUCCESS" : "MISSION LOST",
      text: sim.success
        ? "All mission requirements were satisfied."
        : "The spacecraft could not satisfy all mission requirements.",
      healthDelta: {
        power: 0,
        fuel: 0,
        comms: 0,
        thermal: 0,
        science: 0,
      },
      decision: null,
      outcome: sim.success ? "ok" : "lost",
    };
  }

  function step() {
    if (finished || pendingDecision) {
      return null;
    }

    if (!currentPhase) {
      currentPhase = phases[phaseIndex];

      if (!currentPhase) {
        finished = true;

        const beat = createResultBeat();
        beats.push(beat);

        return beat;
      }

      metSeconds = Number(currentPhase.startSeconds ?? 0);

      const beat = createPhaseBeat(currentPhase);
      beats.push(beat);

      return beat;
    }

    if (!phaseEvent) {
      phaseEvent = rollPhaseEvent(currentPhase);

      if (phaseEvent) {
        const beat = createEventBeat(phaseEvent);

        if (beat.decision) {
          pendingDecision = beat.decision;
        }

        beats.push(beat);

        return beat;
      }
    }

    phaseIndex += 1;
    currentPhase = null;
    phaseEvent = null;

    return step();
  }

  function choose(decisionId, optionId) {
    if (!pendingDecision) {
      throw new Error("No decision is currently waiting for a choice.");
    }

    if (pendingDecision.id !== decisionId) {
      throw new Error(`Unexpected decision: ${decisionId}`);
    }

    const decision = findDecisionForEvent(data.decisions, phaseEvent?.eventId);

    if (!decision || decision.id !== decisionId) {
      throw new Error(`Decision "${decisionId}" could not be resolved.`);
    }

    const applied = applyDecision(assumptions, decision, optionId);

    assumptions = applied.assumptions;

    decisionHistory.push({
      decisionId,
      optionId,
    });

    pendingDecision = null;

    return {
      decisionId,
      optionId,
      effect: applied.option.effect || {},
      assumptions: {
        ...assumptions,
      },
    };
  }

  function snapshot() {
    const sim = calculateSimulation();

    return {
      phaseId: getPhaseId(),
      phaseName: getPhaseName(),
      metSeconds,
      health: calculateHealth(sim),
      riskLevel: calculateRisk(sim),
      nextBeatPreview: pendingDecision
        ? "Decision required"
        : currentPhase
          ? `Continue ${currentPhase.name}`
          : "Next phase",
      pendingDecision,
    };
  }

  function result() {
    const sim = calculateSimulation();

    let primaryCode = null;

    if (sim.codes && sim.codes.length) {
      primaryCode = sim.codes[0];
    }

    return {
      success: sim.success,
      criticalEvents: [...criticalEvents],
      survivedEvents: [...survivedEvents],
      decisions: [...decisionHistory],
      margins: {
        batteryReserveFrac: sim.minBatteryFrac ?? 0,
        dvMarginFrac: sim.dvMarginFrac ?? 0,
        linkMarginDb: null,
        dataGb: sim.dataDownlinkedGb ?? 0,
        massMarginFrac: null,
        costUsdM: null,
      },
      failure: sim.success
        ? null
        : {
            primaryCode,
            contributingCodes: sim.codes?.slice(1) || [],
            numbers: {
              minBatteryFrac: sim.minBatteryFrac ?? 0,
              dvMarginFrac: sim.dvMarginFrac ?? 0,
              dataDownlinkedGb: sim.dataDownlinkedGb ?? 0,
              depletedAtS: sim.depletedAtS,
            },
          },
    };
  }

  return {
    step,
    choose,
    snapshot,
    result,
  };
}
