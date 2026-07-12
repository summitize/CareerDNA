"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type QuestionType = "Likert" | "Multiple Choice" | "Ranking" | "Situational Judgement" | "Short Answer";

type Question = {
  id: number;
  section: string;
  prompt: string;
  type: QuestionType;
  options: string[];
};

const assessmentQuestions: Question[] = [
  { id: 1, section: "Personality", prompt: "I enjoy solving difficult problems.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 2, section: "Personality", prompt: "I naturally take the lead in group activities.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 3, section: "Personality", prompt: "I remain calm under pressure.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 4, section: "Personality", prompt: "I complete tasks before deadlines.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 5, section: "Personality", prompt: "I enjoy creating new ideas.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 6, section: "Personality", prompt: "I like helping classmates.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 7, section: "Personality", prompt: "I recover quickly after setbacks.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 8, section: "Personality", prompt: "I enjoy healthy competition.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 9, section: "Personality", prompt: "I notice details others miss.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 10, section: "Personality", prompt: "I enjoy explaining concepts to others.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 11, section: "Personality", prompt: "I prefer facts over assumptions.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 12, section: "Personality", prompt: "I adapt quickly to change.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 13, section: "Personality", prompt: "I enjoy planning before acting.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 14, section: "Personality", prompt: "I accept constructive criticism positively.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 15, section: "Personality", prompt: "I enjoy learning independently.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 16, section: "Personality", prompt: "I am curious about how things work.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 17, section: "Personality", prompt: "I like taking responsibility.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 18, section: "Personality", prompt: "I think before making decisions.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 19, section: "Personality", prompt: "I keep promises I make.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 20, section: "Personality", prompt: "I enjoy improving existing processes.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 21, section: "Interests", prompt: "Building robots", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 22, section: "Interests", prompt: "Writing stories", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 23, section: "Interests", prompt: "Coding software", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 24, section: "Interests", prompt: "Teaching children", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 25, section: "Interests", prompt: "Running a business", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 26, section: "Interests", prompt: "Designing posters", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 27, section: "Interests", prompt: "Solving maths puzzles", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 28, section: "Interests", prompt: "Performing on stage", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 29, section: "Interests", prompt: "Conducting science experiments", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 30, section: "Interests", prompt: "Playing strategy games", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 31, section: "Interests", prompt: "Helping sick people", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 32, section: "Interests", prompt: "Travelling", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 33, section: "Interests", prompt: "Creating videos", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 34, section: "Interests", prompt: "Researching topics", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 35, section: "Interests", prompt: "Fixing gadgets", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 36, section: "Interests", prompt: "Working with animals", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 37, section: "Interests", prompt: "Debating", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 38, section: "Interests", prompt: "Managing events", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 39, section: "Interests", prompt: "Drawing", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 40, section: "Interests", prompt: "Protecting the environment", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 41, section: "Learning & Aptitude", prompt: "I enjoy logical reasoning.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 42, section: "Learning & Aptitude", prompt: "I am good at mental maths.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 43, section: "Learning & Aptitude", prompt: "I understand diagrams quickly.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 44, section: "Learning & Aptitude", prompt: "I can imagine 3D objects easily.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 45, section: "Learning & Aptitude", prompt: "I notice patterns fast.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 46, section: "Learning & Aptitude", prompt: "I remember facts easily.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 47, section: "Learning & Aptitude", prompt: "I understand people well.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 48, section: "Learning & Aptitude", prompt: "I like analysing data.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 49, section: "Learning & Aptitude", prompt: "I learn by doing.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 50, section: "Learning & Aptitude", prompt: "I like fixing problems.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 51, section: "Learning & Aptitude", prompt: "I ask why often.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 52, section: "Learning & Aptitude", prompt: "I think ahead before acting.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 53, section: "Learning & Aptitude", prompt: "I enjoy experiments.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 54, section: "Learning & Aptitude", prompt: "I like strategic planning.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 55, section: "Learning & Aptitude", prompt: "I enjoy reading about technology.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 56, section: "Learning & Aptitude", prompt: "I can compare two options carefully.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 57, section: "Learning & Aptitude", prompt: "I enjoy writing summaries.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 58, section: "Learning & Aptitude", prompt: "I can use spreadsheets or tables comfortably.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 59, section: "Learning & Aptitude", prompt: "I enjoy building models or prototypes.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 60, section: "Learning & Aptitude", prompt: "I like investigating causes of problems.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 61, section: "Situational Judgement", prompt: "A teammate does not contribute in a group task.", type: "Situational Judgement", options: ["Ignore it", "Complain later", "Discuss and redistribute work", "Do all the work yourself"] },
  { id: 62, section: "Situational Judgement", prompt: "Parents want Science but you like Design.", type: "Situational Judgement", options: ["Follow parents blindly", "Hide your opinion", "Explain your interest with examples", "Stop talking about it"] },
  { id: 63, section: "Situational Judgement", prompt: "You fail an important test.", type: "Situational Judgement", options: ["Give up", "Blame others", "Review mistakes and improve", "Avoid studying"] },
  { id: 64, section: "Situational Judgement", prompt: "Friends pressure you to copy homework.", type: "Situational Judgement", options: ["Copy", "Refuse and do it yourself", "Wait and see", "Ask someone else to copy"] },
  { id: 65, section: "Situational Judgement", prompt: "You must speak publicly tomorrow.", type: "Situational Judgement", options: ["Avoid it", "Practice and prepare", "Pretend to be sick", "Leave it to someone else"] },
  { id: 66, section: "Situational Judgement", prompt: "Two friends argue during a project.", type: "Situational Judgement", options: ["Take sides", "Ignore them", "Facilitate a calm discussion", "Cancel the project"] },
  { id: 67, section: "Situational Judgement", prompt: "Your plan changes at the last minute.", type: "Situational Judgement", options: ["Panic", "Adapt quickly", "Quit", "Blame the team"] },
  { id: 68, section: "Situational Judgement", prompt: "A teacher gives tough feedback on your work.", type: "Situational Judgement", options: ["Feel offended", "Ignore it", "Listen and improve", "Argue back"] },
  { id: 69, section: "Situational Judgement", prompt: "You have two deadlines on the same day.", type: "Situational Judgement", options: ["Do nothing", "Prioritize and plan", "Wait until last minute", "Ask to cancel both"] },
  { id: 70, section: "Situational Judgement", prompt: "Someone needs urgent help in class.", type: "Situational Judgement", options: ["Ignore", "Help if possible", "Laugh", "Walk away"] },
  { id: 71, section: "Career Values", prompt: "High income is important to me.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 72, section: "Career Values", prompt: "Job security is important to me.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 73, section: "Career Values", prompt: "Helping society is important to me.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 74, section: "Career Values", prompt: "Creativity matters to me.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
  { id: 75, section: "Career Values", prompt: "Learning continuously matters to me.", type: "Likert", options: ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"] },
];

const schema = z.object({
  student: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Enter a valid email"),
    mobile: z.string().min(8, "Enter a valid mobile number"),
    grade: z.enum(["9", "10", "11", "12"]),
  }),
  answers: z.record(z.string(), z.string().optional()),
});

