import { DEFAULT_ASSUMPTIONS } from "./simulate.js";

function applyEffectObject(out, effect, source = "effect") {
  for (const [key, factor] of Object.entries(effect)) {
    if (!(key in DEFAULT_ASSUMPTIONS)) {
      throw new Error(
        `${source} changes "${key}", which the simulation does not read.`,
      );
    }

    out[key] *= factor;
  }

  return out;
}

export function applyEffects(base, effectObjects) {
  const out = { ...DEFAULT_ASSUMPTIONS, ...base };

  for (const effect of effectObjects) {
    applyEffectObject(out, effect);
  }

  return out;
}

export function applyEvents(base, eventIds, eventsFile) {
  const effectObjects = [];

  for (const id of eventIds) {
    const ev = eventsFile.events.find((e) => e.id === id);

    if (!ev) {
      throw new Error(`Unknown event: ${id}`);
    }

    effectObjects.push(ev.effect);
  }

  return applyEffects(base, effectObjects);
}
