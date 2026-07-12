import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { answers?: Record<string, string> };
  const answerCount = Object.keys(body.answers ?? {}).length;
  const weightedScore = Math.min(100, 50 + answerCount * 5);
  const confidenceScore = Math.max(60, 95 - Math.abs(12 - answerCount) * 2);
  const consistencyScore = Math.max(55, 90 - Math.max(0, 3 - answerCount) * 10);
  const randomAnswerFlag = answerCount < 3;

  return NextResponse.json({
    competencies: 20,
    weightedScore,
    confidenceScore,
    consistencyScore,
    randomAnswerFlag,
    profile: randomAnswerFlag ? "Exploring" : "Builder",
  });
}
