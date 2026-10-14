// Version 1: public coinbase observations, never authenticated client identity.
// Kept dependency-free so block details and the API use the same interpretation.
const SOFTWARE_LABELS = {
  wolf: "Wolf",
  other: "Other W.cash miner",
  unknown: "No software tag",
  conflicting: "Multiple software tags",
  missing: "Tag data unavailable",
};
function classifyMiningSoftware(hex) {
  // The indexer stores optional coinbase data, excluding the encoded height.
  // An empty string is an observed absence of tags, not missing data.
  if (hex === "") return "unknown";
  if (
    typeof hex !== "string" ||
    !hex ||
    hex.length % 2 ||
    !/^[0-9a-f]+$/i.test(hex)
  )
    return "missing";
  const bytes = hex.toLowerCase().match(/../g);
  const text = bytes.map((b) => String.fromCharCode(parseInt(b, 16))).join("");
  const marked = new Set();
  // W.cash does not inherit the upstream miner taxonomy. Wolf/Wcash tags are
  // accepted as observations; any other marker stays Other/Unknown.
  for (const match of text.matchAll(
    /(?=\/(wolf|wcash)[: ]?v?\d+\.\d+(?:\.\d+)?(?:-[a-z0-9.]+)?\/)/gi,
  ))
    marked.add("wolf");
  return marked.size > 1
    ? "conflicting"
    : marked.values().next().value || "unknown";
}
module.exports = { SOFTWARE_LABELS, classifyMiningSoftware };
