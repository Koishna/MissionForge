const pct = (x) => `${Math.round(x * 100)}%`;
const has = (x) => typeof x === "number" && Number.isFinite(x);

const LABELS = {
  NO_ORBIT: "No orbit chosen",
  DELTAV_SHORT: "Not enough delta-v",
  BATTERY_DEPLETED: "Battery ran out",
  DATA_SHORTFALL: "Too little data reached the ground",
  THERMAL_OVERLOAD: "Spacecraft overheated",
};

const CAUSES = {
  NO_ORBIT: () => ({
    sentence:
      "Your design had no target orbit, so the spacecraft had nowhere to go.",
    recommendation: "Pick an orbit in the Designer.",
  }),
  DELTAV_SHORT: (n) => ({
    sentence:
      has(n.dvAvailMs) && has(n.dvNeedMs)
        ? `Your spacecraft has ${Math.round(n.dvAvailMs)} m/s of delta-v but this orbit needs ${Math.round(n.dvNeedMs)} m/s.`
        : "Your spacecraft did not have enough delta-v for this orbit.",
    recommendation:
      "Add propellant, pick a more efficient engine, reduce dry mass, OR choose a lower-energy orbit.",
  }),
  BATTERY_DEPLETED: (n, m) => {
    const res = has(n.reserveAtEclipseEntry)
      ? n.reserveAtEclipseEntry
      : m.batteryReserveFrac;
    return {
      sentence: has(res)
        ? `Your design entered eclipse with ${pct(res)} battery reserve and ran out of power.`
        : "Your battery ran out of power during eclipse.",
      recommendation:
        "Increase battery capacity, add solar array area, OR reduce instrument power.",
    };
  },
  DATA_SHORTFALL: (n, m) => {
    const got = has(n.dataGb) ? n.dataGb : m.dataGb;
    const need = n.minDataGb;
    const link = has(n.linkMarginDb) ? n.linkMarginDb : m.linkMarginDb;
    const parts = [];
    if (has(got) && has(need))
      parts.push(
        `only ${Math.round(got)} GB of the ${Math.round(need)} GB required reached the ground`,
      );
    else if (has(got))
      parts.push(`only ${Math.round(got)} GB reached the ground`);
    else parts.push("too little data reached the ground");
    if (has(link)) parts.push(`link margin was ${link.toFixed(1)} dB`);
    return {
      sentence: `Your mission collected data but ${parts.join(" and ")}.`,
      recommendation:
        "Use a higher-gain antenna, raise the data rate, choose an orbit with more ground-contact time, OR carry fewer data-hungry instruments.",
    };
  },
  THERMAL_OVERLOAD: (n) => ({
    sentence: has(n.thermalMarginFrac)
      ? `Your bus could reject ${pct(Math.max(0, 1 + n.thermalMarginFrac))} of the heat your electronics produced, so it overheated.`
      : "Your spacecraft produced more heat than its bus could reject.",
    recommendation:
      "Choose a bus with more thermal rejection OR reduce power dissipated by instruments and radio.",
  }),
};

export function explainFailure(outcome) {
  const f = outcome && outcome.failure;
  if (!f || !f.primaryCode) {
    return {
      primaryCause: "",
      contributingFactor: "",
      sentence: "",
      recommendation: "",
    };
  }
  const numbers = f.numbers || {};
  const margins = (outcome && outcome.margins) || {};
  const build = CAUSES[f.primaryCode];
  const base = build
    ? build(numbers, margins)
    : {
        sentence: "The mission failed, but the cause code is not recognised.",
        recommendation:
          "Review the Validation screen for warnings and fix the weakest margin.",
      };
  const others = (f.contributingCodes || []).filter((c) => c !== f.primaryCode);
  const contributingFactor = others.length
    ? others.map((c) => LABELS[c] || c).join("; ")
    : "";
  return {
    primaryCause: LABELS[f.primaryCode] || f.primaryCode,
    contributingFactor,
    sentence: base.sentence,
    recommendation: base.recommendation,
  };
}
