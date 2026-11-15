import { setState } from "../state.js";

const has = (x) => typeof x === "number" && Number.isFinite(x);
const pct = (x) => `${Math.round(x * 100)}%`;

export function designSummary(state) {
  const m =
    (state &&
      state.results &&
      state.results.validation &&
      state.results.validation.metrics) ||
    null;
  if (!m) return [];
  const rows = [];
  if (has(m.massMargin)) rows.push(["Mass margin", pct(m.massMargin)]);
  if (has(m.costUsdM)) rows.push(["Cost", `${m.costUsdM.toFixed(1)} M USD`]);
  if (has(m.powerMargin)) rows.push(["Power margin", pct(m.powerMargin)]);
  if (has(m.linkMarginDb))
    rows.push(["Comms link margin", `${m.linkMarginDb.toFixed(1)} dB`]);
  return rows;
}

export function nextSeed(current, rand = Math.random) {
  let s = current;
  while (s === current) s = Math.floor(rand() * 1000000) + 1;
  return s;
}

export function renderRetryPanel(container, state) {
  const rows = designSummary(state);
  const list = rows.length
    ? `<dl class="retry-summary">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`
    : `<p class="muted">No design summary available.</p>`;

  container.innerHTML = `
    <section class="retry-panel" aria-labelledby="retry-title">
      <h3 id="retry-title">Try again</h3>
      <p class="muted">Previous design</p>
      ${list}
      <div class="retry-actions">
        <button type="button" id="retry-modify">Modify spacecraft</button>
        <button type="button" id="retry-same">Try same design</button>
      </div>
      <p class="muted retry-hint">Modify keeps the same mission events so you can test your fix. Try same design rolls new events.</p>
    </section>`;

  container.querySelector("#retry-modify").addEventListener("click", () => {
    location.hash = "#designer";
  });
  container.querySelector("#retry-same").addEventListener("click", () => {
    setState({ seed: nextSeed(state.seed), run: null });
    location.hash = "#launch";
  });
}
