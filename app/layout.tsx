import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "CareerDNA™",
  description: "Premium career assessment SaaS for students, parents, counsellors and schools.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-900 antialiased">
        <Providers>
          <div className="flex flex-1 flex-col">
            <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
              <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8" aria-label="Main navigation">
                <Link href="/" className="text-lg font-semibold text-slate-900">CareerDNA</Link>
                <div className="flex items-center gap-4 text-sm">
                  <Link href="/assessment" className="font-medium text-slate-700 hover:text-blue-700">Assessment</Link>
                  <Link href="/contact" className="font-medium text-slate-700 hover:text-blue-700">Contact Us</Link>
                  <ThemeToggle />
                </div>
              </nav>
            </header>
            <div className="flex-1">{children}</div>
            <footer className="border-t border-slate-200 bg-white">
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-5 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
                <p>Copyright {new Date().getFullYear()} Summitize. All rights reserved.</p>
                <ThemeToggle />
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
