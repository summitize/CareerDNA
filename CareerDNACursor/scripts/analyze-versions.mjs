// Compares v4/v5/v6 and finds redundancy inside the v6 question bank.
import { readFileSync } from "node:fs";

const load = (v) => JSON.parse(readFileSync(new URL(`../data/assessment-v${v}.json`, import.meta.url), "utf8"));
const versions = [4, 5, 6].map(load);

console.log("== VERSION OVERVIEW ==");
for (const a of versions) {
  const qs = a.questionBank.flat();
  const types = {};
  qs.forEach((q) => { types[q.questionType] = (types[q.questionType] || 0) + 1; });
  const comps = new Set(qs.flatMap((q) => q.hiddenCompetencies || []));
  Object.values(qs.flatMap((q) => Object.values(q.optionWeights || {}))).forEach((w) =>
    Object.keys(w || {}).forEach((c) => comps.add(c))
  );
  console.log(`\nV${a.version}: ${qs.length} questions, ${a.sections?.length || "?"} sections, ${Object.keys(types).length} types, ${comps.size} competencies measured`);
  console.log("  types:", Object.entries(types).map(([t, n]) => `${t}:${n}`).join(", "));
  const scored = qs.filter((q) => q.scored !== false).length;
  const weighted = qs.filter((q) => q.optionWeights).length;
  console.log(`  scored: ${scored}, optionWeighted: ${weighted}, reflections: ${types["Reflection"] || 0}`);
}

// Section-level comparison v5 vs v6
const [v5, v6] = [versions[1], versions[2]];
console.log("\n== SECTION COUNTS (v5 -> v6) ==");
for (const s of v6.sections) {
  const v5s = v5.sections.find((x) => x.sectionId === s.sectionId);
  const diff = v5s && v5s.questionCount !== s.questionCount ? ` (was ${v5s.questionCount})` : "";
  console.log(`  ${s.sectionId} ${s.sectionName}: ${s.questionCount}${diff}`);
}

// Redundancy analysis inside v6
const qs = v6.questionBank.flat();
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const tokens = (s) => new Set(norm(s).split(" ").filter((w) => w.length > 3 && !["your","you","would","most","what","which","when","have","with","this","that","they","them","often","about","something","someone"].includes(w)));
const jaccard = (a, b) => {
  let inter = 0;
  a.forEach((t) => { if (b.has(t)) inter++; });
  return inter / (a.size + b.size - inter || 1);
};

console.log("\n== NEAR-DUPLICATE QUESTION PAIRS (similarity >= 0.45) ==");
const tok = qs.map((q) => ({ q, t: tokens(q.question) }));
const seen = [];
for (let i = 0; i < tok.length; i++) {
  for (let j = i + 1; j < tok.length; j++) {
    const sim = jaccard(tok[i].t, tok[j].t);
    if (sim >= 0.45) seen.push({ sim: sim.toFixed(2), a: tok[i].q.id, b: tok[j].q.id, qa: tok[i].q.question.slice(0, 70), qb: tok[j].q.question.slice(0, 70) });
  }
}
seen.sort((x, y) => y.sim - x.sim).slice(0, 25).forEach((d) =>
  console.log(`  ${d.sim}  ${d.a} <-> ${d.b}\n      A: ${d.qa}\n      B: ${d.qb}`)
);
console.log(`  total pairs >= 0.45: ${seen.length}`);

// Competency measurement frequency: which competencies are over/under measured
console.log("\n== COMPETENCY MEASUREMENT FREQUENCY (v6, top 20) ==");
const freq = {};
qs.filter((q) => q.scored !== false).forEach((q) => {
  const set = new Set(q.hiddenCompetencies || []);
  Object.values(q.optionWeights || {}).forEach((w) => Object.keys(w || {}).forEach((c) => set.add(c)));
  set.forEach((c) => { freq[c] = (freq[c] || 0) + 1; });
});
Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([c, n]) => console.log(`  ${c}: ${n} questions`));

// Which career-cluster signal competencies are rarely measured
const signals = new Set(Object.values(v6.careerClusterSignals || {}).flat().map((s) => s.name));
const rare = [...signals].filter((s) => (freq[s] || 0) <= 2);
console.log("\n== CLUSTER-SIGNAL COMPETENCIES MEASURED <= 2 TIMES ==");
console.log(rare.length ? rare.map((r) => `${r}(${freq[r] || 0})`).join(", ") : "none");

// Weight distribution
const weights = {};
qs.filter((q) => q.scored !== false).forEach((q) => { const w = q.suggestedWeight || 1; weights[w] = (weights[w] || 0) + 1; });
console.log("\n== WEIGHT DISTRIBUTION ==", JSON.stringify(weights));