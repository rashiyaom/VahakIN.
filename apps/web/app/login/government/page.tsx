import type { Metadata } from "next";
import { SplitLoginCard } from "@/components/auth/SplitLoginCard";

export const metadata: Metadata = {
  title: "RTO / Government Sign-in — VahakIN",
  description:
    "Invited RTO officer, manager, and administrator sign-in for VahakIN Non-Use monitoring.",
};

export default function GovernmentLoginPage() {
  return <SplitLoginCard portal="government" />;
}
