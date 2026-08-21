// Builds data/assessment-v6.json from assessment-v5.json plus v6 additions:
// - Interest Explorer section (14 forced-choice questions)
// - 19 career clusters with JSON-driven competency signals
// - Career catalog with concrete roles, subjects, exams and first steps
// - Grade-aware guidance for grades 9-10 vs 11-12
// Run: node scripts/build-assessment-v6.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { INTEREST_QUESTIONS } from "./v6-interest-questions.mjs";
import { CAREER_CLUSTER_SIGNALS, CAREER_CATALOG } from "./v6-career-data.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const v5 = JSON.parse(readFileSync(join(root, "data", "assessment-v5.json"), "utf8"));

// Convert interest questions into full question-bank entries.
const interestQuestions = INTEREST_QUESTIONS.map((q) => ({
  id: q.id,
  section: "Interest Explorer",
  questionType: "Forced Choice",
  question: q.question,
  options: q.options,
  hiddenCompetencies: q.hiddenCompetencies,
  suggestedWeight: 3,
  whyItHelps: q.whyItHelps,
  optionIds: ["A", "B", "C", "D"],
  evidenceLevel: "preference",
  scored: true,
  optionMetadata: q.options.map((label, i) => ({
    optionId: ["A", "B", "C", "D"][i],
    label,
    scoringRole: "contextual preference",
  })),
  scoringClassification: "preferenceEvidence",
  optionScoring: {
    mode: "contextualPreference",
    note: "No option is better or worse; each maps to different interest signals.",
  },
  optionWeights: q.optionWeights,
}));

// ---- Question optimisation -------------------------------------------------
// v5/v6 over-measure a few competencies (Communication: 36 questions,
// Creativity: 28) while some cluster signals get only 1-2 measurements.
// The selector keeps every section, question type and career cluster
// intact while cutting the bank to ~88 questions:
//   1. Mandatory keeps: Interest Explorer, validity/reverse items (RV),
//      Ranking (ipsative), Ethics and School-life Scenario (unique types).
//   2. The 6 reflections with the widest competency spread.
//   3. A pre-pass lifting every career-cluster signal to >= 2 measures.
//   4. Greedy fill: pick the question reducing the most competency
//      deficits (target ~4 measurements per competency) until budget.
const TARGET_QUESTIONS = 88;
const MEASURES_PER_COMPETENCY = 4;

function questionCompetencies(q) {
  const set = new Set(q.hiddenCompetencies || []);
  Object.values(q.optionWeights || {}).forEach((w) =>
    Object.keys(w || {}).forEach((c) => set.add(c))
  );
  return set;
}

function optimiseQuestionBank(allQuestions, clusterSignalNames) {
  const isMandatory = (q) =>
    q.section === "Interest Explorer" ||
    q.section === "Validation & Reflective Evidence" ||
    q.questionType === "Ranking" ||
    q.questionType === "Ethics" ||
    q.questionType === "School-life Scenario";

  const mandatory = allQuestions.filter(isMandatory);
  const kept = new Set(mandatory);
  const counts = {};
  const tally = (q) => questionCompetencies(q).forEach((c) => { counts[c] = (counts[c] || 0) + 1; });
  mandatory.forEach(tally);

  // 2. Pick 6 reflections with the widest competency spread.
  const reflections = allQuestions
    .filter((q) => q.questionType === "Reflection" && !kept.has(q))
    .sort((a, b) => (b.suggestedWeight || 1) - (a.suggestedWeight || 1));
  const reflComps = new Set();
  for (const q of reflections) {
    if (kept.size - mandatory.length >= 6) break;
    const comps = q.hiddenCompetencies || [];
    if (comps.some((c) => !reflComps.has(c))) {
      kept.add(q);
      tally(q);
      comps.forEach((c) => reflComps.add(c));
    }
  }
  for (const q of reflections) {
    if (kept.size - mandatory.length >= 6) break;
    if (!kept.has(q)) { kept.add(q); tally(q); }
  }

  const pool = allQuestions.filter((q) => !kept.has(q) && q.scored !== false);

  // 3. Pre-pass: every cluster-signal competency measured at least twice.
  for (const signal of clusterSignalNames) {
    for (let need = 2 - (counts[signal] || 0); need > 0; need--) {
      let best = null, bestWeight = -1;
      for (const q of pool) {
        if (kept.has(q)) continue;
        if (!questionCompetencies(q).has(signal)) continue;
        const w = q.suggestedWeight || 1;
        if (w > bestWeight) { bestWeight = w; best = q; }
      }
      if (!best) break;
      kept.add(best);
      tally(best);
    }
  }

  // 4. Greedy deficit-coverage fill.
  while (kept.size < TARGET_QUESTIONS) {
    let best = null, bestScore = 0;
    for (const q of pool) {
      if (kept.has(q)) continue;
      let score = 0;
      questionCompetencies(q).forEach((c) => {
        score += Math.max(0, MEASURES_PER_COMPETENCY - (counts[c] || 0));
      });
      if (score === 0) continue;
      score += (q.suggestedWeight || 1) * 0.1;
      if (score > bestScore) { bestScore = score; best = q; }
    }
    if (!best) break;
    kept.add(best);
    tally(best);
  }

  // Preserve the original question order.
  return allQuestions.filter((q) => kept.has(q));
}

