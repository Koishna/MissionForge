const LABEL = {
  MEASURED: "Measured (analogue)",
  CALCULATED: "Calculated",
  PUBLISHED: "Published",
  TOOL: "NASA tool",
  ILLUSTRATIVE: "Illustrative",
};

export function badge(x) {
  if (!x || !x.provenance) return "";
  const src = (x.source || "").replace(/"/g, "&quot;");
  return `<span class="badge ${x.provenance}" title="${src}">${LABEL[x.provenance] || x.provenance}</span>`;
}
