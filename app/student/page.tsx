import Link from "next/link";
import { CompetencyRadar } from "@/components/charts/radar-chart";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/features/dashboard/components/stat-card";

export default function StudentDashboardPage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Card className="bg-gradient-to-r from-blue-600 to-green-500 text-white">
        <h1 className="text-2xl font-semibold">Welcome back, Student 👋</h1>
        <p className="mt-2 text-sm text-blue-100">Complete your assessment to unlock your CareerDNA profile and roadmap.</p>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Assessment Progress" value="68%" />
        <StatCard label="CareerDNA Score" value="84" />
        <StatCard label="Reports Downloaded" value="3" />
        <StatCard label="Counselling Slots" value="2" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Competency Snapshot</h2>
          <div className="mt-4 max-w-md"><CompetencyRadar /></div>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Actions</h2>
          <div className="mt-4 grid gap-2 text-sm">
            <Link className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50" href="/assessment">Continue Assessment</Link>
            <Link className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50" href="/report">Download Report</Link>
            <Link className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50" href="/mentor">Ask AI Career Mentor</Link>
            <Link className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50" href="/careers">Explore Recommended Careers</Link>
          </div>
        </Card>
      </section>
    </main>
  );
}
