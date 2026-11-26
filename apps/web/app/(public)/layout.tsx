import React from "react";
import { FloatingPillNavbar } from "@/components/layout/FloatingPillNavbar";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-clip">
      <FloatingPillNavbar />
      <main>{children}</main>
    </div>
  );
}
