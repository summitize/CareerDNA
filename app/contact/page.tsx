import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";

export const metadata = {
  title: "Contact Us | CareerDNA",
  description: "Contact the CareerDNA team.",
};

export default function ContactPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-12 sm:px-6">
      <Card className="w-full p-6 sm:p-8">
        <p className="text-sm font-semibold text-blue-700">CareerDNA Support</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Contact Us</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Reach out for help with CareerDNA assessments, reports, or school access.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <a href="tel:9822320290" className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <Phone aria-hidden="true" className="size-5 text-blue-700" />
            <span>
              <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Phone</span>
              <span className="text-sm font-semibold text-slate-900">9822320290</span>
            </span>
          </a>
          <a href="mailto:sumeetboob@gmail.com" className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <Mail aria-hidden="true" className="size-5 text-blue-700" />
            <span>
              <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Email</span>
              <span className="text-sm font-semibold text-slate-900">sumeetboob@gmail.com</span>
            </span>
          </a>
        </div>

        <Link href="/" className="mt-8 inline-block text-sm font-medium text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          Back to CareerDNA
        </Link>
      </Card>
    </main>
  );
}