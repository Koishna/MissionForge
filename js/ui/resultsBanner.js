import { setState } from "../state.js";
import { evaluateMission, ratingFor } from "../core/evaluate.js";
import { explainFailure } from "../game/failureAnalysis.js";
import { evaluateAchievements } from "../game/achievements.js";
import { loadProgress, saveProgress, recordAttempt } from "../game/storage.js";
import { renderRetryPanel, designSummary } from "./retryPanel.js";

const recorded = new WeakSet();

const esc = (v) =>
  String(v).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

export const FAILED_SCORE_CAP = 59;

export function scoreForOutcome(ev, outcome) {
  if (outcome && !outcome.success && ev.score > FAILED_SCORE_CAP) {
    return {
      score: FAILED_SCORE_CAP,
      ...ratingFor(FAILED_SCORE_CAP),
      capped: true,
    };
  }
  return {
    score: ev.score,
    stars: ev.stars,
    ratingLabel: ev.ratingLabel,
    capped: false,
  };
}

export function starsText(n) {
  const k = Math.max(0, Math.min(5, n | 0));
  return "\u2605".repeat(k) + "\u2606".repeat(5 - k);
}

export function buildOutcome(state) {
  const res = (state && state.results) || {};
  if (res.outcome) return { outcome: res.outcome, fromRun: true };
  const n = res.nominal;
  if (!n) return null;
  const m = (res.validation && res.validation.metrics) || {};
  const req = (state.mission && state.mission.requirements) || {};
  const codes = Array.isArray(n.codes) ? n.codes : [];
  const dvMargin = n.dvNeedMs
    ? (n.dvAvailMs - n.dvNeedMs) / n.dvNeedMs
    : undefined;
  return {
    fromRun: false,
    outcome: {
      success: !!n.success,
      criticalEvents: 0,
      survivedEvents: 0,
      decisions: [],
      margins: {
        batteryReserveFrac: undefined,
        dvMarginFrac: dvMargin,
        linkMarginDb: m.linkMarginDb,
        dataGb: n.dataDownlinkedGb,
        massMarginFrac: m.massMargin,
        costUsdM: m.costUsdM,
      },
      failure:
        n.success || !codes.length
          ? null
          : {
              primaryCode: codes[0],
              contributingCodes: codes.slice(1),
              numbers: {
                dvAvailMs: n.dvAvailMs,
                dvNeedMs: n.dvNeedMs,
                dataGb: n.dataDownlinkedGb,
                minDataGb: req.min_data_gb,
                linkMarginDb: m.linkMarginDb,
              },
            },
    },
  };
}

export function renderResultsBanner(container, state) {
  const built = buildOutcome(state);
  if (!built) {
    container.innerHTML = `
      <section class="results-banner results-banner--none" aria-labelledby="rb-title">
        <p class="results-kicker">MISSION RESULT</p>
        <h2 id="rb-title">NO MISSION FLOWN YET</h2>
        <p>Build a spacecraft, then use <a href="#launch">Launch</a> to fly it.</p>
      </section>`;
    return;
  }

  const { outcome, fromRun } = built;
  const res = state.results || {};
  const ev = scoreForOutcome(
    evaluateMission(res.validation, res.nominal, res.monteCarlo, state.mission),
    outcome,
  );
  const reliability =
    res.monteCarlo && typeof res.monteCarlo.successRate === "number"
      ? res.monteCarlo.successRate
      : null;
  const defs =
    (state.data &&
      state.data.achievements &&
      state.data.achievements.achievements) ||
    [];
  const unlockedIds = evaluateAchievements({ outcome, reliability }, defs);

  const before = loadProgress();
  const newBest = ev.score > before.best;
  const newIds = unlockedIds.filter((id) => !before.achievements.includes(id));

  if (fromRun && !recorded.has(outcome)) {
    recorded.add(outcome);
    const attempt = {
      designSummary: Object.fromEntries(designSummary(state)),
      score: ev.score,
      success: !!outcome.success,
      seed: state.seed,
      at: Date.now(),
    };
    const progress = recordAttempt(before, attempt, unlockedIds);
    saveProgress(progress);
    setState({ attempts: progress.attempts });
  }

  const ok = !!outcome.success;
  const achievementsHtml = unlockedIds.length
    ? `<ul class="results-achievements">${unlockedIds
        .map((id) => {
          const a = defs.find((d) => d.id === id) || {
            name: id,
            description: "",
            icon: "",
          };
          return `<li><span class="results-ach-icon" aria-hidden="true">${esc(a.icon)}</span>
            <span><strong>${esc(a.name)}</strong>${newIds.includes(id) ? ' <span class="results-new">NEW</span>' : ""}<br>
            <span class="muted">${esc(a.description)}</span></span></li>`;
        })
        .join("")}</ul>`
    : `<p class="muted">No achievements unlocked this run.</p>`;

  let postMortem = "";
  if (!ok) {
    const e = explainFailure(outcome);
    postMortem = e.sentence
      ? `<div class="results-postmortem">
          <h3>What went wrong</h3>
          <p><strong>${esc(e.primaryCause)}.</strong> ${esc(e.sentence)}</p>
          ${e.contributingFactor ? `<p><strong>Also:</strong> ${esc(e.contributingFactor)}.</p>` : ""}
          <p><strong>Try this:</strong> ${esc(e.recommendation)}</p>
        </div>`
      : `<div class="results-postmortem"><h3>What went wrong</h3>
          <p>The mission did not meet its requirements. Check the Validation screen for the weakest margin.</p></div>`;
  }

  container.innerHTML = `
    <section class="results-banner ${ok ? "results-banner--ok" : "results-banner--fail"}" aria-labelledby="rb-title">
      <p class="results-kicker">MISSION RESULT</p>
      <h2 id="rb-title"><span aria-hidden="true">${ok ? "\u2714" : "\u2716"}</span> ${ok ? "MISSION COMPLETE" : "MISSION FAILED"}</h2>
      <div class="results-score">
        <span class="results-score-num">${ev.score}</span><span class="muted">/100</span>
        <span class="results-stars" role="img" aria-label="${ev.stars} of 5 stars">${starsText(ev.stars)}</span>
        <span class="results-rating">${esc(ev.ratingLabel)}</span>
        ${newBest ? '<span class="results-new">NEW BEST</span>' : ""}
      </div>
      ${ev.capped ? `<p class="muted">Score capped at ${FAILED_SCORE_CAP} because the mission failed.</p>` : ""}
      <p class="muted">Best score: ${Math.max(before.best, ev.score)}</p>
      <h3>Achievements</h3>
      ${achievementsHtml}
      ${postMortem}
      <div class="results-retry"></div>
    </section>`;

  renderRetryPanel(container.querySelector(".results-retry"), state);
}
