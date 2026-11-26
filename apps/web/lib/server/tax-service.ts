import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { can, inJurisdiction, permissionsFor, type Account } from "../permissions/access";
import type { DemoEvent, DemoStore, Investigation, Vehicle } from "./demo-store";
import { calculateTax, money, overlaps, parsePaise } from "../tax/calculator";
import type { Assessment, MovementEvidence, TaxPermission, TaxRule, TaxState } from "../tax/types";

export const legalSources=[
 {title:"Gujarat Motor Vehicles Tax Act, 1958",url:"https://www.indiacode.nic.in/bitstream/123456789/4580/1/motorvehiclestaxact.pdf",provisions:"Sections 3(1), 3(2), 18(1A), 18(1B), 14",status:"Pending legal verification",note:"Source supplied. Current amendments, rate notifications, competent-authority appointments and procedures have not been verified."},
 {title:"Motor Vehicles Tax Rules, 1959 — Gujarat",url:"https://upload.indiacode.nic.in/showfile?actid=AC_GJ_66_317_00005_00005_1543661645124&filename=bombay_motor_vehicle_tax_rules-1959.pdf&type=rule",provisions:"Rule 5 and Form NT",status:"Pending legal verification",note:"Submission, admission and certification must be distinguished. No response or appeal deadline is assumed."},
];
const timestamp=()=>new Date().toISOString();
const id=(prefix:string)=>`${prefix}-${randomUUID()}`;
export const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const aggregate=(a:Account)=>a.role==="national_admin"||a.role==="state_admin";
const technical=(a:Account)=>a.role==="technical_admin"||a.role==="device_technician";
export function integrationMode(account?:Account){if(account?.mode==="demo")return "DEMO";const mode=process.env.TRANSPORT_RECORDS_MODE??"DEMO";return mode==="DEMO"?"DEMO":mode==="MANUAL"?"MANUAL":"OFFICIAL";}
export function ensureTaxState(store:DemoStore):TaxState {
 if(store.tax)return store.tax;
 const now=timestamp();const rules:TaxRule[]=[];
 for(const [i,category] of ["Goods carrier","Passenger bus","Light commercial"].entries()){
  const common={version:1,state:"Gujarat",office:"GJ-03",category,provision:"Sections 3(1), 3(2), 18(1A), 18(1B)",sourceUrl:legalSources[0].url,effectiveFrom:"2026-01-01",effectiveTo:"2027-12-31",unit:"assessable period" as const,conditions:"Applicable classification and assessable period require authorized review.",exemptions:"No exemption or adjustment assumed.",rounding:"integer paise" as const,createdBy:"system-demo-fixture",createdAt:now};
  rules.push({...common,id:`DEMO-GJ-${i+1}-v1`,mode:"DEMO",status:"Active",title:`Illustrative ${category.toLowerCase()} scenario`,ratePaise:600000,method:"fixed_period",schedule:"Demonstration only — not a tax schedule",notification:null,verifiedBy:"DEMO fixture",approvedBy:"DEMO fixture"});
  rules.push({...common,id:`GJ-${i+1}-pending`,mode:"OFFICIAL",status:"Pending verification",title:`Gujarat ${category.toLowerCase()} — verification required`,ratePaise:null,method:"unverified",schedule:"Unverified",notification:null,verifiedBy:null,approvedBy:null});
 }
 store.tax={version:1,rules,evidence:[],assessments:[],responses:[],documents:[],notices:[],payments:[],appeals:[],authorizations:[],audit:[],requests:[]};
 // Separate fictional account: platform RTO administrators receive no statutory powers.
 const authority:Account={id:"demo-tax-authority",name:"Vivek Rao",role:"rto_admin",designation:"Simulated Taxation Authority",employeeId:"DEMO-TA-001",email:"authority@vahakin.example",state:"Gujarat",office:"GJ-03",status:"Active",assignedVehicleIds:[],additionalPermissions:["tax.assessment.approve","tax.notice.issue","tax.payment.reconcile"]};
 if(!store.accounts.some(a=>a.id===authority.id))store.accounts.push(authority);
 store.tax.authorizations.push({id:"DEMO-GJ03-AUTHORITY",accountId:authority.id,state:"Gujarat",office:"GJ-03",actions:["tax.assessment.approve","tax.notice.issue","tax.payment.reconcile"],mode:"DEMO",reference:"Explicit synthetic fixture — no statutory appointment",verifiedBy:"system-demo-fixture",validFrom:"2026-01-01",validTo:"2027-12-31",revokedAt:null});
 for(const v of store.vehicles)if(!v.taxProfile)v.taxProfile={verification:"Pending",classification:v.category,ladenWeightKg:null,unladenWeightKg:null,seats:null,permitCategory:null,certificate:null,declarationStage:v.declarationStatus==="Pending verification"?"Submitted":"Unverified",certifiedFrom:null,certifiedTo:null};
 // An explicit synthetic route for the existing demo investigation, never a live observation.
 const v=store.vehicles.find(v=>v.id==="v-003");
 if(v?.parkingLat!=null&&v.parkingLng!=null){
  const base=Date.now()-12*60000;
  const samples=[0,1].map((i):DemoEvent=>({id:`TAX-DEMO-ROUTE-${i}`,vehicleId:v.id,deviceId:v.deviceId,eventAt:new Date(base+i*4*60000).toISOString(),gpsAt:new Date(base+i*4*60000).toISOString(),receivedAt:now,processedAt:now,lat:v.parkingLat!+i*.006,lng:v.parkingLng!,accuracy:8,speed:i?18:0,battery:80,motion:i?"Moving":"Stationary",tamper:false,source:"SIMULATOR",ruleVersion:"demo-tax-evidence-v1"}));
  const events=store.events??(store.events=[]);for(const e of samples)if(!events.some(x=>x.id===e.id))events.push(e);
 }
 return store.tax;
}
function meters(a:number,b:number,c:number,d:number){const r=Math.PI/180,x=Math.sin((c-a)*r/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin((d-b)*r/2)**2;return Math.round(6371000*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x)));}
export function taxAudit(store:DemoStore,actor:Account,action:string,entity:string,reason:string,vehicle?:Vehicle){
 const tax=ensureTaxState(store);const previousHash=tax.audit.at(-1)?.hash??"GENESIS";
 const entry={id:id("TAX-AUD"),actor:actor.id,action,entity,reason,at:timestamp(),state:vehicle?.state??actor.state,office:vehicle?.office??actor.office,previousHash,mode:"DEMO" as const};
 tax.audit.push({...entry,hash:hash(entry)});
}
function history(c:Investigation,actor:string,action:string,reason:string,disclosed=false){c.tax!.history.push({id:id("HIST"),at:timestamp(),actor,action,reason,disclosed});}
export function syncTaxEvidence(store:DemoStore){
 const tax=ensureTaxState(store);
 for(const event of store.events??[]){
  if(tax.evidence.some(e=>e.id===`EVID-${event.id}`))continue;
  const v=store.vehicles.find(v=>v.id===event.vehicleId);if(!v)continue;
  const quality=event.lat!==null&&event.lng!==null&&event.accuracy!==null&&event.accuracy<=30&&!!event.gpsAt;
  const previous=(store.events??[]).filter(e=>e.vehicleId===v.id&&e.eventAt<event.eventAt&&e.lat!==null&&e.lng!==null&&e.accuracy!==null&&e.accuracy<=30).sort((a,b)=>b.eventAt.localeCompare(a.eventAt))[0];
  const contiguous=previous&&Date.parse(event.eventAt)-Date.parse(previous.eventAt)<=10*60000;
  const route=quality?[...(contiguous?[{lat:previous.lat!,lng:previous.lng!,at:previous.gpsAt??previous.eventAt,accuracy:previous.accuracy!}]:[]),{lat:event.lat!,lng:event.lng!,at:event.gpsAt!,accuracy:event.accuracy!}]:[];
  const displacement=route.length===2?meters(route[0].lat,route[0].lng,route[1].lat,route[1].lng):null;
  const outside=quality&&v.parkingLat!=null&&v.parkingLng!=null&&meters(v.parkingLat,v.parkingLng,event.lat!,event.lng!)>150+event.accuracy!;
  const permission=store.requests.find(r=>r.vehicleId===v.id&&r.status==="Authorized in demo"&&r.authorization?.mode==="DEMO"&&r.authorization.conditionsVerified&&r.authorization.validFrom<=event.eventAt&&r.authorization.validTo>=event.eventAt);
  const credible=quality&&outside&&event.motion==="Moving";
  const classification:MovementEvidence["classification"]=event.tamper?"Device tampering":!quality?(event.lat!==null?"Suspected GPS drift":"Insufficient telemetry"):permission?"Authorized movement":credible?"Unverified movement":"Normal stationary activity";
  const observed=displacement!==null?`Two recorded GPS points are approximately ${displacement} metres apart over ${Math.round((Date.parse(event.eventAt)-Date.parse(previous.eventAt))/1000)} seconds. This is straight-line displacement, not total trip distance.`:quality?"A GPS fix and a device-reported motion state were received. A continuous route is unavailable.":"Location evidence is insufficient. Vehicle use cannot be established from this observation.";
  const evidence:MovementEvidence={id:`EVID-${event.id}`,eventIds:[...(contiguous?[previous.id]:[]),event.id],vehicleId:v.id,declarationId:v.declarationId,state:v.state,office:v.office,deviceId:event.deviceId,startAt:contiguous?previous.eventAt:event.eventAt,endAt:event.eventAt,durationSeconds:contiguous?Math.round((Date.parse(event.eventAt)-Date.parse(previous.eventAt))/1000):null,distanceMeters:displacement,route,gpsAccuracy:event.accuracy,geofenceDepartureAt:outside?event.eventAt:null,geofenceReturnAt:null,accelerometer:null,ignition:null,tamper:event.tamper,health:quality?"Quality-accepted demo fix":"Unverified / unavailable GPS",permissionId:permission?.id??null,permissionStatus:permission?"Matching demo permission; conditions recorded as reviewed":"No matching verified permission in available records",algorithmVersion:"tax-evidence-v1; operational 150m boundary / 30m GPS quality; not statutory thresholds",classification,observed,inference:credible?"Possible movement outside the declared storage location. Pending verification.":"No determination of vehicle use or tax liability.",integrityHash:hash(event),authentication:"Synthetic simulator event",source:"DEMO",disclosed:true};
  tax.evidence.push(evidence);
  const during=v.startsAt<=event.eventAt&&v.endsAt>=event.eventAt&&v.declarationStatus!=="Pending verification";
  let c=store.cases.find(c=>c.vehicleId===v.id&&(!c.tax||c.tax.declarationId===v.declarationId)&&c.status!=="Closed");
  if(!c&&credible&&during&&!permission&&!event.tamper){
   const alert=store.alerts.find(a=>a.vehicleId===v.id&&a.status!=="Resolved");
   const alertId=alert?.id??id("ALT-TAX");
   if(!alert)store.alerts.push({id:alertId,vehicleId:v.id,title:"Suspected Non-Use violation",description:observed,severity:"High",status:"New",occurredAt:event.eventAt,receivedAt:event.receivedAt,evidence:[event.id],assignee:null,acknowledgedAt:null});
   c={id:id("CASE-TAX"),vehicleId:v.id,alertId,status:"Under review",priority:"High",assignee:null,createdAt:timestamp(),notes:[],outcome:null};store.cases.push(c);
  }
  if(c&&(credible||event.tamper||!quality)){
   c.tax??={declarationId:v.declarationId,lifecycle:"Pending evidence validation",evidenceIds:[],evidenceReviews:[],disclosed:true,responseRequestedAt:null,responseDeadline:null,history:[]};
   c.tax.evidenceIds.push(evidence.id);history(c,"system","Evidence associated",observed,true);
  }
 }
}
function caseFor(store:DemoStore,account:Account,caseId:unknown){
 const c=store.cases.find(c=>c.id===caseId&&c.tax),v=store.vehicles.find(v=>v.id===c?.vehicleId);
 if(!c||!v||technical(account)||aggregate(account)||!inJurisdiction(account,v)||account.role==="enforcement_officer"&&c.assignee!==account.id||account.role==="vehicle_owner"&&!c.tax!.disclosed)throw new Error("Case not found in your authorized scope.");
 return {c,v};
}
export function authorized(store:DemoStore,account:Account,action:TaxPermission,vehicle:Pick<Vehicle,"state"|"office">){
 const now=timestamp();return can(account,action)&&ensureTaxState(store).authorizations.some(a=>a.accountId===account.id&&a.mode===integrationMode(account)&&a.state===vehicle.state&&(!a.office||a.office===vehicle.office)&&a.actions.includes(action)&&!a.revokedAt&&a.validFrom<=now&&a.validTo>=now&&a.verifiedBy!==account.id);
}
const reason=(value:unknown)=>z.string().trim().min(10,"Please record at least 10 characters explaining your reasoning.").max(4000).parse(value);
const label=(value:unknown)=>z.string().trim().min(1).max(160).parse(value);
const dateOnly=(value:unknown)=>z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(value);
function hasMatchingPermission(store:DemoStore,e:MovementEvidence){return store.requests.some(r=>r.vehicleId===e.vehicleId&&r.status==="Authorized in demo"&&r.authorization?.mode==="DEMO"&&r.authorization.conditionsVerified&&r.authorization.validFrom<=e.endAt&&r.authorization.validTo>=e.startAt);}
const actions:Record<string,TaxPermission>={simulate:"tax.assessment.simulate",prepare:"tax.assessment.prepare",review:"tax.assessment.review",approve:"tax.assessment.approve",revise:"tax.assessment.revise",cancel:"tax.assessment.approve",assign:"tax.case.assign",finding:"tax.case.investigate",evidenceReview:"tax.case.investigate",requestResponse:"tax.owner_response.review",respond:"tax.owner_response.submit",reviewResponse:"tax.owner_response.review",disclose:"tax.assessment.review",dismiss:"tax.assessment.review",noticeDraft:"tax.notice.prepare",noticeIssue:"tax.notice.issue",reconcile:"tax.payment.reconcile",appeal:"tax.appeal.read",ruleDraft:"tax.rules.draft",ruleReview:"tax.rules.review",rulePublish:"tax.rules.publish",recordPermission:"tax.assessment.approve"};
export function applyTaxAction(store:DemoStore,account:Account,input:Record<string,unknown>):Record<string,unknown>{
 syncTaxEvidence(store);const tax=store.tax!,action=String(input.action),permission=actions[action];
 if(!permission||!can(account,permission))throw new Error("This action is outside your permissions.");
 if(integrationMode(account)!=="DEMO")throw new Error("MANUAL / OFFICIAL processing is disabled until identity, legal verification and approved adapters are connected.");
 if(action==="appeal"&&(account.role==="auditor"||account.role==="vehicle_owner"))throw new Error("Official appeal submission is not connected. Only authorized staff may record a verified external reference.");
 const requestId=z.string().uuid().parse(input.requestId),fingerprint=hash(input);
 const previous=tax.requests.find(r=>r.id===requestId&&r.actor===account.id);if(previous){if(previous.fingerprint!==fingerprint)throw new Error("Idempotency key was already used for different content.");return previous.result;}
 const result:Record<string,unknown>={message:"Saved to the shared DEMO workspace."};
 if(action.startsWith("rule")){
  if(action==="ruleDraft"){
   const source=label(input.sourceUrl);if(!source.startsWith("https://"))throw new Error("An HTTPS legal source is required.");
   const r:TaxRule={id:id("RULE"),version:1,state:account.state??"Gujarat",office:null,category:z.enum(["Goods carrier","Passenger bus","Light commercial"]).parse(input.category),mode:"OFFICIAL",status:"Draft",title:label(input.title),provision:label(input.provision),schedule:label(input.schedule),notification:label(input.notification),sourceUrl:source,effectiveFrom:dateOnly(input.effectiveFrom),effectiveTo:dateOnly(input.effectiveTo),ratePaise:parsePaise(label(input.rate)),unit:"assessable period",method:"unverified",conditions:reason(input.reason),exemptions:"Pending verification",rounding:"integer paise",verifiedBy:null,approvedBy:null,createdBy:account.id,createdAt:timestamp()};if(r.effectiveTo<r.effectiveFrom)throw new Error("Invalid rule effective period.");tax.rules.push(r);result.ruleId=r.id;
  }else{const r=tax.rules.find(r=>r.id===input.ruleId&&r.state===account.state);if(!r)throw new Error("Rule not found in your state.");if(r.createdBy===account.id)throw new Error("Independent rule review is required.");if(action==="rulePublish")throw new Error("Publication requires verified legal review, a separate publication authorization and an approved integration. No rule was activated.");if(r.status!=="Draft")throw new Error("Only a draft can be submitted for legal verification.");r.status="Pending verification";r.verifiedBy=account.id;}
  taxAudit(store,account,action,String(result.ruleId??input.ruleId),reason(input.reason));
 }else{
  const {c,v}=caseFor(store,account,input.caseId);const review=c.tax!;
  if(c.status==="Closed"&&action!=="simulate")throw new Error("This case is closed. A new authorized review is required.");
  const assessment=()=>{const a=tax.assessments.find(a=>a.id===input.assessmentId&&a.caseId===c.id);if(!a)throw new Error("Assessment not found in this case.");return a;};
  if(["simulate","prepare","revise"].includes(action)){
   if(c.status==="Closed")throw new Error("This case is closed.");
   const rule=tax.rules.find(r=>r.id===input.ruleId);if(!rule)throw new Error("Select an applicable verified rule or a labelled demo scenario.");
   const evidenceIds=z.array(z.string()).min(1,"Select evidence supporting the proposed period.").parse(input.evidenceIds);
   if(evidenceIds.some(e=>!review.evidenceIds.includes(e)))throw new Error("Evidence is outside this case.");
   const periodStart=dateOnly(input.periodStart),periodEnd=dateOnly(input.periodEnd);
   const calculation=calculateTax({rule,mode:"DEMO",state:v.state,office:v.office,category:v.category,periodStart,periodEnd,penalty:label(input.penalty),otherPenalty:input.otherPenalty===true,evidenceIds});
   if(action==="simulate")return {calculation,simulation:true,message:"Hypothetical scenario only. No assessment was saved."};
   for(const evidenceId of evidenceIds){const e=tax.evidence.find(e=>e.id===evidenceId)!;if(hash((store.events??[]).find(event=>event.id===e.eventIds.at(-1)))!==e.integrityHash)throw new Error("Evidence integrity verification failed.");const decision=review.evidenceReviews.filter(r=>r.evidenceId===evidenceId).at(-1);if(decision?.disposition!=="Relied upon"||e.classification!=="Unverified movement"||e.permissionId||hasMatchingPermission(store,e))throw new Error("Only reviewed movement evidence can support a proposal. Resolve permissions, telemetry gaps and exclusions first.");if(e.endAt.slice(0,10)<periodStart||e.startAt.slice(0,10)>periodEnd)throw new Error("The proposed period must include the evidence relied upon.");}
   const replaced=action==="revise"?assessment():undefined;
   if(replaced&&["Cancelled","Superseded"].includes(replaced.status))throw new Error("This assessment is no longer active. Select its current revision.");
   if(replaced&&tax.notices.some(n=>n.assessmentId===replaced.id&&n.status==="Issued"))throw new Error("An issued demand requires a verified amendment procedure. It cannot be silently revised.");
   if(tax.assessments.some(a=>a.vehicleId===v.id&&a.mode==="DEMO"&&a.id!==replaced?.id&&!["Returned","Cancelled","Superseded"].includes(a.status)&&overlaps(periodStart,periodEnd,a.calculation.periodStart,a.calculation.periodEnd)))throw new Error("An overlapping assessment already exists. Review or revise it instead of creating another charge.");
   const a:Assessment={id:id("ASM"),caseId:c.id,vehicleId:v.id,declarationId:v.declarationId,state:v.state,office:v.office,mode:"DEMO",revision:(replaced?.revision??0)+1,replacesId:replaced?.id??null,calculation,status:"Proposed",preparedBy:account.id,preparedAt:timestamp(),reviewedBy:null,approvedBy:null,approvedAt:null,reason:reason(input.reason),disclosed:false,evidenceHash:hash(evidenceIds.map(e=>tax.evidence.find(x=>x.id===e)?.integrityHash))};tax.assessments.push(a);if(replaced&&replaced.status!=="Approved")replaced.status="Superseded";review.lifecycle="Assessment proposed";result.assessmentId=a.id;
  }else if(action==="review"){
   const a=assessment();if(a.preparedBy===account.id)throw new Error("A different authorized reviewer must review this proposal.");if(a.status!=="Proposed")throw new Error("Only proposed assessments can be reviewed.");a.status=input.return===true?"Returned":"Under review";a.reviewedBy=account.id;review.lifecycle=input.return===true?"Under investigation":"Pending authorized decision";
  }else if(action==="approve"){
   if(!authorized(store,account,permission,v))throw new Error("A separately verified, scoped Taxation Authority authorization is required.");
   const a=assessment();if(a.preparedBy===account.id||a.status!=="Under review"||!a.reviewedBy)throw new Error("Independent proposal review is required before a decision.");
   if(!review.responseRequestedAt)throw new Error("Request the owner’s explanation before the simulated decision.");
   const responses=tax.responses.filter(r=>r.caseId===c.id);if(!responses.length||responses.some(r=>!r.reviewedBy))throw new Error("Owner response consideration is required in this demo. Silence never creates liability.");
   if(a.calculation.evidenceIds.some(e=>review.evidenceReviews.filter(r=>r.evidenceId===e).at(-1)?.disposition!=="Relied upon"))throw new Error("Relied-upon evidence has changed. Return and revise the proposal.");
   for(const evidenceId of a.calculation.evidenceIds){const e=tax.evidence.find(e=>e.id===evidenceId);if(!e||hash((store.events??[]).find(event=>event.id===e.eventIds.at(-1)))!==e.integrityHash)throw new Error("Evidence integrity verification failed before approval.");if(hasMatchingPermission(store,e))throw new Error("A matching permission has been recorded. Return and revise the proposal.");}
   if(hash(a.calculation.evidenceIds.map(e=>tax.evidence.find(x=>x.id===e)?.integrityHash))!==a.evidenceHash)throw new Error("Assessment evidence integrity verification failed.");
   a.status="Approved";a.approvedBy=account.id;a.approvedAt=timestamp();a.disclosed=true;review.lifecycle="Violation established by authority";
   if(a.replacesId){const old=tax.assessments.find(x=>x.id===a.replacesId);if(old)old.status="Superseded";}
  }else if(action==="cancel"){
   if(!authorized(store,account,permission,v))throw new Error("Scoped statutory authorization is required.");const a=assessment();if(a.status!=="Approved")throw new Error("Only an approved assessment may be cancelled by this action.");a.status="Cancelled";for(const n of tax.notices.filter(n=>n.assessmentId===a.id))n.status="Cancelled";
  }else if(action==="assign"){
   const officer=store.accounts.find(a=>a.id===input.assignee&&a.role==="enforcement_officer"&&a.state===v.state&&a.office===v.office&&a.status==="Active");if(!officer)throw new Error("Choose an active officer in this RTO.");c.assignee=officer.id;if(!officer.assignedVehicleIds.includes(v.id))officer.assignedVehicleIds.push(v.id);const alert=store.alerts.find(a=>a.id===c.alertId);if(alert)alert.assignee=officer.id;
  }else if(action==="evidenceReview"){
   const evidenceId=label(input.evidenceId);if(!review.evidenceIds.includes(evidenceId))throw new Error("Evidence not found in this case.");review.evidenceReviews.push({evidenceId,disposition:z.enum(["Relied upon","Inconclusive","Excluded"]).parse(input.disposition),reason:reason(input.reason),actor:account.id,at:timestamp()});review.lifecycle="Under investigation";
  }else if(action==="finding"){
   c.notes.push({text:reason(input.reason),author:account.id,at:timestamp()});review.lifecycle="Under investigation";
  }else if(action==="requestResponse"){
   review.disclosed=true;review.responseRequestedAt=timestamp();review.lifecycle="Owner explanation requested";review.responseDeadline=null;
  }else if(action==="respond"){
   if(account.role!=="vehicle_owner")throw new Error("Only the verified owner may submit an owner response.");
   const documentIds=z.array(z.string()).max(5).parse(input.documentIds??[]);if(documentIds.some(d=>!tax.documents.some(x=>x.id===d&&x.caseId===c.id&&x.uploader===account.id)))throw new Error("Document access denied.");
   const response={id:id("ACK"),caseId:c.id,ownerId:account.id,kind:z.enum(["Explanation","Towing or repair","Permission reference","Device malfunction","Dispute movement","Clarification"]).parse(input.kind),text:reason(input.reason),permissionReference:input.permissionReference?label(input.permissionReference):null,documentIds,at:timestamp(),reviewedBy:null,reviewReason:null};tax.responses.push(response);review.lifecycle="Owner response received";result.acknowledgementId=response.id;
  }else if(action==="reviewResponse"){
   const response=tax.responses.find(r=>r.id===input.responseId&&r.caseId===c.id);if(!response)throw new Error("Response not found.");if(response.reviewedBy)throw new Error("Response was already reviewed. Add a new finding to preserve history.");response.reviewedBy=account.id;response.reviewReason=reason(input.reason);review.lifecycle="Under investigation";
  }else if(action==="disclose"){
   const a=assessment();if(a.status!=="Under review"&&a.status!=="Approved")throw new Error("Only independently reviewed estimates may be disclosed.");a.disclosed=true;
  }else if(action==="dismiss"){
   if(tax.assessments.some(a=>a.caseId===c.id&&["Approved","Under review","Proposed"].includes(a.status)))throw new Error("Return or cancel active assessments before closing without liability.");review.lifecycle="Closed without established liability";c.status="Closed";c.outcome=reason(input.reason);
  }else if(action==="noticeDraft"){
   const a=assessment();if(a.status!=="Approved")throw new Error("A recorded authorized decision is required before drafting a demand.");if(tax.notices.some(n=>n.assessmentId===a.id&&n.status!=="Cancelled"))throw new Error("A demand draft already exists for this assessment.");const notice={id:id("NOTICE"),caseId:c.id,assessmentId:a.id,mode:"DEMO" as const,status:"Draft" as const,reference:`DEMO-DRAFT-${randomUUID().slice(0,8)}`,reason:reason(input.reason),preparedBy:account.id,issuedBy:null,issuedAt:null,responseDeadline:null,serviceReference:null};tax.notices.push(notice);result.noticeId=notice.id;
  }else if(action==="noticeIssue"){
   if(!authorized(store,account,permission,v))throw new Error("Separate notice-issuance authorization is required.");const n=tax.notices.find(n=>n.id===input.noticeId&&n.caseId===c.id);if(!n||n.status!=="Draft")throw new Error("Demand draft not found or already issued.");if(n.preparedBy===account.id)throw new Error("An independent authorized issuer is required.");if(tax.assessments.find(a=>a.id===n.assessmentId)?.status!=="Approved")throw new Error("The assessment is no longer approved.");n.status="Issued";n.issuedBy=account.id;n.issuedAt=timestamp();n.reference=`DEMO-NOTICE-${n.id.slice(-8)}`;n.serviceReference="Simulated in-app delivery. Not an official demand.";
  }else if(action==="reconcile"){
   if(!authorized(store,account,permission,v))throw new Error("Separate payment-reconciliation authorization is required.");const n=tax.notices.find(n=>n.id===input.noticeId&&n.caseId===c.id&&n.status==="Issued");if(!n)throw new Error("An issued demo demand is required.");const a=tax.assessments.find(a=>a.id===n.assessmentId)!;if(a.status!=="Approved")throw new Error("Assessment is not active.");const reference=label(input.reference),amountPaise=parsePaise(label(input.amount));
   const duplicate=tax.payments.find(p=>p.reference===reference&&p.mode==="DEMO");if(duplicate){if(duplicate.noticeId!==n.id||duplicate.amountPaise!==amountPaise)throw new Error("Payment reference conflicts with an existing receipt.");return {message:"Payment already reconciled. No duplicate revenue recorded.",paymentId:duplicate.id};}
   const paid=tax.payments.filter(p=>p.noticeId===n.id).reduce((sum,p)=>sum+p.amountPaise,0);if(amountPaise<=0||paid+amountPaise>a.calculation.totalPaise)throw new Error("Payment must be positive and cannot exceed the outstanding demand.");const p={id:id("PAY"),noticeId:n.id,reference,amountPaise,mode:"DEMO" as const,reconciledBy:account.id,at:timestamp(),sourceReference:reason(input.reason)};tax.payments.push(p);result.paymentId=p.id;
  }else if(action==="appeal"){
   if(!authorized(store,account,"tax.assessment.approve",v))throw new Error("Recording a decision or stay requires separately verified authority.");const a=assessment();if(a.status!=="Approved")throw new Error("Select an approved assessment.");const stay=input.stay===true;tax.appeals.push({id:id("APPEAL"),caseId:c.id,assessmentId:a.id,reference:label(input.reference),status:"Recorded",stay,stayReference:stay?label(input.stayReference):null,reason:reason(input.reason),recordedBy:account.id,at:timestamp(),mode:"DEMO"});
  }else if(action==="recordPermission"){
   if(!authorized(store,account,"tax.assessment.approve",v))throw new Error("Verified authority is required to record a movement permission.");const request=store.requests.find(r=>r.id===input.movementRequestId&&r.vehicleId===v.id);if(!request)throw new Error("Movement request not found.");const reference=label(input.reference);request.status="Authorized in demo";request.reviewedBy=account.id;request.authorization={reference,validFrom:new Date(`${request.date}T${request.startTime}:00+05:30`).toISOString(),validTo:new Date(`${request.date}T${request.endTime}:00+05:30`).toISOString(),conditionsVerified:true,mode:"DEMO"};
  }
  const explanation=reason(input.reason);const visible=["requestResponse","respond","approve","noticeIssue","reconcile","dismiss","appeal","cancel"].includes(action);
  history(c,account.id,action,explanation,visible);taxAudit(store,account,action,String(result.assessmentId??result.noticeId??c.id),explanation,v);
 }
 tax.requests.push({id:requestId,actor:account.id,fingerprint,result});return result;
}