const fullQuestionBank = [...v5.questionBank, ...interestQuestions];
const clusterSignalNames = [
  ...new Set(Object.values(CAREER_CLUSTER_SIGNALS).flat().map((s) => s.name)),
];
const useFullBank = process.argv.includes("--full");
const selectedQuestions = useFullBank
  ? fullQuestionBank
  : optimiseQuestionBank(fullQuestionBank, clusterSignalNames);

// Coverage report
{
  const counts = {};
  selectedQuestions.forEach((q) => questionCompetencies(q).forEach((c) => { counts[c] = (counts[c] || 0) + 1; }));
  const measured = Object.keys(counts);
  const signalCounts = clusterSignalNames.map((n) => counts[n] || 0);
  const bySection = {};
  selectedQuestions.forEach((q) => { bySection[q.section] = (bySection[q.section] || 0) + 1; });
  console.log(`Selected ${selectedQuestions.length} questions (full bank: ${fullQuestionBank.length})`);
  console.log(`Competencies measured: ${measured.length}; min coverage: ${Math.min(...measured.map((m) => counts[m]))}; avg: ${(measured.reduce((a, m) => a + counts[m], 0) / measured.length).toFixed(1)}`);
  console.log(`Cluster-signal coverage — min: ${Math.min(...signalCounts)}, below 2: ${clusterSignalNames.filter((n) => (counts[n] || 0) < 2).join(", ") || "none"}`);
  console.log("Per section:", Object.entries(bySection).map(([s, n]) => `${s}:${n}`).join(", "));
}

const scoredCount = selectedQuestions.filter((q) => q.scored !== false).length;

function v6SectionsFrom(questions, v5Sections) {
  const counts = {};
  questions.forEach((q) => { counts[q.section] = (counts[q.section] || 0) + 1; });
  const sections = v5Sections
    .filter((s) => counts[s.sectionName])
    .map((s) => ({ ...s, questionCount: counts[s.sectionName] }));
  if (counts["Interest Explorer"]) {
    sections.push({ sectionId: "IX", sectionName: "Interest Explorer", questionCount: counts["Interest Explorer"] });
  }
  return sections;
}

const v6 = {
  ...v5,
  version: "6.0",
  status: "production-candidate",
  assessmentTitle: "Career Discovery Assessment for Grades 9-12",
  recommendedDurationMinutes: 30,
  totalQuestions: selectedQuestions.length,
  coreQuestions: scoredCount,
  optimisation: useFullBank
    ? "Full bank (no pruning). Build without --full for the optimised set."
    : "Coverage-optimised bank: every section, question type and career cluster retained; over-measured competencies trimmed to ~4 measurements each. Rebuild with --full for the complete 138-question bank.",
  assessmentPurpose:
    "To help students discover hidden strengths, behavioural tendencies, interests, thinking style, work style, motivation, leadership potential, entrepreneurial mindset, emotional intelligence, AI readiness and future career suitability — across an expanded set of 19 career clusters including sports, defence, agriculture, hospitality, architecture, finance and skilled trades.",
  sections: v6SectionsFrom(selectedQuestions, v5.sections),
  careerClusters: Object.keys(CAREER_CLUSTER_SIGNALS),
  careerClusterSignals: CAREER_CLUSTER_SIGNALS,
  careerCatalog: CAREER_CATALOG,
  gradeAwareGuidance: {
    grades9to10: {
      focus: "Broad exploration. Keep every stream open and collect real experiences before choosing subjects in Class 11.",
      actions: [
        "Try one taster activity per term from your top three clusters (club, online course, or project).",
        "Talk to one adult per month who works in a field that interests you.",
        "Keep a portfolio of projects, competitions and certificates.",
        "Do not lock a stream based on this report alone; revisit after Class 10 results.",
      ],
      message: "Your results are directions to explore, not decisions to make. Use Classes 9 and 10 to test ideas cheaply.",
    },
    grades11to12: {
      focus: "Convergence. Combine your stream with your top clusters to shortlist degrees, exams and first steps.",
      actions: [
        "Shortlist 2-3 careers from your top clusters and research their entrance exams and colleges.",
        "Start one deep project or internship aligned with your strongest cluster.",
        "Map required subjects and exams against your current stream; identify gaps early.",
        "Discuss the Parent/Counsellor Notes section with your family before finalising applications.",
      ],
      message: "Use your top clusters to choose degrees and exams deliberately — and remember adjacent clusters often hide the best-fit careers.",
    },
  },
  resultOutputGuidelines: {
    ...v5.resultOutputGuidelines,
    recommendedOutputSections: [
      ...v5.resultOutputGuidelines.recommendedOutputSections.filter((s) => s !== "Careers to Explore"),
      "Career Exploration Map",
      "Grade-specific Next Steps",
    ],
  },
};

v6.questionBank = selectedQuestions;

const outPath = join(root, "data", "assessment-v6.json");
writeFileSync(outPath, JSON.stringify(v6, null, 2), "utf8");
console.log(
  `Wrote ${outPath}: ${v6.totalQuestions} questions (${scoredCount} scored), ${v6.careerClusters.length} career clusters, ${Object.keys(CAREER_CATALOG).length} catalog entries`
);