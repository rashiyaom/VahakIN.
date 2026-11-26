import { accountStore } from "@/lib/server/live-store";
import type { Metadata } from "next";
import { SplitLoginCard } from "@/components/auth/SplitLoginCard";
import { currentAccount } from "@/lib/server/session";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vehicle Owner Sign-in — VahakIN",
  description:
    "Verified vehicle owner sign-in to check Non-Use status, alerts, and location history.",
};

export default async function OwnerLoginPage() {
  const account = await currentAccount();
  if (account?.role === "vehicle_owner") redirect((await accountStore(account)).vehicles.some(v => v.ownerId === account.id && v.ownerVerified) ? "/owner" : "/owner/onboarding");
  return <SplitLoginCard portal="owner" />;
}
