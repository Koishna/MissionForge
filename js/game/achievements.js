const OPS = {
  ">": (a, b) => a > b,
  ">=": (a, b) => a >= b,
  "<": (a, b) => a < b,
  "<=": (a, b) => a <= b,
};

function metricValue(name, ctx) {
  const o = ctx.outcome || {};
  const m = o.margins || {};
  if (name === "survivedEvents") return o.survivedEvents;
  if (name === "reliability") return ctx.reliability;
  return m[name];
}

export function evaluateAchievements(ctx, defs) {
  const list = (ctx && (ctx.defs || defs)) || [];
  const outcome = ctx && ctx.outcome;
  if (!outcome) return [];
  return list
    .filter((a) => {
      if (a.requireSuccess && !outcome.success) return false;
      return (a.rules || []).every((r) => {
        const v = metricValue(r.metric, ctx);
        const op = OPS[r.op];
        return (
          typeof v === "number" && Number.isFinite(v) && op && op(v, r.value)
        );
      });
    })
    .map((a) => a.id);
}
