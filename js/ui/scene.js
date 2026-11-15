export const SCENE_STATES = [
  "idle",
  "launch",
  "transfer",
  "insertion",
  "orbit",
  "science",
  "storm",
  "comms-lost",
  "warning",
  "success",
  "failure",
];

export const SCENE_LABELS = {
  idle: "Waiting on the launch pad",
  launch: "Launching",
  transfer: "On the way to the Moon",
  insertion: "Entering lunar orbit",
  orbit: "In lunar orbit",
  science: "Collecting science data",
  storm: "Solar storm: radiation rising",
  "comms-lost": "Communication link lost",
  warning: "Warning on board",
  success: "Mission complete",
  failure: "Mission lost",
};

export const sceneLabel = (name) => SCENE_LABELS[name] || SCENE_LABELS.idle;

const PHASE_STATE = {
  launch: "launch",
  separation: "launch",
  transfer: "transfer",
  insertion: "insertion",
  "orbit-insertion": "insertion",
  science: "science",
};

function phaseState(phaseId, resolved) {
  const s = PHASE_STATE[phaseId] || "idle";
  return resolved && s === "science" ? "orbit" : s;
}

function hazardState(id) {
  if (id.includes("storm")) return "storm";
  if (id.includes("comms")) return "comms-lost";
  return "warning";
}

export function sceneStateFor(beat) {
  if (!beat || typeof beat !== "object") return "idle";
  const id = String(beat.id || "").toLowerCase();
  if (beat.kind === "result")
    return beat.outcome === "lost" ? "failure" : "success";
  if (beat.kind === "phase") return phaseState(beat.phaseId, false);
  if (beat.kind === "decision") return hazardState(id);
  if (beat.kind === "event") {
    if (beat.severity === "info") return phaseState(beat.phaseId, false);
    if (beat.outcome === "lost")
      return id.includes("comms") ? "comms-lost" : "failure";
    if (beat.outcome === "ok" || beat.outcome === "recovered")
      return phaseState(beat.phaseId, true);
    return hazardState(id);
  }
  return "idle";
}

const MOON = { x: 650, y: 110, r: 46, ring: 78 };
const PATH_D = "M160,141 C280,30 480,22 576,104"; // Earth to the Moon's near side
const LINK_END = { x: 205, y: 262 }; // where the radio link meets Earth
const TRANSIT_STOP = 0.88; // end of the transfer
const NS = "http://www.w3.org/2000/svg";

function stars() {
  let seed = 7,
    out = "";
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 70; i++) {
    const x = (rnd() * 800).toFixed(0),
      y = (rnd() * 330).toFixed(0),
      r = (0.5 + rnd() * 1.1).toFixed(1);
    out += `<circle cx="${x}" cy="${y}" r="${r}" opacity="${(0.35 + rnd() * 0.55).toFixed(2)}"/>`;
  }
  return out;
}

const CRAFT_ART = `
  <g class="sc-craft-art" transform="scale(1.6)">
    <rect class="sc-panel" x="-3" y="-17" width="6" height="11" rx="1"/>
    <rect class="sc-panel" x="-3" y="6" width="6" height="11" rx="1"/>
    <rect class="sc-body" x="-8" y="-5" width="15" height="10" rx="2"/>
    <path class="sc-dish" d="M-8,0 L-14,-5 L-14,5 Z"/>
  </g>`;

