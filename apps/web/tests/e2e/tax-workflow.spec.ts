import { authenticateDemo } from "./demo-auth";
import { test,expect,type APIRequestContext } from "@playwright/test";
const origin=process.env.VAHAKIN_TEST_URL||"http://localhost:3000";
async function login(request:APIRequestContext,account:string){await authenticateDemo(request);const r=await request.post("/api/session",{headers:{Origin:origin},data:{mode:"demo",accountId:`demo-${account}`}});expect(r.status(),await r.text()).toBe(200);}
async function action(request:APIRequestContext,caseId:string,action:string,extra:Record<string,unknown>={}){return request.post("/api/tax",{headers:{Origin:origin},data:{caseId,action,requestId:crypto.randomUUID(),reason:"Reviewed the fictional evidence, applicable period and supporting context.",...extra}});}
async function save(request:APIRequestContext,caseId:string,name:string,extra:Record<string,unknown>={}){const r=await action(request,caseId,name,extra);expect(r.status(),await r.text()).toBe(200);return r.json();}
test("tax review reaches owner response, independent demo decision and idempotent reconciliation",async({request})=>{
 await login(request,"rto");let data=await(await request.get("/api/tax")).json();const c=data.cases.find((c:{vehicleId:string})=>c.vehicleId==="v-003");expect(c).toBeTruthy();const evidence=c.evidence.find((e:{classification:string})=>e.classification==="Unverified movement");expect(evidence).toBeTruthy();
 await save(request,c.id,"evidenceReview",{evidenceId:evidence.id,disposition:"Relied upon"});
 await login(request,"manager");const proposal=await save(request,c.id,"prepare",{ruleId:"DEMO-GJ-3-v1",periodStart:evidence.startAt.slice(0,10),periodEnd:evidence.endAt.slice(0,10),penalty:"18(1A)",evidenceIds:[evidence.id]});
 await login(request,"rto");expect((await action(request,c.id,"approve",{assessmentId:proposal.assessmentId})).status()).toBe(403);
 await save(request,c.id,"review",{assessmentId:proposal.assessmentId});await save(request,c.id,"disclose",{assessmentId:proposal.assessmentId});await save(request,c.id,"requestResponse");
 await login(request,"owner");data=await(await request.get("/api/tax")).json();expect(data.cases.find((x:{id:string})=>x.id===c.id).assessments[0].calculation.totalPaise).toBe(1800000);expect(data.ownerSummary.officialPayablePaise).toBe(0);
 const upload=await request.post("/api/tax",{headers:{Origin:origin},multipart:{caseId:c.id,file:{name:"demo-towing-receipt.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.4\nFictional towing receipt")}}});expect(upload.status(),await upload.text()).toBe(200);const doc=await upload.json();
 const response=await save(request,c.id,"respond",{kind:"Towing or repair",documentIds:[doc.id],reason:"The recorded movement may relate to towing. Please review my fictional supporting receipt."});expect(response.acknowledgementId).toMatch(/^ACK-/);
 await login(request,"officer");data=await(await request.get("/api/tax")).json();expect(data.cases.find((x:{id:string})=>x.id===c.id).responses.some((x:{id:string})=>x.id===response.acknowledgementId)).toBe(true);await save(request,c.id,"reviewResponse",{responseId:response.acknowledgementId});
 await login(request,"tax-authority");await save(request,c.id,"approve",{assessmentId:proposal.assessmentId});
 await login(request,"manager");const drafts=await Promise.all([action(request,c.id,"noticeDraft",{assessmentId:proposal.assessmentId}),action(request,c.id,"noticeDraft",{assessmentId:proposal.assessmentId})]);expect(drafts.map(r=>r.status()).sort()).toEqual([200,400]);const notice=await drafts.find(r=>r.status()===200)!.json();
 await login(request,"tax-authority");await save(request,c.id,"noticeIssue",{noticeId:notice.noticeId});const reference=`DEMO-RECEIPT-${Date.now()}`;const payments=await Promise.all([action(request,c.id,"reconcile",{noticeId:notice.noticeId,reference,amount:"6000"}),action(request,c.id,"reconcile",{noticeId:notice.noticeId,reference,amount:"6000"})]);for(const r of payments)expect(r.status(),await r.text()).toBe(200);
 for(const role of ["rto","state","national","auditor"]){await login(request,role);data=await(await request.get("/api/tax")).json();expect(data.summary.recoveredPaise).toBe(600000);expect(data.summary.officialRecoveredPaise).toBe(0);if(["state","national"].includes(role))expect(data.cases).toEqual([]);}
 for(const role of ["technical","technician"]){await login(request,role);expect((await request.get("/api/tax")).status()).toBe(403);expect((await request.get(`/api/tax/documents/${doc.id}`)).status()).toBe(404);}
 await login(request,"owner");data=await(await request.get("/api/tax")).json();expect(data.ownerSummary.payablePaise).toBe(1200000);expect(data.ownerSummary.officialPayablePaise).toBe(0);expect((await request.get(`/api/tax/documents/${doc.id}`)).status()).toBe(200);
});
test("tax screens reuse the dashboard and remain usable on mobile",async({page})=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await login(page.request,"rto");await page.goto("/gov/compliance");await expect(page.getByText("Tax Review queue",{exact:true})).toBeVisible();await expect(page.locator(".tax-case-detail")).toBeVisible();await page.screenshot({path:"/tmp/vahakin-tax-review.png",fullPage:false});
 await page.getByRole("tab",{name:"Financial assessment",exact:true}).click();await expect(page.getByText("Explore a preliminary scenario",{exact:true})).toBeVisible();
 await page.goto("/gov/revenue");await expect(page.locator(".heading-actions a")).toHaveAttribute("href",/\/api\/tax\?.*export=csv/);const refreshed=page.waitForResponse(r=>r.url().includes("/api/tax?")&&r.status()===200);await page.getByRole("button",{name:"Refresh workspace",exact:true}).click();await refreshed;await expect(page.locator(".tax-workspace .reference-summary .metrics-grid .metric-card")).toHaveCount(4);await expect(page.getByText("Estimated exposure",{exact:true}).first()).toBeVisible();await page.screenshot({path:"/tmp/vahakin-tax-revenue.png",fullPage:false});
 await login(page.request,"owner");await page.goto("/owner/compliance");await expect(page.getByRole("heading",{name:"Compliance & tax",exact:true})).toBeVisible();await page.getByRole("button",{name:"Share an explanation",exact:true}).click();await expect(page.locator(".tax-action-dialog")).toBeVisible();await page.keyboard.press("Escape");
 await page.setViewportSize({width:390,height:844});await page.reload();await expect(page.locator(".tax-case-detail")).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:"/tmp/vahakin-tax-owner-mobile.png",fullPage:false});
 await login(page.request,"state");await page.goto("/gov/tax-rules");await expect(page.getByRole("heading",{name:"Gujarat taxation rule registry"})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});

