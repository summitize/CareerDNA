const LIKERT_VALUES = {
  "Strongly Disagree": 1,
  Disagree: 2,
  Neutral: 3,
  Agree: 4,
  "Strongly Agree": 5,
};

const CAREER_CLUSTER_MAP = {
  "Engineering & Technology": ["Logical Thinking", "Scientific Thinking", "Innovation", "Spatial Thinking", "Systems Thinking"],
  "Medicine & Health Sciences": ["Empathy", "Service Orientation", "Discipline", "Resilience", "Scientific Thinking"],
  "Business, Commerce & Entrepreneurship": ["Commercial Orientation", "Entrepreneurship", "Communication", "Risk Taking", "Decision Making"],
  "Design, Media & Creative Arts": ["Creativity", "Innovation", "Communication", "Adaptability"],
  "Law, Governance & Public Policy": ["Decision Making", "Communication", "Verbal Reasoning", "Integrity"],
  "Psychology, Counselling & Human Behaviour": ["Empathy", "Communication", "Social Awareness", "Self-awareness"],
  "Education, Training & Social Impact": ["Communication", "Empathy", "Service Orientation", "Leadership"],
  "Data, Research & Analytics": ["Analytical Thinking", "Research Orientation", "Logical Thinking", "Attention to Detail"],
  "AI, Digital & Future Technologies": ["AI Readiness", "Innovation", "Learning Agility", "Systems Thinking"],
  "Sustainability, Environment & Civic Innovation": ["Service Orientation", "Innovation", "Systems Thinking", "Future Orientation"],
  "Communication, Journalism & Humanities": ["Communication", "Verbal Reasoning", "Creativity", "Research Orientation"],
  "Operations, Management & Organisational Roles": ["Leadership", "Discipline", "Execution Reliability", "Decision Making"],
};

function getBand(score, bands) {
  if (score >= 80) return { band: "Exceptional", ...bands.Exceptional };
  if (score >= 60) return { band: "Strong", ...bands.Strong };
  if (score >= 40) return { band: "Developing", ...bands.Developing };
  return { band: "Emerging", ...bands.Emerging };
}

function normalizeCompetency(name) {
  return name.trim();
}

function scoreLikert(answer, weight, competencies, competencyTotals) {
  const value = LIKERT_VALUES[answer] ?? 3;
  const normalized = ((value - 1) / 4) * 100;
  competencies.forEach((comp) => {
    const key = normalizeCompetency(comp);
    if (!competencyTotals[key]) competencyTotals[key] = { total: 0, weight: 0 };
    competencyTotals[key].total += normalized * weight;
    competencyTotals[key].weight += weight;
  });
}

function scoreSingleChoice(answer, options, weight, competencies, competencyTotals) {
  const index = options.indexOf(answer);
  if (index < 0) return;
  const normalized = ((options.length - index) / options.length) * 100;
  competencies.forEach((comp, i) => {
    const key = normalizeCompetency(comp);
    if (!competencyTotals[key]) competencyTotals[key] = { total: 0, weight: 0 };
    const compWeight = weight * (1 + (competencies.length - 1 - i) * 0.1);
    competencyTotals[key].total += normalized * compWeight;
    competencyTotals[key].weight += compWeight;
  });
}

function scoreRanking(rankedOptions, weight, competencies, competencyTotals) {
  rankedOptions.forEach((option, rank) => {
    const normalized = ((rankedOptions.length - rank) / rankedOptions.length) * 100;
    competencies.forEach((comp) => {
      const key = normalizeCompetency(comp);
      if (!competencyTotals[key]) competencyTotals[key] = { total: 0, weight: 0 };
      competencyTotals[key].total += normalized * weight;
      competencyTotals[key].weight += weight;
    });
  });
}

function scoreReflection(text, weight, competencies, competencyTotals) {
  const wordCount = (text || "").trim().split(/\s+/).filter(Boolean).length;
  const normalized = Math.min(100, 30 + wordCount * 5);
  competencies.forEach((comp) => {
    const key = normalizeCompetency(comp);
    if (!competencyTotals[key]) competencyTotals[key] = { total: 0, weight: 0 };
    competencyTotals[key].total += normalized * weight * 0.5;
    competencyTotals[key].weight += weight * 0.5;
  });
}

