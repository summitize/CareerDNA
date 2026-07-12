"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const quickPrompts = [
  "Why was Engineering suggested?",
  "Should I choose Commerce?",
  "Can AI replace this career?",
  "What skills should I learn next?",
];

export default function MentorPage() {
  const [messages, setMessages] = useState<string[]>(["Hi! I'm your AI Career Mentor."]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <Card>
        <h1 className="text-xl font-semibold">AI Career Mentor</h1>
        <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
          {messages.map((msg, i) => <p key={i}>{msg}</p>)}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <Button key={prompt} variant="secondary" onClick={() => setMessages((m) => [...m, `You: ${prompt}`, "Mentor: Great question — based on your profile, let's compare fit, growth, and skills roadmap."])}>
              {prompt}
            </Button>
          ))}
        </div>
      </Card>
    </main>
  );
}
