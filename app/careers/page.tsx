import { Card } from "@/components/ui/card";
import { careers } from "@/lib/mock-data";

export default function CareersPage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold">Career Database</h1>
      <p className="text-sm text-slate-600">Eligibility, demand, AI risk, salary benchmarks and pathways.</p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {careers.map((career) => (
          <Card key={career.name}>
            <h2 className="font-semibold">{career.name}</h2>
            <p className="mt-2 text-sm text-slate-600">{career.description}</p>
            <ul className="mt-3 space-y-1 text-xs text-slate-500">
              <li>Eligibility: {career.eligibility}</li>
              <li>Future Demand: {career.futureDemand}</li>
              <li>AI Risk: {career.aiRisk}</li>
              <li>Salary India: {career.salaryIndia}</li>
            </ul>
          </Card>
        ))}
      </div>
    </main>
  );
}