function checkValidityFlags(responses, questions, startedAt, completedAt) {
  const flags = [];
  const likertAnswers = responses.filter((r) => {
    const q = questions.find((q) => q.id === r.questionId);
    return q && (q.questionType === "Likert Scale" || q.options?.includes("Strongly Agree"));
  });

  const extremePositive = likertAnswers.filter((r) => r.answer === "Strongly Agree").length;
  const neutral = likertAnswers.filter((r) => r.answer === "Neutral").length;

  if (likertAnswers.length > 0 && extremePositive / likertAnswers.length > 0.7) {
    flags.push("tooManyExtremePositiveResponses");
  }
  if (likertAnswers.length > 0 && neutral / likertAnswers.length > 0.6) {
    flags.push("tooManyNeutralResponses");
  }

  const durationMs = new Date(completedAt) - new Date(startedAt);
  const durationMinutes = durationMs / 60000;
  if (durationMinutes < 10) {
    flags.push("veryFastCompletion");
  }

  const reflectionResponses = responses.filter((r) => {
    const q = questions.find((q) => q.id === r.questionId);
    return q?.questionType === "Reflection";
  });
  const lowDetail = reflectionResponses.filter((r) => (r.answer || "").trim().split(/\s+/).length < 8);
  if (reflectionResponses.length > 0 && lowDetail.length / reflectionResponses.length > 0.5) {
    flags.push("lowReflectionDetail");
  }

  return flags;
}

