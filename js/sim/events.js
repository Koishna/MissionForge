import { DEFAULT_ASSUMPTIONS } from "./simulate.js";

export function applyEvents(base, eventIds, eventsFile) {
  const out = { ...DEFAULT_ASSUMPTIONS, ...base };
  for (const id of eventIds) {
    const ev = eventsFile.events.find((e) => e.id === id);
    if (!ev) throw new Error(`Unknown event: ${id}`);
    for (const [key, factor] of Object.entries(ev.effect)) {
      if (!(key in DEFAULT_ASSUMPTIONS))
        throw new Error(
          `Event ${id} changes "${key}", which the simulation does not read.`,
        );
      out[key] *= factor;
    }
  }
  return out;
}
