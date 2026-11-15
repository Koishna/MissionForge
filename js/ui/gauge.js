const pct = (x) => Math.round(Math.max(0, Math.min(1, x)) * 100);

export function gaugeHtml({ value, low, high, label = 'Simulated success' }) {
  const v = pct(value), lo = pct(low), hi = pct(high);
  const text = `${label}: ${v}%, range ${lo} to ${hi}%`;
  return `<div class="gauge" role="img" aria-label="${text}">
    <div class="g-text"><strong>${v}%</strong> <span>${label}</span></div>
    <div class="g-track"><span class="g-range" style="left:${lo}%;width:${Math.max(1, hi - lo)}%"></span><span class="g-mark" style="left:${v}%"></span></div>
    <div class="g-note">range ${lo} to ${hi}% (95% interval)</div></div>`;
}
export function renderGauge(container, opts) { container.innerHTML = gaugeHtml(opts); }