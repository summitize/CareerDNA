export const landingFeatures = [
  "CareerDNA Assessment",
  "SWOT Analysis",
  "Career Match",
  "AI Career Mentor",
  "Parent Guidance",
  "Teacher Insights",
];

export const testimonials = [
  { name: "Aarav", role: "Student", quote: "I finally know what I am great at." },
  { name: "Rhea", role: "Parent", quote: "The report gave us a roadmap till graduation." },
  { name: "Ms. Kapoor", role: "Counsellor", quote: "Class-level analytics save hours every week." },
];

export const assessmentSections = [
  "Personality",
  "Interests",
  "Learning Style",
  "Multiple Intelligence",
  "Logical Ability",
  "Communication",
  "Leadership",
  "Emotional Intelligence",
  "AI Readiness",
  "Career Motivation",
];

export const assessmentQuestions = [
  {
    id: 1,
    section: "Personality",
    prompt: "I enjoy solving complex problems under pressure.",
    type: "Likert",
    options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"],
  },
  {
    id: 2,
    section: "Interests",
    prompt: "Which activity do you enjoy most?",
    type: "Multiple Choice",
    options: ["Coding", "Design", "Debating", "Building prototypes"],
  },
  {
    id: 3,
    section: "Logical Ability",
    prompt: "Rank these from easiest to hardest for you.",
    type: "Ranking",
    options: ["Math", "Reading", "Public speaking", "Team leadership"],
  },
  {
    id: 4,
    section: "AI Readiness",
    prompt: "A teammate uses AI to finish work faster. What do you do?",
    type: "Situational Judgement",
    options: ["Ignore", "Learn and collaborate", "Complain", "Copy blindly"],
  },
  {
    id: 5,
    section: "Career Motivation",
    prompt: "In one line, what impact do you want to create?",
    type: "Short Answer",
    options: [],
  },
];

export const careers = [
  {
    name: "Software Engineer",
    description: "Build digital products with scalable systems thinking.",
    eligibility: "PCM or equivalent analytical track",
    aiRisk: "Medium",
    futureDemand: "High",
    salaryIndia: "₹8L - ₹40L",
  },
  {
    name: "Product Designer",
    description: "Design inclusive experiences for apps and platforms.",
    eligibility: "Any stream + portfolio",
    aiRisk: "Low",
    futureDemand: "High",
    salaryIndia: "₹6L - ₹30L",
  },
  {
    name: "Clinical Psychologist",
    description: "Support emotional and mental wellbeing.",
    eligibility: "Psychology + masters",
    aiRisk: "Low",
    futureDemand: "High",
    salaryIndia: "₹5L - ₹20L",
  },
];
