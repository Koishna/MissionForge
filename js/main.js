import { state, setState } from "./state.js";
import { register, startRouter } from "./router.js";
import { renderBriefing } from "./ui/briefing.js";
import { renderDesigner } from "./ui/designer.js?v=health-contract-v1";
import { renderValidation } from "./ui/validation.js";
import { renderLaunch } from "./ui/launch.js?v=health-contract-v1";
import { renderSimulation } from "./ui/simulation.js";
import { renderRealityCheck } from "./ui/realityCheck.js";
import { renderReport } from "./ui/report.js";

const files = [
  "components",
  "orbits",
  "missions",
  "uncertainty",
  "constants",
  "events",
  "phases",
  "decisions",
  "achievements",
];

async function load() {
  const data = {};
  for (const f of files) {
    const res = await fetch(`data/${f}.json`);
    if (!res.ok) throw new Error(`Could not load data/${f}.json`);
    data[f] = await res.json();
  }
  return data;
}

load()
  .then((data) => {
    setState({ data });
    register("briefing", "Briefing", renderBriefing);
    register("designer", "Designer", renderDesigner);
    register("validation", "Validation", renderValidation);
    register("launch", "Launch", renderLaunch);
    register("simulation", "Analysis", renderSimulation);
    register("reality", "Reality Check", renderRealityCheck);
    register("report", "Report", renderReport);
    startRouter(
      document.getElementById("app"),
      document.getElementById("nav"),
      state,
    );
  })
  .catch((e) => {
    document.getElementById("app").innerHTML =
      `<p class="warn">${e.message}. Serve the folder with a local server (VS Code Live Server or python -m http.server); opening index.html directly will not load the JSON files.</p>`;
  });