test("classification corrections require an independent reviewer and remain in office scope",async({request})=>{
 const post=(data:Record<string,unknown>)=>request.post("/api/workspace",{headers:{Origin:origin},data});
 await login(request,"operator");
 const fields={classification:"Goods carrier",ladenWeightKg:"12000",unladenWeightKg:"6000",seats:"2",permitCategory:"DEMO goods permit",certificate:"DEMO-CERT-REVIEW"};
 const draft=await post({action:"classify",vehicleId:"v-001",fields,text:"Corrected the fictional classification against the demo certificate."});expect(draft.status(),await draft.text()).toBe(200);
 let data=await(await request.get("/api/workspace")).json();const correction=data.classificationChanges.find((c:{vehicleId:string;status:string})=>c.vehicleId==="v-001"&&c.status==="Pending");expect(correction).toBeTruthy();
 expect((await post({action:"approveClassification",id:correction.id,text:"Trying to approve my own submitted correction."})).status()).toBe(403);
 expect((await post({action:"classify",vehicleId:"v-001",fields,text:"A duplicate pending correction should not be accepted."})).status()).toBe(409);
 await login(request,"auditor");expect((await post({action:"approveClassification",id:correction.id,text:"Auditors cannot approve classification changes."})).status()).toBe(403);
 await login(request,"rto");const approval=await post({action:"approveClassification",id:correction.id,text:"Independently checked the demo certificate and classification."});expect(approval.status(),await approval.text()).toBe(200);
 data=await(await request.get("/api/workspace")).json();expect(data.vehicles.find((v:{id:string})=>v.id==="v-001").taxProfile.verification).toBe("Verified in demo");expect(data.classificationChanges.find((c:{id:string})=>c.id===correction.id).approvedBy).toBe("demo-rto");
 expect((await post({action:"approveClassification",id:correction.id,text:"Duplicate approval cannot rewrite the approval history."})).status()).toBe(409);
});
