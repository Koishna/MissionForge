import { applyEffects } from "./events.js";

export function findDecision(decisionsFile, decisionId) {
  const decisions = decisionsFile?.decisions || [];

  const decision = decisions.find((item) => item.id === decisionId);

  if (!decision) {
    throw new Error(`Unknown decision: ${decisionId}`);
  }

  return decision;
}

export function findDecisionForEvent(decisionsFile, eventId) {
  const decisions = decisionsFile?.decisions || [];

  return (
    decisions.find(
      (item) => item.triggerEvent === eventId || item.eventId === eventId,
    ) || null
  );
}

export function applyDecision(base, decision, optionId) {
  if (!decision) {
    throw new Error("Decision is required.");
  }

  const option = (decision.options || []).find((item) => item.id === optionId);

  if (!option) {
    throw new Error(
      `Unknown option "${optionId}" for decision "${decision.id}".`,
    );
  }

  const effect = option.effect || {};

  return {
    option,
    assumptions: applyEffects(base, [effect]),
  };
}
