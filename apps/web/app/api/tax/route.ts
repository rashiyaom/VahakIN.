import { NextResponse } from "next/server";
import { currentAccount, sameOrigin } from "@/lib/server/session";
import { readStore, withStoreTransaction } from "@/lib/server/demo-store";
import { applyTaxAction, attachDocument, taxCSV, taxProjection, taxAudit } from "@/lib/server/tax-service";
import { can } from "@/lib/permissions/access";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const error=(message:string,status=400)=>NextResponse.json({error:message},{status,headers:{"Cache-Control":"no-store"}});
export async function GET(request:Request){
 const account=await currentAccount();if(account?.mode==="live")return new Response(JSON.stringify({error:"Financial processing awaits verified rules and authority configuration."}),{status:403,headers:{"Content-Type":"application/json"}});if(!account)return error("Please sign in.",401);
 if(!can(account,"tax.assessment.read")&&!can(account,"tax.analytics.read")&&!can(account,"tax.rules.read"))return error("Financial access is not permitted for this account.",403);
 try{const url=new URL(request.url),data=taxProjection(readStore(),account,url.searchParams);
  if(url.searchParams.get("export")==="csv"){if(!can(account,"tax.reports.export"))return error("Financial export is not permitted.",403);withStoreTransaction(store=>taxAudit(store,account,"Financial report exported","Scoped DEMO report","Permission-checked export with applied jurisdiction filters"));return new Response(taxCSV(data),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="vahakin-DEMO-tax-report.csv"',"Cache-Control":"no-store"}});}
  return NextResponse.json(data,{headers:{"Cache-Control":"no-store"}});
 }catch(e){return error(e instanceof Error?e.message:"Unable to load tax workspace.",403);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return error("Invalid request origin.",403);const account=await currentAccount();if(account?.mode==="live")return new Response(JSON.stringify({error:"Financial processing awaits verified rules and authority configuration."}),{status:403,headers:{"Content-Type":"application/json"}});if(!account)return error("Please sign in.",401);
 try{
  if(request.headers.get("content-type")?.startsWith("multipart/form-data")){
   if(Number(request.headers.get("content-length"))>3*1024*1024)return error("Upload exceeds the 2 MB file limit.",413);
   const form=await request.formData(),file=form.get("file");if(!(file instanceof File))return error("Choose a PDF, PNG or JPEG.");if(file.size>2*1024*1024)return error("File exceeds 2 MB.",413);
   const buffer=Buffer.from(await file.arrayBuffer());const result=withStoreTransaction(store=>{const active=store.accounts.find(a=>a.id===account.id&&a.status==="Active");if(!active)throw new Error("Account access revoked.");return attachDocument(store,active,String(form.get("caseId")),file.name,file.type,buffer);});return NextResponse.json(result);
  }
  const raw=await request.text();if(raw.length>50000)return error("Request is too large.",413);const input=JSON.parse(raw);if(!input||typeof input!=="object"||Array.isArray(input))return error("Invalid request.");
  const result=withStoreTransaction(store=>{const active=store.accounts.find(a=>a.id===account.id&&a.status==="Active");if(!active)throw new Error("Account access revoked.");return applyTaxAction(store,active,input);});return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
 }catch(e){const message=e instanceof Error?e.message:"Unable to save.";return error(message,/permission|authorization|scope|authority|access|permitted/i.test(message)?403:400);}
}