export function taxProjection(store:DemoStore,account:Account,params=new URLSearchParams()){
 syncTaxEvidence(store);const tax=store.tax!,owner=account.role==="vehicle_owner",isAggregate=aggregate(account);
 const state=params.get("state")??"all",office=params.get("office")??"all";
 if(state!=="all"&&account.role!=="national_admin"&&state!==account.state)throw new Error("State outside your jurisdiction.");
 if(office!=="all"&&!store.vehicles.some(v=>v.office===office&&inJurisdiction(account,v)))throw new Error("Office outside your jurisdiction.");
 const permitted=!technical(account)&&["tax.analytics.read","tax.assessment.read","tax.rules.read"].some(p=>can(account,p as TaxPermission));
 const scoped=permitted?store.vehicles.filter(v=>inJurisdiction(account,v)&&(state==="all"||v.state===state)&&(office==="all"||v.office===office)):[];
 const vehicleIds=new Set(scoped.map(v=>v.id));const scopedCases=store.cases.filter(c=>c.tax&&vehicleIds.has(c.vehicleId)&&(account.role!=="enforcement_officer"||c.assignee===account.id)&&(!owner||c.tax!.disclosed));
 const caseIds=new Set(scopedCases.map(c=>c.id));
 const allAssessments=tax.assessments.filter(a=>caseIds.has(a.caseId)),assessments=allAssessments.filter(a=>!owner||a.disclosed);
 const notices=tax.notices.filter(n=>caseIds.has(n.caseId)&&(!owner||n.status!=="Draft"));
 const noticeIds=new Set(notices.map(n=>n.id));const payments=tax.payments.filter(p=>noticeIds.has(p.noticeId));
 const active=allAssessments.filter(a=>a.status==="Approved"),proposed=allAssessments.filter(a=>a.status==="Proposed"||a.status==="Under review");
 const paidFor=(assessmentId:string)=>payments.filter(p=>notices.find(n=>n.id===p.noticeId)?.assessmentId===assessmentId).reduce((n,p)=>n+p.amountPaise,0);
 const outstanding=active.reduce((n,a)=>n+(notices.some(x=>x.assessmentId===a.id&&x.status==="Issued")?Math.max(0,a.calculation.totalPaise-paidFor(a.id)):0),0);
 const summary={cases:scopedCases.length,pendingResponses:scopedCases.filter(c=>c.tax!.lifecycle==="Owner explanation requested").length,awaitingDecision:proposed.filter(a=>a.status==="Under review").length,unavailable:scopedCases.filter(c=>!tax.rules.some(r=>r.mode==="DEMO"&&r.status==="Active"&&r.state===scoped.find(v=>v.id===c.vehicleId)?.state&&r.category===scoped.find(v=>v.id===c.vehicleId)?.category&&r.ratePaise!==null)).length,estimatedPaise:proposed.reduce((n,a)=>n+a.calculation.totalPaise,0),assessedBasePaise:active.reduce((n,a)=>n+a.calculation.basePaise,0),penaltyPaise:active.reduce((n,a)=>n+a.calculation.penaltyPaise,0),recoveredPaise:payments.reduce((n,p)=>n+p.amountPaise,0),outstandingPaise:outstanding,disputed:tax.appeals.filter(a=>caseIds.has(a.caseId)).length,stayedPaise:active.filter(a=>tax.appeals.some(p=>p.assessmentId===a.id&&p.stay)).reduce((n,a)=>n+Math.max(0,a.calculation.totalPaise-paidFor(a.id)),0),cancelled:allAssessments.filter(a=>a.status==="Cancelled"||a.status==="Superseded").length,officialRecoveredPaise:0};
 const cases=isAggregate||!permitted?[]:scopedCases.map(c=>{const v=scoped.find(v=>v.id===c.vehicleId)!;const evidence=can(account,"tax.evidence.read")?tax.evidence.filter(e=>c.tax!.evidenceIds.includes(e.id)&&(!owner||e.disclosed)).map(e=>({...e,route:can(account,"locations.read")?e.route:[],algorithmVersion:owner?"Restricted operational detail":e.algorithmVersion,integrityHash:owner?"Integrity recorded":e.integrityHash})):[];
  return {id:c.id,vehicleId:v.id,registration:v.registration,category:v.category,state:v.state,office:v.office,declarationId:v.declarationId,declarationStatus:v.declarationStatus,taxProfile:v.taxProfile??null,parking:owner||can(account,"locations.read")?v.parking:"Restricted",startsAt:v.startsAt,endsAt:v.endsAt,assignee:owner?null:c.assignee,priority:c.priority,createdAt:c.createdAt,lifecycle:c.tax!.lifecycle,responseRequestedAt:c.tax!.responseRequestedAt,responseDeadline:c.tax!.responseDeadline,evidence,evidenceReviews:owner?c.tax!.evidenceReviews.map(r=>({evidenceId:r.evidenceId,disposition:r.disposition,reason:"Evidence disposition recorded by reviewer.",actor:"Authorized reviewer",at:r.at})):c.tax!.evidenceReviews,notes:owner?[]:c.notes,history:c.tax!.history.filter(h=>!owner||h.disclosed).map(h=>owner?{...h,actor:"VahakIN demo workspace"}:h),responses:tax.responses.filter(r=>r.caseId===c.id&&(!owner||r.ownerId===account.id)).map(r=>owner?{...r,reviewedBy:r.reviewedBy?"Authorized reviewer":null,reviewReason:r.reviewedBy?"Your submission has been considered. See the case updates for disclosed findings.":null}:r),assessments:assessments.filter(a=>a.caseId===c.id),notices:notices.filter(n=>n.caseId===c.id),payments:payments.filter(p=>notices.find(n=>n.id===p.noticeId)?.caseId===c.id),appeals:tax.appeals.filter(a=>a.caseId===c.id),documents:tax.documents.filter(d=>d.caseId===c.id&&(!owner||d.uploader===account.id||d.disclosed)).map(d=>({id:d.id,caseId:d.caseId,uploader:d.uploader,name:d.name,mime:d.mime,bytes:d.bytes,sha256:d.sha256,at:d.at,disclosed:d.disclosed})),movementRequests:store.requests.filter(r=>r.vehicleId===v.id)};
 });
 const rules=can(account,"tax.rules.read")?tax.rules.filter(r=>account.role==="national_admin"||r.state===account.state):[];
 const months=[...new Set([...active.map(a=>a.approvedAt!.slice(0,7)),...payments.map(p=>p.at.slice(0,7))])].sort().map(month=>({month,assessedPaise:active.filter(a=>a.approvedAt!.startsWith(month)).reduce((n,a)=>n+a.calculation.totalPaise,0),recoveredPaise:payments.filter(p=>p.at.startsWith(month)).reduce((n,p)=>n+p.amountPaise,0)}));
 const distribution=[...new Set(scoped.map(v=>v.office))].map(office=>({office,cases:scopedCases.filter(c=>scoped.find(v=>v.id===c.vehicleId)?.office===office).length,estimatedPaise:proposed.filter(a=>a.office===office).reduce((n,a)=>n+a.calculation.totalPaise,0),assessedPaise:active.filter(a=>a.office===office).reduce((n,a)=>n+a.calculation.totalPaise,0)}));
 const categoryDistribution=[...new Set(scoped.map(v=>v.category))].map(category=>{const ids=new Set(scoped.filter(v=>v.category===category).map(v=>v.id));return {category,estimatedPaise:proposed.filter(a=>ids.has(a.vehicleId)).reduce((n,a)=>n+a.calculation.totalPaise,0),assessedPaise:active.filter(a=>ids.has(a.vehicleId)).reduce((n,a)=>n+a.calculation.totalPaise,0),outstandingPaise:active.filter(a=>ids.has(a.vehicleId)&&notices.some(x=>x.assessmentId===a.id&&x.status==="Issued")).reduce((n,a)=>n+Math.max(0,a.calculation.totalPaise-paidFor(a.id)),0)};});
 const ageing=[{label:"0–30 days",min:0,max:30},{label:"31–60 days",min:31,max:60},{label:"61–90 days",min:61,max:90},{label:"Over 90 days",min:91,max:Infinity}].map(bucket=>{const records=active.filter(a=>{const age=Math.max(0,Math.floor((Date.now()-Date.parse(a.approvedAt!))/86400000));return age>=bucket.min&&age<=bucket.max;});return {label:bucket.label,count:records.length,outstandingPaise:records.filter(a=>notices.some(n=>n.assessmentId===a.id&&n.status==="Issued")).reduce((n,a)=>n+Math.max(0,a.calculation.totalPaise-paidFor(a.id)),0)};});
 const conversion={reviewCases:scopedCases.length,assessedCases:new Set(active.map(a=>a.caseId)).size,dismissedCases:scopedCases.filter(c=>c.tax!.lifecycle==="Closed without established liability").length};

 return {mode:"DEMO" as const,configuredMode:integrationMode(account),ready:integrationMode(account)==="DEMO",permissions:permissionsFor(account),summary:permitted&&!owner?summary:null,ownerSummary:owner?{openReviews:cases.filter(c=>c.lifecycle!=="Closed without established liability").length,pendingActions:cases.filter(c=>c.lifecycle==="Owner explanation requested").length,payablePaise:outstanding,officialPayablePaise:0}:null,cases,rules,months:can(account,"tax.analytics.read")?months:[],distribution:can(account,"tax.analytics.read")?distribution:[],categoryDistribution:can(account,"tax.analytics.read")?categoryDistribution:[],ageing:can(account,"tax.analytics.read")?ageing:[],conversion:can(account,"tax.analytics.read")?conversion:null,legalSources,authorizations:tax.authorizations.filter(a=>a.accountId===account.id),investigators:can(account,"tax.case.assign")?store.accounts.filter(a=>a.role==="enforcement_officer"&&a.office===account.office&&a.status==="Active").map(a=>({id:a.id,name:a.name})):[],audit:can(account,"tax.audit.read")?tax.audit.filter(a=>account.role==="national_admin"||a.state===account.state&&(!account.office||a.office===account.office)):[],readiness:{statutoryRates:false,governmentIdentity:false,officialNotices:false,paymentGateway:false,gujaratiLegalReview:false},refreshedAt:timestamp()};
}
export type TaxWorkspace=ReturnType<typeof taxProjection>;
export function taxCSV(data:TaxWorkspace){const rows=[["VahakIN DEMO financial report — not official revenue"],["Generated",data.refreshedAt],["Office","Review cases","Estimated exposure INR","Simulated assessed INR"],...data.distribution.map(d=>[d.office,String(d.cases),money(d.estimatedPaise),money(d.assessedPaise)])];return "\uFEFF"+rows.map(row=>row.map(v=>'"'+(/^[=+\-@\t\r]/.test(v)?"'":"")+v.replaceAll('"','""')+'"').join(",")).join("\r\n");}
export function documentFor(store:DemoStore,account:Account,documentId:string){const tax=ensureTaxState(store),document=tax.documents.find(d=>d.id===documentId);if(!document)throw new Error("Document not found.");caseFor(store,account,document.caseId);if(!can(account,"tax.evidence.read")||account.role==="vehicle_owner"&&document.uploader!==account.id&&!document.disclosed)throw new Error("Document access denied.");return document;}
export function attachDocument(store:DemoStore,account:Account,caseId:string,name:string,mime:string,buffer:Buffer){
 if(integrationMode(account)!=="DEMO")throw new Error("Document storage for MANUAL / OFFICIAL mode is not configured.");
 const {c,v}=caseFor(store,account,caseId);if(!can(account,"tax.evidence.append")&&!can(account,"tax.owner_response.submit"))throw new Error("Document upload is not permitted.");if(buffer.length>2*1024*1024||!buffer.length)throw new Error("Files must be between 1 byte and 2 MB.");
 const pdf=mime==="application/pdf"&&buffer.subarray(0,5).toString()==="%PDF-",png=mime==="image/png"&&buffer.subarray(0,8).toString("hex")==="89504e470d0a1a0a",jpg=mime==="image/jpeg"&&buffer[0]===255&&buffer[1]===216&&buffer[2]===255;
 if(!pdf&&!png&&!jpg)throw new Error("Upload a valid PDF, PNG or JPEG. Active document formats are not supported.");
 const tax=ensureTaxState(store);if(tax.documents.filter(d=>d.caseId===c.id).length>=20)throw new Error("This demo case has reached its document limit.");
 const doc={id:id("DOC"),caseId:c.id,uploader:account.id,name:name.replace(/[^\w .()-]/g,"_").slice(0,100),mime,bytes:buffer.length,sha256:createHash("sha256").update(buffer).digest("hex"),base64:buffer.toString("base64"),at:timestamp(),disclosed:account.role==="vehicle_owner"};tax.documents.push(doc);taxAudit(store,account,"Document attached",doc.id,"Original bytes retained with SHA-256; unscanned demo attachment",v);return {id:doc.id,name:doc.name};
}
