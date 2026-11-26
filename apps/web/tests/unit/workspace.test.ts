import { afterEach, describe, expect, it, vi } from "vitest";
import * as store from "../../lib/server/demo-store";
import { workspaceFor } from "../../lib/server/workspace";
const now="2026-11-26T12:00:00Z";
function fixture(){
 const base={state:"Gujarat",office:"GJ-03",declarationStatus:"Active",heartbeat:now,gpsAt:now,gpsStatus:"Current",deviceId:"IG-TEST",review:"No suspicious activity detected",endsAt:"2026-12-20T12:00:00Z",lat:22.3,lng:70.8} as store.Vehicle;
 const vehicles=[{...base,id:"fresh"},{...base,id:"gps-gap",gpsAt:null,gpsStatus:"Unavailable"},{...base,id:"pending",declarationStatus:"Pending verification"}];
 vi.spyOn(store,"readStore").mockReturnValue({version:1,vehicles,accounts:store.demoAccounts,alerts:[],cases:[],requests:[],audit:[],sessions:[],maintenance:[]});
}
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();});
describe("monitoring coverage consistency",()=>{
 it("excludes GPS gaps and pending declarations at every summary level",()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(now));fixture();
  const result=workspaceFor(store.demoAccounts.find(a=>a.id==="demo-national")!,new URLSearchParams());
  expect(result.summary.current).toBe(1);expect(result.summary.total).toBe(3);
  expect(result.states[0].coverage).toBe(1);expect(result.offices[0].coverage).toBe(1);
 });
 it("does not report no suspicious activity when heartbeat is fresh but GPS is missing",()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(now));fixture();
  const result=workspaceFor(store.demoAccounts.find(a=>a.id==="demo-rto")!,new URLSearchParams());
  const gap=result.vehicles.find(v=>v.id==="gps-gap")!;
  expect(gap.monitoring).toBe("Current");expect(gap.locationStatus).toBe("Unavailable");expect(gap.review).toBe("Monitoring unavailable");
 });
});