function markup() {
  const streaks = [
    [60, 40, 330, 150],
    [50, 70, 420, 230],
    [90, 25, 520, 120],
    [40, 100, 300, 300],
    [120, 20, 640, 190],
    [70, 55, 560, 260],
  ]
    .map(
      ([x1, y1, x2, y2]) =>
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`,
    )
    .join("");
  return `
<svg viewBox="0 0 800 440" xmlns="${NS}" role="presentation" focusable="false">
  <defs>
    <radialGradient id="scEarth" cx="35%" cy="30%" r="80%">
      <stop offset="0" stop-color="#5fa5ec"/><stop offset="0.7" stop-color="#1f5fbf"/><stop offset="1" stop-color="#123a78"/>
    </radialGradient>
    <radialGradient id="scMoon" cx="35%" cy="30%" r="80%">
      <stop offset="0" stop-color="#e3dfd6"/><stop offset="1" stop-color="#8d897f"/>
    </radialGradient>
    <radialGradient id="scSun" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#ffd98a" stop-opacity="0.9"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect class="sc-bg" width="800" height="440"/>
  <g class="sc-stars">${stars()}</g>
  <g class="sc-world">
    <circle class="sc-sun" cx="40" cy="30" r="110" fill="url(#scSun)"/>
    <g class="sc-earth">
      <circle cx="120" cy="400" r="158" fill="none" stroke="#6fa3f5" stroke-opacity="0.25" stroke-width="8"/>
      <circle cx="120" cy="400" r="150" fill="url(#scEarth)"/>
      <path d="M40,300 q30,-20 60,-8 q10,22 -14,34 q-30,6 -46,-26z" fill="#3f9a63" opacity="0.8"/>
      <path d="M150,262 q26,-8 44,6 q-6,22 -30,20 q-18,-8 -14,-26z" fill="#3f9a63" opacity="0.8"/>
      <path d="M72,352 q40,-6 70,10 q-14,26 -54,22 q-22,-12 -16,-32z" fill="#3f9a63" opacity="0.7"/>
    </g>
    <path class="sc-guide" d="${PATH_D}"/>
    <path class="sc-trail" d="${PATH_D}"/>
    <g class="sc-moon">
      <circle class="sc-halo" cx="${MOON.x}" cy="${MOON.y}" r="${MOON.r + 12}"/>
      <circle class="sc-pulse" cx="${MOON.x}" cy="${MOON.y}" r="${MOON.r}"/>
      <circle cx="${MOON.x}" cy="${MOON.y}" r="${MOON.r}" fill="url(#scMoon)"/>
      <circle cx="${MOON.x - 14}" cy="${MOON.y - 10}" r="8" fill="#000" opacity="0.12"/>
      <circle cx="${MOON.x + 12}" cy="${MOON.y + 14}" r="11" fill="#000" opacity="0.1"/>
      <circle cx="${MOON.x + 16}" cy="${MOON.y - 18}" r="5" fill="#000" opacity="0.12"/>
    </g>
    <circle class="sc-ring" cx="${MOON.x}" cy="${MOON.y}" r="${MOON.ring}"/>
    <g class="sc-orbiter">
      <g transform="translate(${MOON.x - MOON.ring} ${MOON.y})">
        <line class="sc-beam" x1="0" y1="0" x2="${MOON.ring - MOON.r}" y2="0"/>
        ${CRAFT_ART}
      </g>
    </g>
    <line class="sc-link" x1="0" y1="0" x2="0" y2="0"/>
    <g transform="translate(150 253)">
      <g class="sc-rocket">
        <g transform="scale(1.7)">
          <path class="sc-flame" d="M-4,0 Q0,24 4,0 Z"/>
          <path class="sc-fin" d="M-6,-5 L-13,4 L-6,0 Z M6,-5 L13,4 L6,0 Z"/>
          <path class="sc-rbody" d="M-6,0 L-6,-24 Q0,-40 6,-24 L6,0 Z"/>
        </g>
      </g>
    </g>
    <g class="sc-craft">${CRAFT_ART}</g>
    <g class="sc-storm">${streaks}</g>
  </g>
  <rect class="sc-frame" x="3" y="3" width="794" height="434" rx="8"/>
</svg>`;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Builds the scene inside `container` and returns its root element. */
export function createScene(container) {
  const root = document.createElement("div");
  root.className = "scene";
  root.innerHTML = `${markup()}
    <div class="scene-caption"><span class="scene-dot" aria-hidden="true"></span><span class="scene-label"></span></div>`;
  container.appendChild(root);
  const q = (s) => root.querySelector(s);
  const path = q(".sc-trail");
  root.__scene = {
    path,
    craft: q(".sc-craft"),
    link: q(".sc-link"),
    label: q(".scene-label"),
    length: path.getTotalLength ? path.getTotalLength() : 0,
    progress: 0,
    raf: 0,
    token: 0,
  };
  path.style.strokeDasharray = "0 9999";
  setSceneState(root, "idle");
  return root;
}

function setProgress(root, p) {
  const c = root.__scene;
  c.progress = p;
  if (!c.length) return;
  const at = c.length * p;
  const a = c.path.getPointAtLength(at),
    b = c.path.getPointAtLength(Math.min(c.length, at + 1));
  const deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  c.craft.setAttribute(
    "transform",
    `translate(${a.x.toFixed(1)} ${a.y.toFixed(1)}) rotate(${deg.toFixed(1)})`,
  );
  c.path.style.strokeDasharray = `${at.toFixed(1)} 9999`;
  if (root.dataset.stage === "transit") {
    c.link.setAttribute("x1", a.x.toFixed(1));
    c.link.setAttribute("y1", a.y.toFixed(1));
    c.link.setAttribute("x2", LINK_END.x);
    c.link.setAttribute("y2", LINK_END.y);
  }
}

function setStage(root, stage) {
  root.dataset.stage = stage;
  const l = root.__scene.link;
  if (stage === "orbit") {
    l.setAttribute("x1", MOON.x - MOON.ring + 6);
    l.setAttribute("y1", MOON.y + 22);
    l.setAttribute("x2", LINK_END.x);
    l.setAttribute("y2", LINK_END.y);
  }
}

function moveTo(root, target, ms, done) {
  const c = root.__scene,
    token = ++c.token;
  cancelAnimationFrame(c.raf);
  if (prefersReducedMotion() || ms <= 0) {
    setProgress(root, target);
    if (done) done();
    return;
  }
  const from = c.progress,
    t0 = performance.now();
  const tick = (now) => {
    if (token !== c.token) return; // a newer state took over
    const t = Math.min(1, (now - t0) / ms);
    setProgress(root, from + (target - from) * ease(t));
    if (t < 1) c.raf = requestAnimationFrame(tick);
    else if (done) done();
  };
  c.raf = requestAnimationFrame(tick);
}

export function setSceneState(root, name) {
  if (!root || !root.__scene) return;
  const state = SCENE_STATES.includes(name) ? name : "idle";
  const c = root.__scene,
    stage = root.dataset.stage || "pad";
  root.dataset.state = state;
  c.label.textContent = sceneLabel(state);
  root.setAttribute("role", "img");
  root.setAttribute("aria-label", `Mission scene: ${sceneLabel(state)}`);

  if (state === "idle") {
    c.token++;
    cancelAnimationFrame(c.raf);
    setStage(root, "pad");
    setProgress(root, 0);
  } else if (state === "launch") {
    c.token++;
    cancelAnimationFrame(c.raf);
    setStage(root, "launch");
    setProgress(root, 0);
  } else if (state === "transfer") {
    if (stage === "pad" || stage === "launch") {
      setStage(root, "transit");
      setProgress(root, 0);
    }
    if (stage !== "orbit") moveTo(root, TRANSIT_STOP, 3400);
  } else if (state === "insertion") {
    if (stage === "pad" || stage === "launch") {
      setStage(root, "transit");
      setProgress(root, TRANSIT_STOP);
    }
    if (stage !== "orbit") moveTo(root, 1, 900, () => setStage(root, "orbit"));
  } else if (state === "orbit" || state === "science") {
    c.token++;
    cancelAnimationFrame(c.raf);
    setProgress(root, 1);
    setStage(root, "orbit");
  }
}

export function showBeat(root, beat) {
  const s = sceneStateFor(beat);
  setSceneState(root, s);
  return s;
}

export function destroyScene(root) {
  if (!root || !root.__scene) return;
  root.__scene.token++;
  cancelAnimationFrame(root.__scene.raf);
}
