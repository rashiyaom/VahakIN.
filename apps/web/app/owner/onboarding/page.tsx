import { startApplication } from "@/lib/server/enrollment";
import { accountStore, accountTransaction } from "@/lib/server/live-store";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/server/session";
import { portalFor } from "@/lib/permissions/access";
import { workspaceFor } from "@/lib/server/workspace";
import { Dashboard } from "@/components/dashboard/Dashboard";
export const dynamic = "force-dynamic";
export default async function OnboardingPage() {
  const account = await currentAccount();
  if (!account) redirect("/login/owner");
  if (account.role !== "vehicle_owner") redirect(`/${portalFor(account)}`);
  const store = await accountStore(account);
  if (!store.enrollment?.applications.some(a => a.ownerId === account.id)) await accountTransaction(account, current => startApplication(current, account));
  return <Dashboard initialData={workspaceFor(account, new URLSearchParams(),await accountStore(account))} section="onboarding"/>;
}
