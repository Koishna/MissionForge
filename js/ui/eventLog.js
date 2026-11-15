const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c],
  );
export function renderEventLog(
  container,
  beats = [],
  formatMet = (s) => `T+${Math.floor((s || 0) / 60)}m`,
) {
  if (!container) return;
  container.setAttribute("aria-live", "polite");
  container.setAttribute("aria-relevant", "additions text");
  container.innerHTML = beats.length
    ? `<ol class="event-log">${beats.map((b) => `<li class="event-log-item" data-severity="${esc(b.severity || "info")}"><time>${esc(formatMet(Number(b.metSeconds) || 0))}</time><div><strong>${esc(b.title || b.phaseName || b.kind || "Mission update")}</strong><p>${esc(b.text || "")}</p></div></li>`).join("")}</ol>`
    : '<p class="event-log-empty">Mission events will appear here.</p>';
  container
    .querySelector(".event-log-item:last-child")
    ?.scrollIntoView?.({ block: "nearest" });
}
