"use client";

import jsPDF from "jspdf";
import { CompetencyRadar } from "@/components/charts/radar-chart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function exportPdf() {
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.text("CareerDNA™ Report", 20, 20);
  doc.setFontSize(12);
  doc.text("Executive Summary: You show strong logical and creative ability.", 20, 35);
  doc.text("Top Careers: Software Engineer, Product Designer, Data Analyst", 20, 45);
  doc.save("careerdna-report.pdf");
}

export default function ReportPage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8 sm:px-6">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Professional CareerDNA Report</h1>
          <p className="text-sm text-slate-600">Executive summary, SWOT, career match and recommendations.</p>
        </div>
        <Button onClick={exportPdf}>Export PDF</Button>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Radar Chart</h2>
          <div className="mt-4 max-w-md"><CompetencyRadar /></div>
        </Card>
        <Card>
          <h2 className="font-semibold">SWOT Snapshot</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li><strong>Strengths:</strong> Analytical reasoning, curiosity, persistence</li>
            <li><strong>Weaknesses:</strong> Time management under stress</li>
            <li><strong>Opportunities:</strong> AI + product roles, hackathons</li>
            <li><strong>Threats:</strong> Inconsistent study routines</li>
          </ul>
        </Card>
      </section>
    </main>
  );
}
