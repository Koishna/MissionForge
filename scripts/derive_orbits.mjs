import fs from "fs";
import { describeOrbit, bodyFrom } from "../js/sim/orbital.js";

const root = new URL("../", import.meta.url);
const read = (f) => JSON.parse(fs.readFileSync(new URL(f, root), "utf8"));
const body = bodyFrom(read("data/constants.json"));
const file = read("data/orbits.json");
const SRC2 =
  "Calculated by js/sim/orbital.js: eclipse share for Sun-to-orbit-plane angle beta = 0 to 90 deg in 5 deg steps. Assumes a polar orbit fixed in space, apsides over the poles, Moon axis perpendicular to the ecliptic. Cross-check with GMAT.";
const SRC =
  "Calculated by js/sim/orbital.js from data/constants.json: two-body orbit, cylindrical Moon shadow, Sun in the orbit plane (beta = 0), worst orientation. Conservative; cross-check with GMAT.";

let stale = false;
for (const o of file.orbits) {
  const d = describeOrbit(
    o.perilune_alt_km.value,
    o.apolune_alt_km.value,
    body,
  );
  const next = {
    period_s: {
      value: Math.round(d.periodS),
      unit: "s",
      provenance: "CALCULATED",
      source: SRC,
    },
    eclipse_fraction: {
      value: Number(d.eclipseFraction.toFixed(4)),
      unit: "fraction",
      provenance: "CALCULATED",
      source: SRC,
    },
    eclipse_by_beta: {
      value: d.eclipseByBeta,
      unit: "fraction",
      step_deg: 5,
      provenance: "CALCULATED",
      source: SRC2,
    },
  };
  for (const k of Object.keys(next)) {
    if (!o[k] || JSON.stringify(o[k].value) !== JSON.stringify(next[k].value))
      stale = true;
    o[k] = next[k];
  }
}
if (process.argv.includes("--check")) {
  console.log(
    stale ? "orbits.json is out of date" : "orbits.json is up to date",
  );
  process.exit(stale ? 1 : 0);
}
fs.writeFileSync(
  new URL("data/orbits.json", root),
  JSON.stringify(file, null, 2) + "\n",
);
console.log("orbits.json updated");
