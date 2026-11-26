import { describe, expect, it } from "vitest";
import { can,inJurisdiction,type Account } from "../../lib/permissions/access";
import { demoAccounts,monitoring,type Vehicle } from "../../lib/server/demo-store";
const account=(id:string)=>demoAccounts.find(a=>a.id===`demo-${id}`)!;
const own={id:"v-003",state:"Gujarat",office:"GJ-03",ownerId:"demo-owner",ownerVerified:true};
describe("jurisdiction and permission boundaries",()=>{
 it("separates state scope from identical role permissions",()=>{expect(inJurisdiction(account("state"),own)).toBe(true);expect(inJurisdiction(account("state"),{...own,state:"Maharashtra",office:"MH-12"})).toBe(false);});
 it("restricts RTO admins to their assigned office",()=>{expect(inJurisdiction(account("rto"),own)).toBe(true);expect(inJurisdiction(account("rto"),{...own,office:"GJ-01"})).toBe(false);});
 it("requires verified ownership, never just a registration",()=>{expect(inJurisdiction(account("owner"),own)).toBe(true);expect(inJurisdiction(account("owner"),{...own,ownerVerified:false})).toBe(false);expect(inJurisdiction(account("owner"),{...own,ownerId:"someone-else"})).toBe(false);});
 it("restricts officers and technicians to assigned records",()=>{expect(inJurisdiction(account("officer"),own)).toBe(true);expect(inJurisdiction(account("officer"),{...own,id:"v-001"})).toBe(false);expect(inJurisdiction(account("technician"),own)).toBe(false);});
 it("does not give administrators implicit access to precise locations",()=>{expect(can(account("national"),"states.read")).toBe(true);expect(can(account("national"),"locations.read")).toBe(false);expect(can(account("state"),"vehicles.read")).toBe(false);});
 it("separates infrastructure from regulatory authority",()=>{expect(can(account("technical"),"devices.maintain")).toBe(true);expect(can(account("technical"),"vehicles.read")).toBe(false);expect(can(account("technical"),"vehicles.approve")).toBe(false);});
 it("keeps managers out of employee administration",()=>{expect(can(account("manager"),"cases.assign")).toBe(true);expect(can(account("manager"),"employees.read")).toBe(false);});
 it("keeps operators and auditors from approving their own work",()=>{expect(can(account("operator"),"vehicles.draft")).toBe(true);expect(can(account("operator"),"vehicles.approve")).toBe(false);expect(can(account("auditor"),"vehicles.draft")).toBe(false);expect(can(account("auditor"),"alerts.acknowledge")).toBe(false);});
 it("revokes all permissions for suspended accounts",()=>{const a:Account={...account("rto"),status:"Suspended"};expect(can(a,"vehicles.read")).toBe(false);expect(inJurisdiction(a,own)).toBe(false);});
});
describe("telemetry freshness",()=>{
 const now=Date.parse("2026-11-26T12:00:00Z");
 it("does not fabricate current monitoring for absent or old telemetry",()=>{expect(monitoring({heartbeat:null} as Vehicle,now)).toBe("Unavailable");expect(monitoring({heartbeat:"2026-11-26T10:00:00Z"} as Vehicle,now)).toBe("Unavailable");expect(monitoring({heartbeat:"2026-11-26T11:30:00Z"} as Vehicle,now)).toBe("Stale");expect(monitoring({heartbeat:"2026-11-26T11:59:00Z"} as Vehicle,now)).toBe("Current");});
});