function mapCareerClusters(competencyScores) {
  return Object.entries(CAREER_CLUSTER_MAP)
    .map(([cluster, comps]) => {
      const scores = comps
        .map((c) => competencyScores[c]?.score)
        .filter((s) => s !== undefined);
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return { cluster, matchScore: Math.round(avg) };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

function buildInsights(competencyScores, topStrengths) {
  const get = (name) => competencyScores[name]?.score ?? 0;

  const thinking = [
    { name: "Analytical Thinking", score: get("Analytical Thinking") },
    { name: "Creativity", score: get("Creativity") },
    { name: "Scientific Thinking", score: get("Scientific Thinking") },
    { name: "Logical Thinking", score: get("Logical Thinking") },
  ].sort((a, b) => b.score - a.score);

  const learning = [
    { name: "Learning Agility", score: get("Learning Agility") },
    { name: "Curiosity", score: get("Curiosity") },
    { name: "Adaptability", score: get("Adaptability") },
  ].sort((a, b) => b.score - a.score);

  const work = [
    { name: "Discipline", score: get("Discipline") },
    { name: "Execution Reliability", score: get("Execution Reliability") },
    { name: "Collaboration", score: get("Collaboration") },
  ].sort((a, b) => b.score - a.score);

  const motivation = [
    { name: "Curiosity", score: get("Curiosity") },
    { name: "Service Orientation", score: get("Service Orientation") },
    { name: "Future Orientation", score: get("Future Orientation") },
  ].sort((a, b) => b.score - a.score);

  const leadership = [
    { name: "Leadership", score: get("Leadership") },
    { name: "Communication", score: get("Communication") },
    { name: "Empathy", score: get("Empathy") },
  ].sort((a, b) => b.score - a.score);

  const future = [
    { name: "AI Readiness", score: get("AI Readiness") },
    { name: "Adaptability", score: get("Adaptability") },
    { name: "Learning Agility", score: get("Learning Agility") },
  ].sort((a, b) => b.score - a.score);

  return {
    topStrengths: topStrengths.slice(0, 5).map((s) => ({
      competency: s.name,
      score: s.score,
      band: s.band,
      summary: `Your responses show strong signals in ${s.name.toLowerCase()}.`,
    })),
    thinkingStyle: `Your responses suggest a ${thinking[0].name.toLowerCase()}-leaning approach, with supportive signals in ${thinking[1].name.toLowerCase()}.`,
    learningStyle: `You may learn best through approaches that support ${learning[0].name.toLowerCase()} and ${learning[1].name.toLowerCase()}.`,
    workStyle: `Your work style signals point toward ${work[0].name.toLowerCase()} combined with ${work[1].name.toLowerCase()}.`,
    motivationDrivers: motivation.slice(0, 3).map((m) => m.name),
    leadershipAndCollaborationStyle: `You show ${leadership[0].score >= 60 ? "positive" : "developing"} leadership signals, with strength in ${leadership[0].name.toLowerCase()} and ${leadership[1].name.toLowerCase()}.`,
    futureReadiness: {
      aiReadiness: get("AI Readiness"),
      adaptability: get("Adaptability"),
      summary: `Your future readiness is supported by ${future[0].name} (${future[0].score}) and ${future[1].name} (${future[1].score}).`,
    },
    developmentSuggestions: topStrengths
      .slice(-3)
      .reverse()
      .map((s) => `Consider building exposure and practice in ${s.name} through school projects and mentoring.`),
    parentCounsellorNotes:
      "These results support career exploration, not final career decisions. Discuss top strengths and suggested clusters with the student to plan next steps.",
  };
}

export function generateResult(assessment, student, responses, startedAt, completedAt) {
  const questions = assessment.questionBank.flat();
  const competencyTotals = {};

  responses.forEach((response) => {
    const question = questions.find((q) => q.id === response.questionId);
    if (!question) return;

    const { questionType, options, hiddenCompetencies, suggestedWeight } = question;
    const weight = suggestedWeight || 1;
    const competencies = hiddenCompetencies || [];

    if (questionType === "Likert Scale") {
      scoreLikert(response.answer, weight, competencies, competencyTotals);
    } else if (questionType === "Ranking" && Array.isArray(response.answer)) {
      scoreRanking(response.answer, weight, competencies, competencyTotals);
    } else if (questionType === "Reflection") {
      scoreReflection(response.answer, weight, competencies, competencyTotals);
    } else {
      scoreSingleChoice(response.answer, options, weight, competencies, competencyTotals);
    }
  });

  const competencyScores = {};
  Object.entries(competencyTotals).forEach(([name, data]) => {
    const score = data.weight > 0 ? Math.round(data.total / data.weight) : 0;
    const bandInfo = getBand(score, assessment.competencyBands);
    competencyScores[name] = { score, band: bandInfo.band, interpretation: bandInfo.interpretation };
  });

  const topStrengths = Object.entries(competencyScores)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.score - a.score);

  const careerClusters = mapCareerClusters(competencyScores);
  const validityFlags = checkValidityFlags(responses, questions, startedAt, completedAt);
  const insights = buildInsights(competencyScores, topStrengths);

  const durationMs = new Date(completedAt) - new Date(startedAt);

  return {
    assessmentTitle: assessment.assessmentTitle,
    assessmentVersion: assessment.version,
    completedAt,
    startedAt,
    durationMinutes: Math.round(durationMs / 60000),
    student,
    totalQuestionsAnswered: responses.length,
    responses,
    competencyScores,
    validityFlags: validityFlags.map((flag) => ({
      flag,
      description: assessment.validityFlags[flag] || flag,
    })),
    suggestedCareerClusters: careerClusters.slice(0, 5).map((c) => ({
      cluster: c.cluster,
      matchScore: c.matchScore,
      note: "These career clusters may be worth exploring based on your response patterns.",
    })),
    careersToExplore: careerClusters.slice(0, 3).flatMap((c) => [
      `${c.cluster} — explore related roles through internships, shadowing, or school projects`,
    ]),
    ...insights,
    resultGuidelines: {
      doNotGiveRigidCareerLabels: assessment.resultOutputGuidelines.doNotGiveRigidCareerLabels,
      preferredLanguage: assessment.resultOutputGuidelines.preferredLanguage,
    },
  };
}
