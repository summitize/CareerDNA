import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Hero } from "@/features/landing/components/hero";
import { landingFeatures, testimonials } from "@/lib/mock-data";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
      <Hero />

      <section className="grid gap-4 py-10 sm:grid-cols-2 lg:grid-cols-3">
        {landingFeatures.map((feature) => (
          <Card key={feature} className="card-hover">
            <h3 className="font-semibold text-slate-900">{feature}</h3>
            <p className="mt-2 text-sm text-slate-600">Insight-rich modules built for assessment, mentoring and planning.</p>
          </Card>
        ))}
      </section>

      <section className="py-10">
        <h2 className="text-2xl font-semibold">Role Experiences</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Student", "/student"],
            ["Counsellor", "/counsellor"],
            ["School Admin", "/school-admin"],
            ["Super Admin", "/admin"],
          ].map(([label, href]) => (
            <Link key={label} href={href} className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              {label} Dashboard
            </Link>
          ))}
        </div>
      </section>

      <section className="py-10">
        <h2 className="text-2xl font-semibold">Testimonials</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {testimonials.map((item) => (
            <Card key={item.name}>
              <p className="text-sm text-slate-600">“{item.quote}”</p>
              <p className="mt-3 font-semibold text-slate-900">{item.name}</p>
              <p className="text-xs text-slate-500">{item.role}</p>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
