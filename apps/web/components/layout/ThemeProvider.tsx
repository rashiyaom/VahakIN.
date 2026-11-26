"use client";
import { ThemeProvider as NextThemeProvider, useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return <button type="button" className={`theme-toggle ${className}`} disabled={!mounted}
    aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    title={dark ? "Light mode" : "Dark mode"}
    onClick={() => setTheme(dark ? "light" : "dark")}>
    {dark ? <Sun size={18} aria-hidden="true"/> : <Moon size={18} aria-hidden="true"/>}
  </button>;
}
function StandaloneToggle() {
  const pathname = usePathname();
  return pathname.startsWith("/login") || pathname === "/demo"
    ? <ThemeToggle className="theme-toggle-floating"/> : null;
}
export function ThemeProvider({children}: {children:ReactNode}) {
  return <NextThemeProvider attribute="data-theme" storageKey="vahakin-theme" defaultTheme="system" enableSystem>
    {children}<StandaloneToggle/>
  </NextThemeProvider>;
}
