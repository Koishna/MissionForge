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
export function renderDecisionCard(container, decision, onChoose = () => {}) {
  if (!container) return;
  const options = Array.isArray(decision?.options) ? decision.options : [];
  if (!options.length) {
    container.innerHTML = "<p>No decision options are available.</p>";
    return;
  }
  container.innerHTML = `<article class="decision-card"><h4>${esc(decision.prompt || "Choose the mission response")}</h4><div class="decision-options">${options.map((o, i) => `<section class="decision-option"><h5>${esc(o.label || `Option ${i + 1}`)}</h5><div class="decision-tradeoffs"><div><strong>Benefits</strong><ul>${(o.pros || []).map((x) => `<li>${esc(x)}</li>`).join("") || "<li>None listed</li>"}</ul></div><div><strong>Costs and risks</strong><ul>${(o.cons || []).map((x) => `<li>${esc(x)}</li>`).join("") || "<li>None listed</li>"}</ul></div></div><button type="button" data-option="${esc(o.id)}">Choose ${esc(o.label || `option ${i + 1}`)}</button></section>`).join("")}</div></article>`;
  container
    .querySelectorAll("button[data-option]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        onChoose(decision.id, b.dataset.option),
      ),
    );
  container.querySelector("button")?.focus();
}
