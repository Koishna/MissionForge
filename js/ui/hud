const NAMES = [['power', 'Power'], ['fuel', 'Fuel'], ['comms', 'Comms'], ['thermal', 'Thermal'], ['science', 'Science']];
const WORD = { ok: 'OK', low: 'LOW', critical: 'CRITICAL' };
const two = (n) => String(Math.floor(n)).padStart(2, '0');

export const formatMet = (s) => `T+${two(s / 3600)}:${two((s % 3600) / 60)}:${two(s % 60)}`;
export const designSnapshot = (health, riskLevel, nextBeatPreview = 'Launch') =>
  ({ phaseName: 'Pre-flight', metSeconds: 0, health, riskLevel, nextBeatPreview });

export function meterHtml(health) {
  return NAMES.map(([k, label]) => `<div class="meter ${health.status[k]}">
    <span class="m-label">${label}</span><span class="m-num">${health[k]}</span><span class="m-word">${WORD[health.status[k]]}</span>
    <div class="mbar"><span style="width:${health[k]}%"></span></div></div>`).join('');
}

export function renderHud(container, snap) {
  container.classList.add('hud');
  container.setAttribute('aria-live', 'polite');
  const h = snap.health;
  container.innerHTML = `<div class="hud-top">
      <span class="hud-phase">${snap.phaseName}</span><span class="hud-clock">${formatMet(snap.metSeconds)}</span>
      <span class="hud-health ${h.overall >= 60 ? 'ok' : h.overall >= 30 ? 'low' : 'critical'}">Mission health ${h.overall}</span>
      <span class="hud-risk">Risk: ${snap.riskLevel || 'n/a'}</span></div>
    <div class="hud-next">Next: ${snap.nextBeatPreview || '-'}</div>
    <div class="meters">${meterHtml(h)}</div>`;
}