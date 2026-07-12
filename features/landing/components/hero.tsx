"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/constants";

export function Hero() {
  return (
    <section className="grid gap-8 py-12 md:grid-cols-2 md:items-center">
      <div className="space-y-4">
        <p className="text-sm font-semibold text-blue-600">Trusted by Schools</p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">{brand.hero}</h1>
        <p className="text-slate-600">A premium, gamified career intelligence platform for students, parents and educators.</p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg">Take Assessment</Button>
          <Button variant="secondary" size="lg">Book Counselling</Button>
          <Button variant="ghost" size="lg">See Sample Report</Button>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative min-h-64 rounded-3xl bg-gradient-to-br from-blue-500 via-green-500 to-amber-400 p-1"
      >
        <div className="h-full rounded-[22px] bg-white/90 p-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {["Career Match", "SWOT", "AI Mentor", "Roadmap"].map((item) => (
              <div key={item} className="rounded-xl bg-slate-100 p-4 text-center font-medium text-slate-700">{item}</div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
