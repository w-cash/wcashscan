const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyMiningSoftware } = require("../../lib/mining-software");
const { parseBlockFilters } = require("../api/lib/mining-software");
const hex = (text) => Buffer.from(text).toString("hex");
const fixtures = [
  [null, "missing"],
  ["", "unknown"],
  ["0", "missing"],
  ["zz", "missing"],
  ["00ff", "unknown"],
  [hex("/Wolf:v1.0.0/"), "wolf"],
  [hex("/Wcash:1.0.0/"), "wolf"],
  [hex("/ZEBRA:v6.0.0-rc.0/"), "unknown"],
  [hex("/zcashd:5.0.0/"), "unknown"],
  [hex("/Wolf:1.0.0/Zebra:6.0.0/"), "wolf"],
  ["0f09fa6930", "unknown"],
  [hex("Zebra pool"), "unknown"],
  [hex("/Wolf:1.0.0/"), "wolf"],
];
test("coinbase classifier handles byte boundaries, malformed data and contradictory markers", () => {
  for (const [value, expected] of fixtures)
    assert.equal(classifyMiningSoftware(value), expected, String(value));
});
test("block filters validate date, height, software, pool and sorting", () => {
  assert.deepEqual(
    parseBlockFilters({
      software: "wolf",
      from: "2026-09-01",
      to: "2026-09-01",
      min_height: "0",
    }),
    {
      software: "wolf",
      poolName: "all",
      order: "newest",
      start: 1788220800,
      end: 1788307200,
      min: 0,
      max: null,
      metrics: {},
    },
  );
  for (const q of [
    { software: "pretend" },
    { pool: "pretend" },
    { order: "fees" },
    { from: "2026-02-30" },
    { from: "2026-09-02", to: "2026-09-01" },
    { min_height: "5", max_height: "4" },
    { max_height: "1;DELETE" },
    { min_height: "-1" },
  ])
    assert.throws(() => parseBlockFilters(q));
});
module.exports = { fixtures };
