"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { readSaved, saveDurable } from "@/lib/client-persistence";

const storageKey = "careerdna-theme";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = readSaved(storageKey);
    const useDarkTheme = savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", useDarkTheme);
    setIsDark(useDarkTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = !isDark;
    document.documentElement.classList.toggle("dark", nextTheme);
    saveDurable(storageKey, nextTheme ? "dark" : "light");
    setIsDark(nextTheme);
  }

  return (
    <button type="button" onClick={toggleTheme} className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label={isDark ? "Switch to day mode" : "Switch to night mode"} title={isDark ? "Switch to day mode" : "Switch to night mode"}>
      {isDark ? <Sun aria-hidden="true" className="size-4" /> : <Moon aria-hidden="true" className="size-4" />}
    </button>
  );
}