type FormValues = z.infer<typeof schema>;

const storageKey = "careerdna-assessment-mvp";

export default function AssessmentPage() {
  const randomized = useMemo(() => [...assessmentQuestions], []);
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(30 * 60);
  const { register, watch, setValue, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      student: { firstName: "", lastName: "", email: "", mobile: "", grade: "9" },
      answers: {},
    },
  });

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved) as FormValues;
      Object.entries(parsed.student ?? {}).forEach(([key, value]) => setValue(`student.${key as keyof FormValues["student"]}`, String(value ?? "")));
      Object.entries(parsed.answers ?? {}).forEach(([key, value]) => setValue(`answers.${key}`, value));
    }
  }, [setValue]);

  const values = watch();

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(values));
  }, [values]);

  useEffect(() => {
    const id = window.setInterval(() => setSecondsLeft((x) => Math.max(x - 1, 0)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const current = randomized[index];
  const progress = Math.round(((index + 1) / randomized.length) * 100);

  const onSubmit = (data: FormValues) => {
    const payload = {
      student: data.student,
      assessment: {
        version: "1.0",
        submittedAt: new Date().toISOString(),
        questionCount: randomized.length,
      },
      answers: randomized.map((question) => ({
        questionId: question.id,
        section: question.section,
        prompt: question.prompt,
        type: question.type,
        answer: data.answers[String(question.id)] ?? null,
      })),
    };

    console.log("CareerDNA submission payload:", payload);
    alert("JSON ready. Next step: wire this to an API route and email/Supabase.");
  };

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-8 sm:px-6">
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span>Question {index + 1} / {randomized.length}</span>
          <span>Timer: {Math.floor(secondsLeft / 60)}:{`${secondsLeft % 60}`.padStart(2, "0")}</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </Card>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card className="space-y-4 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Student Information</p>
            <h1 className="mt-1 text-2xl font-semibold">CareerDNA™ Assessment</h1>
            <p className="mt-1 text-sm text-slate-600">Collect the student details first, then complete the questionnaire.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">
              First Name
              <input className="w-full rounded-lg border border-slate-200 p-3 text-sm" {...register("student.firstName")} />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Last Name
              <input className="w-full rounded-lg border border-slate-200 p-3 text-sm" {...register("student.lastName")} />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Email ID
              <input className="w-full rounded-lg border border-slate-200 p-3 text-sm" type="email" {...register("student.email")} />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Mobile Number
              <input className="w-full rounded-lg border border-slate-200 p-3 text-sm" {...register("student.mobile")} />
            </label>
            <label className="space-y-1 text-sm font-medium sm:col-span-2">
              Grade
              <select className="w-full rounded-lg border border-slate-200 p-3 text-sm" {...register("student.grade")}>
                <option value="9">9</option>
                <option value="10">10</option>
                <option value="11">11</option>
                <option value="12">12</option>
              </select>
            </label>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Questionnaire</p>
          <p className="text-sm text-slate-600">Section: {current.section} · Type: {current.type}</p>
          <h2 className="text-xl font-semibold">{current.prompt}</h2>

          <div className="space-y-2">
            {current.options.length > 0 ? current.options.map((option) => (
              <label key={option} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                <input type="radio" value={option} {...register(`answers.${String(current.id)}`)} />
                <span className="text-sm">{option}</span>
              </label>
            )) : (
              <textarea className="w-full rounded-lg border border-slate-200 p-3 text-sm" placeholder="Write your reflection" {...register(`answers.${String(current.id)}`)} />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setIndex((i) => Math.max(i - 1, 0))}>Previous</Button>
            <Button type="button" onClick={() => setIndex((i) => Math.min(i + 1, randomized.length - 1))}>Next</Button>
            <Button type="button" variant="ghost" onClick={() => localStorage.setItem(storageKey, JSON.stringify(values))}>Save & Resume Later</Button>
            <Button type="submit" className="ml-auto">Submit JSON</Button>
          </div>
        </Card>
      </form>
    </main>
  );
}
