import { accountStore } from "@/lib/server/live-store";
import { redirect,notFound } from "next/navigation";
import { currentAccount } from "@/lib/server/session";
import { workspaceFor } from "@/lib/server/workspace";
import { navigation,can,portalFor } from "@/lib/permissions/access";
import { Dashboard } from "./Dashboard";
export async function WorkspacePage({params,portal}:{params:Promise<{section?:string[]}>;portal:"gov"|"owner"|"ops"}){
 const account=await currentAccount();if(!account)redirect(portal==="owner"?"/login/owner":"/login/government");
 if(portalFor(account)!==portal)redirect(`/${portalFor(account)}`);
 const {section}=await params;const sectionId=section?.[0]??"overview";
 if(portal==="owner" && sectionId!=="applications" && !(await accountStore(account)).vehicles.some(v=>v.ownerId===account.id && v.ownerVerified))redirect("/owner/onboarding");
 if(section&&section.length>1)notFound();const item=navigation.find(n=>n.id===sectionId);if(!item)notFound();
 if(!can(account,item.permission))return <main className="access-denied"><h1>This view is outside your permissions.</h1><p>Your role and jurisdiction remain unchanged.</p><a href={`/${portal}`}>Return to your workspace</a></main>;
 return <Dashboard key={`${account.id}:${sectionId}`} initialData={workspaceFor(account,new URLSearchParams(),await accountStore(account))} section={sectionId}/>;
}
