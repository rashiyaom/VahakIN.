import { ThemeProvider } from "@/components/layout/ThemeProvider";
import type { Metadata } from "next";
import "@/styles/globals.css";
import "@/styles/home-motion.css";
import "@/styles/dashboard-reference.css";
import "@/styles/tax-compliance.css";
import "@/styles/theme.css";
import "@/styles/enrollment.css";
import "@/styles/vahan-ai.css";
import { MotionProvider } from "@/components/layout/MotionProvider";

export const metadata: Metadata = {
  title: "VahanIN — Declared Non Use. Verified Compliance.",
  description:
    "GPS-based monitoring and regulatory decision-support prototype for vehicles officially declared Non Use (SFIC 2026 · PS000225).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--bg-ivory)] font-sans text-[var(--text-ink)] antialiased selection:bg-teal-600/20 selection:text-teal-900 dark:selection:text-teal-200">
        <ThemeProvider><MotionProvider>{children}</MotionProvider></ThemeProvider>
      </body>
    </html>
  );
}
