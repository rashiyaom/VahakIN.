import type { Calculation, IntegrationMode, TaxRule } from "./types";

export const assessmentUnavailable="Financial assessment unavailable. Applicable taxation information requires verification.";
export function parsePaise(value:string):number {
 if(!/^\d{1,10}(\.\d{1,2})?$/.test(value))throw new Error("Enter a non-negative rupee amount with at most two decimal places.");
 const [rupees,paise=""]=value.split(".");const result=BigInt(rupees)*BigInt(100)+BigInt(paise.padEnd(2,"0"));
 if(result>BigInt(Number.MAX_SAFE_INTEGER))throw new Error("Amount exceeds supported precision.");return Number(result);
}
export function money(paise:number){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(paise/100);}
export function overlaps(a:string,b:string,c:string,d:string){return a<=d&&c<=b;}
function validDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function calculateTax(input:{rule:TaxRule;mode:IntegrationMode;state:string;office:string;category:string;periodStart:string;periodEnd:string;penalty:string;otherPenalty?:boolean;evidenceIds?:string[]}):Calculation {
 const {rule,mode,periodStart,periodEnd}=input;
 if(input.otherPenalty&&input.penalty==="18(1A)")throw new Error("Section 18(1B): overlapping penalties under 18(1) and 18(1A) are not permitted.");
 if(!["none","18(1A)"].includes(input.penalty))throw new Error("Unsupported penalty scenario.");
 if(!validDate(periodStart)||!validDate(periodEnd)||periodEnd<periodStart)throw new Error("Choose a valid assessable period.");
 if(rule.mode!==mode||rule.state!==input.state||rule.office&&rule.office!==input.office||rule.category!==input.category)throw new Error("The rule does not apply to this vehicle, jurisdiction or integration mode.");
 if(rule.status!=="Active"||rule.ratePaise===null||!Number.isSafeInteger(rule.ratePaise)||rule.ratePaise<0||rule.method!=="fixed_period"||periodStart<rule.effectiveFrom||periodEnd>rule.effectiveTo)throw new Error(assessmentUnavailable);
 if(mode!=="DEMO"&&(!rule.verifiedBy||!rule.approvedBy||!rule.notification||!rule.sourceUrl.startsWith("https://")))throw new Error(assessmentUnavailable);
 const base=BigInt(rule.ratePaise),penalty=input.penalty==="18(1A)"?base*BigInt(2):BigInt(0),total=base+penalty;
 if(total>BigInt(Number.MAX_SAFE_INTEGER))throw new Error("Amount exceeds supported precision.");
 return {version:"tax-calc-v1",mode,rule:structuredClone(rule),periodStart,periodEnd,basePaise:Number(base),penaltyPaise:Number(penalty),totalPaise:Number(total),creditsPaise:0,penalty:input.penalty as Calculation["penalty"],evidenceIds:input.evidenceIds??[],explanation:mode==="DEMO"?"Illustrative fixed amount for the explicitly selected assessable period. This is not a notified rate. Distance and duration are evidence, not tax inputs.":"Verified fixed-period rule applied to the authority-determined period. Distance and duration do not determine tax."};
}
