import { currentAccount } from "@/lib/server/session";
import { redirect } from "next/navigation";
import { DemoPicker } from "@/components/auth/DemoPicker";
import { demoEnabled, readStore } from "@/lib/server/demo-store";
export const metadata={title:"Explore the demo — VahakIN"};
export const dynamic="force-dynamic";
export default async function DemoPage(){
 if ((await currentAccount())?.mode !== "demo") redirect("/login/owner");
 const store=demoEnabled()?readStore():null;
 const recentApplicants=(store?.accounts??[]).filter(a=>a.demoDeviceId&&a.status==="Active").slice(-8).reverse().map(account=>{
  const application=store?.enrollment?.applications.filter(a=>a.ownerId===account.id).at(-1);
  return {id:account.id,name:application?.fields.fullName||"New owner",deviceId:account.demoDeviceId!,status:application?.status??"Draft"};
 });
 return <DemoPicker recentApplicants={recentApplicants}/>;
}
