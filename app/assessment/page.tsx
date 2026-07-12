"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { assessmentQuestions } from "@/lib/mock-data";

const schema = z.object({ answers: z.record(z.string(), z.string().optional()) });
type FormValues = z.infer<typeof schema>;

const storageKey = "careerdna-assessment-v1";

export default function AssessmentPage() {
  const randomized = useMemo(() => [...assessmentQuestions].sort(() => Math.random() - 0.5), []);
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(45 * 60);
  const { register, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { answers: {} },
  });

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved) as FormValues;
      Object.entries(parsed.answers ?? {}).forEach(([key, value]) => setValue(`answers.${key}`, value));
    }
  }, [setValue]);

  const values = watch("answers");

  useEffect(() => {
    const id = setInterval(() => setSecondsLeft((x) => Math.max(x - 1, 0)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ answers: values }));
  }, [values]);

  const current = randomized[index];
  const progress = Math.round(((index + 1) / randomized.length) * 100);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8 sm:px-6">
      <Card>
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Question {index + 1} / {randomized.length}</span>
          <span>Timer: {Math.floor(secondsLeft / 60)}:{`${secondsLeft % 60}`.padStart(2, "0")}</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase text-blue-600">{current.section} · {current.type}</p>
        <h1 className="mt-2 text-lg font-semibold">{current.prompt}</h1>
        <div className="mt-4 space-y-2">
          {current.options.length > 0 ? current.options.map((option) => (
            <label key={option} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
              <input type="radio" value={option} {...register(`answers.${String(current.id)}`)} />
              <span className="text-sm">{option}</span>
            </label>
          )) : (
            <textarea className="w-full rounded-lg border border-slate-200 p-3 text-sm" placeholder="Write your reflection" {...register(`answers.${String(current.id)}`)} />
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setIndex((i) => Math.max(i - 1, 0))}>Previous</Button>
          <Button onClick={() => setIndex((i) => Math.min(i + 1, randomized.length - 1))}>Next</Button>
          <Button variant="ghost" onClick={() => localStorage.setItem(storageKey, JSON.stringify({ answers: values }))}>Save & Resume Later</Button>
        </div>
      </Card>
    </main>
  );
}
