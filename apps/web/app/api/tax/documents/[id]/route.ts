import { currentAccount } from "@/lib/server/session";
import { readStore } from "@/lib/server/demo-store";
import { documentFor } from "@/lib/server/tax-service";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const account=await currentAccount();if(account?.mode==="live")return new Response(JSON.stringify({error:"Financial processing awaits verified rules and authority configuration."}),{status:403,headers:{"Content-Type":"application/json"}});if(!account)return new Response("Sign in required",{status:401});
 try{const {id}=await params,doc=documentFor(readStore(),account,id);return new Response(new Uint8Array(Buffer.from(doc.base64,"base64")),{headers:{"Content-Type":"application/octet-stream","Content-Disposition":`attachment; filename="${doc.name}"`,"X-Content-Type-Options":"nosniff","Cache-Control":"private, no-store","Content-Security-Policy":"sandbox"}});}catch{return new Response("Document not found in your authorized scope",{status:404});}
}
