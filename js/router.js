const screens = {};
export function register(name, label, render) {
  screens[name] = { label, render };
}
export function startRouter(app, nav, state) {
  nav.innerHTML = Object.entries(screens)
    .map(([k, s]) => `<a href="#${k}" data-k="${k}">${s.label}</a>`)
    .join("");
  const go = () => {
    const k = (location.hash || "#briefing").slice(1);
    const name = screens[k] ? k : "briefing";
    nav
      .querySelectorAll("a")
      .forEach((a) => a.classList.toggle("active", a.dataset.k === name));
    app.innerHTML = "";
    screens[name].render(app, state);
  };
  window.addEventListener("hashchange", go);
  go();
}
