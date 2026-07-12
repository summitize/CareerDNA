import { Card } from "@/components/ui/card";

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold">Super Admin Console</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          "Manage Schools",
          "Manage Students",
          "Manage Counsellors",
          "Question Bank",
          "Career Database",
          "Assessment Builder",
          "Pricing",
          "Subscriptions",
          "Analytics",
        ].map((item) => (
          <Card key={item} className="text-sm font-medium">{item}</Card>
        ))}
      </div>
    </main>
  );
}
