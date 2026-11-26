import { WorkspacePage } from "@/components/dashboard/WorkspacePage";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{section?:string[]}>}) {return <WorkspacePage params={params} portal="gov"/>;}
