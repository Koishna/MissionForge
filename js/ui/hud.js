const NAMES = [
  ["power", "Power"],
  ["fuel", "Fuel"],
  ["comms", "Comms"],
  ["thermal", "Thermal"],
  ["science", "Science"],
];
const WORD = { ok: "OK", low: "LOW", critical: "CRITICAL" };
const two = (n) => String(Math.floor(n)).padStart(2, "0");

export const formatMet = (s) =>
  `T+${two(s / 3600)}:${two((s % 3600) / 60)}:${two(s % 60)}`;
export const designSnapshot = (
  health,
  riskLevel,
  nextBeatPreview = "Launch",
) => ({
  phaseName: "Pre-flight",
  metSeconds: 0,
  health,
  riskLevel,
  nextBeatPreview,
});

function meterStatus(health, key) {
  const labels = {
    ok: "ok",
    low: "low",
    critical: "critical",
    nominal: "ok",
    warning: "low",
  };
  const given = labels[health.status?.[key]];
  if (given) return given;
  const value = Number(health[key]) || 0;
  return value <= 20 ? "critical" : value < 50 ? "low" : "ok";
}

export function meterHtml(health) {
  return NAMES.map(([k, label]) => {
    const status = meterStatus(health, k);
    return `<div class="meter ${status}">
      <span class="m-label">${label}</span><span class="m-num">${Math.round(Number(health[k]) || 0)}%</span><span class="m-word">${WORD[status]}</span>
      <div class="mbar"><span style="width:${health[k]}%"></span></div></div>`;
  }).join("");
}

export function renderHud(container, snap) {
  container.classList.add("hud");
  container.setAttribute("aria-live", "polite");
  const h = snap.health;
  container.innerHTML = `<div class="hud-top">
      <span class="hud-phase">${snap.phaseName}</span><span class="hud-clock">${formatMet(snap.metSeconds)}</span>
      <span class="hud-health ${h.overall >= 60 ? "ok" : h.overall >= 30 ? "low" : "critical"}">Mission health ${Math.round(Number(h.overall) || 0)}</span>
      <span class="hud-risk">Risk: ${snap.riskLevel || "n/a"}</span></div>
    <div class="hud-next">Next: ${snap.nextBeatPreview || "-"}</div>
    <div class="meters">${meterHtml(h)}</div>`;
}
