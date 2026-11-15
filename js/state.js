export const state = {
  data: null,

  role: "all",

  mission: {
    objective: "Lunar polar reconnaissance",

    requirements: {
      budget_usd_m: 150,
      lifetime_months: 6,
      min_data_gb: 200,
    },
  },

  spacecraft: {
    components: [],
    instruments: [],
    orbitId: null,
    launcherId: null,
  },

  results: {
    validation: null,
    nominal: null,
    monteCarlo: null,
    report: null,
  },
};

const listeners = new Set();

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((f) => f(state));
}

export function onChange(f) {
  listeners.add(f);
}
