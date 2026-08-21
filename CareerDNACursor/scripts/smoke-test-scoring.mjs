// Smoke test: fabricate responses for v5 and v6 and verify scoring output.
import { readFileSync } from "node:fs";
import { generateResult } from "../js/scoring.js";

const root = new URL("..", import.meta.url);
const student = { firstName: "Test", lastName: "Student", email: "t@t.in", mobileNumber: "9876543210" };
const startedAt = new Date(Date.now() - 30 * 60000).toISOString();
const completedAt = new Date().toISOString();

function run(version) {
  const assessment = JSON.parse(readFileSync(new URL(`./data/assessment-v${version}.json`, root), "utf8"));
  const questions = assessment.questionBank.flat();
  // Answer "creative/design-leaning" to make cluster matching deterministic.
  const responses = questions.map((q) => {
    if (q.questionType === "Reflection") return { questionId: q.id, answer: "I enjoy making things and telling stories through my work and projects." };
    if (q.questionType === "Ranking") return { questionId: q.id, answer: q.options };
    const idx = q.options.findIndex((o) => /design|creat|draw|art|video|story/i.test(o));
    return { questionId: q.id, answer: q.options[idx >= 0 ? idx : 0] };
  });
  const result = generateResult(assessment, student, responses, startedAt, completedAt);
  console.log(`\n=== V${version} ===`);
  console.log("Top clusters:", result.suggestedCareerClusters.slice(0, 3).map((c) => `${c.cluster} (${c.matchScore})`).join(" | "));
  console.log("careersToExplore[0]:", result.careersToExplore[0]);
  if (result.careerExploration?.length) {
    console.log("careerExploration entries:", result.careerExploration.map((c) => `${c.cluster}: ${c.careers.length} careers`).join(" | "));
    console.log("sample career:", JSON.stringify(result.careerExploration[0].careers[0]));
  }
}

run(5);
run(6);
console.log("\nSmoke test OK");