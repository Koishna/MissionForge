export const state = {
  data: null,

  role: "all",

  mission: {
    objective: "Lunar polar reconnaissance",

    requirements: {
      budget_usd_m: 200,
      lifetime_months: 6,
      min_data_gb: 200,
    },
  },

  spacecraft: {
    components: ["bus-small", "solar-300", "battery-small", "comms-xband", "computer-basic", "pointing-basic", "prop-biprop"],
    instruments: ["camera", "spectrometer"],
    orbitId: "llo-100-polar",
    launcherId: "launch-small",
  },

  results: {
    validation: null,
    nominal: null,
    monteCarlo: null,
    report: null,
    outcome: null,
  },

  // Game layer (Stage 0)
  run: null,
  seed: 42,
  attempts: [],
};

const listeners = new Set();

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((f) => f(state));
}

export function onChange(f) {
  listeners.add(f);
}
