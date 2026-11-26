import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { demoEnabled, readStore, withStoreTransaction } from "./demo-store";
import { authClient, supabaseConfigured } from "../supabase/server";
import { liveAccount } from "./live-store";
export const cookieName="vahakin_demo_v2";
export const tokenHash=(token:string)=>createHash("sha256").update(token).digest("hex");
export async function currentAccount(){
 const token=(await cookies()).get(cookieName)?.value;
 if(token&&demoEnabled()){const store=readStore();const session=store.sessions.find(s=>s.hash===tokenHash(token)&&s.expires>Date.now());const account=session&&store.accounts.find(a=>a.id===session.accountId&&a.status==="Active");if(account)return {...account,mode:"demo" as const};}
 if(!supabaseConfigured())return null;
 const {data,error}=await (await authClient()).auth.getUser();
 if(error||!data.user||!data.user.email_confirmed_at)return null;
 return liveAccount(data.user.id);
}
export function createSession(accountId:string){return withStoreTransaction(store=>{const account=store.accounts.find(a=>a.id===accountId&&a.status==="Active");if(!account)return null;const token=randomBytes(32).toString("hex");store.sessions=store.sessions.filter(s=>s.expires>Date.now());store.sessions.push({hash:tokenHash(token),accountId,expires:Date.now()+4*60*60*1000});return {account,token};});}
export function sameOrigin(request:Request){const origin=request.headers.get("origin");return origin!==null&&origin===new URL(request.url).origin;}
