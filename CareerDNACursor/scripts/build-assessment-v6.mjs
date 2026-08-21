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

const v6 = {
  ...v5,
  version: "6.0",
  status: "production-candidate",
  assessmentTitle: "Career Discovery Assessment for Grades 9-12",
  recommendedDurationMinutes: 45,
  totalQuestions: v5.totalQuestions + INTEREST_QUESTIONS.length,
  coreQuestions: v5.coreQuestions + INTEREST_QUESTIONS.length,
  assessmentPurpose:
    "To help students discover hidden strengths, behavioural tendencies, interests, thinking style, work style, motivation, leadership potential, entrepreneurial mindset, emotional intelligence, AI readiness and future career suitability — across an expanded set of 19 career clusters including sports, defence, agriculture, hospitality, architecture, finance and skilled trades.",
  sections: [
    ...v5.sections,
    { sectionId: "IX", sectionName: "Interest Explorer", questionCount: INTEREST_QUESTIONS.length },
  ],
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

v6.questionBank = [...v5.questionBank, ...interestQuestions];

const outPath = join(root, "data", "assessment-v6.json");
writeFileSync(outPath, JSON.stringify(v6, null, 2), "utf8");
console.log(
  `Wrote ${outPath}: ${v6.totalQuestions} questions, ${v6.careerClusters.length} career clusters, ${Object.keys(CAREER_CATALOG).length} catalog entries`
);