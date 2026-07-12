import { Card } from "@/components/ui/card";

export default function CounsellorPage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold">Counsellor Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[
          "Search Students",
          "Assessment Status",
          "Completed Reports",
          "Meeting Notes",
          "Student Comparison",
          "Class Analysis",
          "Career Distribution",
          "Export Excel",
          "Export PDF",
        ].map((item) => (
          <Card key={item} className="card-hover text-sm font-medium">{item}</Card>
        ))}
      </div>
    </main>
  );
}
