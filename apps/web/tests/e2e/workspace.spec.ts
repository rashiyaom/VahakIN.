import { authenticateDemo } from "./demo-auth";
import { test,expect,type APIRequestContext } from "@playwright/test";
const origin=process.env.VAHAKIN_TEST_URL||"http://localhost:3000";
async function login(request:APIRequestContext,id:string){await authenticateDemo(request);const r=await request.post("/api/session",{headers:{Origin:origin},data:{mode:"demo",accountId:`demo-${id}`}});expect(r.status(),await r.text()).toBe(200);return (await r.json()).redirect;}
test("homepage navigation, brand reveal and sign-in are visible and interactive",async({page})=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("/");await expect(page.getByRole("heading",{name:"At rest. Still protected."})).toBeVisible();
 await page.screenshot({path:"/tmp/vahakin-home-desktop.png",fullPage:true});
 await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page.locator("#portal-panel").getByRole("link",{name:/Government portal/})).toBeVisible();await page.keyboard.press("Escape");await expect(page.locator("#portal-panel").getByRole("link",{name:/Government portal/})).not.toBeVisible();
 await expect(page.locator("#brand-reveal-heading")).toHaveText("VahakIN.");
 await page.goto("/login/government");await expect(page.getByRole("heading",{name:"Where clarity meets confidence."})).toBeVisible();await page.screenshot({path:"/tmp/vahakin-login-desktop.png"});
 await page.getByLabel("Official email address").fill("demo@gmail.com");await page.getByLabel("Password",{exact:true}).fill("demo@123");await page.getByRole("button",{name:"Sign in to your workspace"}).click();await page.waitForURL(url=>url.pathname==="/gov");await expect(page.getByRole("heading",{name:"Good to see you, Aditi."})).toBeVisible();await page.waitForTimeout(2000);await page.screenshot({path:"/tmp/vahakin-dashboard-desktop.png",fullPage:true});expect(errors).toEqual([]);
});
test("mobile layouts do not overflow and mobile navigation works",async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/");await page.getByRole("button",{name:"Open navigation"}).click();await page.getByRole("link",{name:"The brand",exact:true}).last().click();await expect(page.locator("#mobile-panel")).toHaveCount(0);await page.screenshot({path:"/tmp/vahakin-home-mobile.png",fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto("/login/owner");await expect(page.getByRole("heading",{name:"A little closer to what matters."})).toBeVisible();await page.screenshot({path:"/tmp/vahakin-login-mobile.png",fullPage:true});await page.getByLabel("Email address",{exact:true}).fill("demo@gmail.com");await page.getByLabel("Password",{exact:true}).fill("demo@123");await page.getByRole("button",{name:"Sign in to your workspace"}).click();await page.waitForURL(url=>url.pathname==="/owner");await page.waitForTimeout(1000);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole("button",{name:"Open navigation",exact:true}).click();await expect(page.locator(".dashboard-sidebar").getByRole("link",{name:"My vehicles",exact:true})).toBeVisible();await page.locator(".dashboard-sidebar").getByRole("link",{name:"My vehicles",exact:true}).click();await expect(page.getByRole("heading",{name:"Your vehicles, at a glance."})).toBeVisible();await page.screenshot({path:"/tmp/vahakin-owner-mobile.png",fullPage:true});
});
test("unauthenticated API calls and cross-origin writes are rejected",async({request})=>{expect((await request.get("/api/workspace")).status()).toBe(401);expect((await request.post("/api/session",{headers:{Origin:"https://untrusted.example"},data:{mode:"demo",accountId:"demo-rto"}})).status()).toBe(403);});
test("national and state roles get scoped aggregates without private vehicle rows",async({request})=>{
 await login(request,"national");let d=await(await request.get("/api/workspace")).json();expect(d.states.length).toBe(2);expect(d.vehicles).toEqual([]);expect(d.devices.every((v:{registration:string})=>v.registration==="Restricted")).toBe(true);
 await login(request,"state");d=await(await request.get("/api/workspace")).json();expect(d.offices.every((o:{state:string})=>o.state==="Gujarat")).toBe(true);expect(d.vehicles).toEqual([]);expect((await request.get("/api/workspace?state=Maharashtra")).status()).toBe(403);expect((await request.get("/api/workspace?office=MH-12")).status()).toBe(403);
});
test("RTO, owner and assigned employee records cannot be bypassed through IDs",async({request})=>{
 await login(request,"rto");let d=await(await request.get("/api/workspace")).json();expect(d.vehicles.every((v:{office:string})=>v.office==="GJ-03")).toBe(true);expect((await request.get("/api/workspace?vehicleId=v-015")).status()).toBe(404);
 await login(request,"owner");d=await(await request.get("/api/workspace")).json();expect(d.vehicles.map((v:{id:string})=>v.id).sort()).toEqual(["v-001","v-003"]);expect(d.cases).toEqual([]);expect(d.employees).toEqual([]);expect((await request.get("/api/workspace?vehicleId=v-002")).status()).toBe(404);expect((await request.post("/api/workspace",{headers:{Origin:origin},data:{action:"acknowledge",id:"ALT-102"}})).status()).toBe(403);
 await login(request,"officer");d=await(await request.get("/api/workspace")).json();expect(d.vehicles.every((v:{id:string})=>["v-003","v-005"].includes(v.id))).toBe(true);expect(d.vehicles.every((v:{ownerName:string})=>v.ownerName==="Restricted")).toBe(true);
 await login(request,"technical");d=await(await request.get("/api/workspace")).json();expect(d.vehicles).toEqual([]);expect(d.cases).toEqual([]);expect(d.devices.every((v:{registration:string})=>v.registration==="Restricted")).toBe(true);
});
test("enrolment persists across scopes and maker-checker approval is enforced",async({request})=>{
 const registration=`GJ-03 DEMO ${Date.now().toString().slice(-8)}`;await login(request,"rto");const created=await request.post("/api/workspace",{headers:{Origin:origin},data:{action:"enrol",fields:{registration,model:"Tata 407",category:"Goods carrier",ownerName:"Fictional QA owner",parking:"Demo test parking, Rajkot",endsAt:new Date(Date.now()+30*86400000).toISOString()}}});expect(created.status(),await created.text()).toBe(200);
 const d=await(await request.get(`/api/workspace?q=${encodeURIComponent(registration)}`)).json();expect(d.vehicles).toHaveLength(1);expect(d.vehicles[0].monitoring).toBe("Unavailable");expect(d.vehicles[0].ownerVerified).toBe(false);expect((await request.post("/api/workspace",{headers:{Origin:origin},data:{action:"approve",id:d.vehicles[0].id,text:"Attempted self approval for test"}})).status()).toBe(403);
 await login(request,"national");const summary=await(await request.get(`/api/workspace?q=${encodeURIComponent(registration)}`)).json();expect(summary.summary.total).toBe(1);expect(summary.vehicles).toEqual([]);
});
test("owner requests reach only the responsible office and exports stay scoped",async({request})=>{
 await login(request,"owner");const date=new Date(Date.now()+3*86400000).toISOString().slice(0,10);expect((await request.post("/api/workspace",{headers:{Origin:origin},data:{action:"request",vehicleId:"v-001",fields:{date,startTime:"10:00",endTime:"11:00",purpose:"Fictional QA maintenance visit",destination:"Demo service center, Rajkot"}}})).status()).toBe(200);
 const report=await request.get("/api/workspace?export=csv");expect(report.status()).toBe(200);const csv=await report.text();expect(csv).toContain("MOCK");expect(csv).not.toContain("MH-12");expect(csv).not.toContain("GJ-01");
 await login(request,"rto");const d=await(await request.get("/api/workspace")).json();expect(d.requests.some((r:{purpose:string})=>r.purpose==="Fictional QA maintenance visit")).toBe(true);
 await login(request,"auditor");expect((await request.post("/api/workspace",{headers:{Origin:origin},data:{action:"enrol"}})).status()).toBe(403);
});
test("all ten role workspaces load and sign-out revokes the session",async({page})=>{
 for(const id of ["national","state","rto","manager","officer","operator","technician","auditor","owner","technical"]){const route=await login(page.request,id);await page.goto(route);await expect(page.locator(".dashboard-heading h1")).toBeVisible();expect(await page.locator(".workspace-error").count()).toBe(0);}
 expect((await page.request.delete("/api/session",{headers:{Origin:origin}})).status()).toBe(200);expect((await page.request.get("/api/workspace")).status()).toBe(401);
});
test("simulated movement creates shared evidence and delayed events preserve the latest fix",async({request})=>{
 await login(request,"technical");const requestId=crypto.randomUUID();const r=await request.post("/api/workspace",{headers:{Origin:origin},data:{action:"simulate",deviceId:"IG-DEMO-001",scenario:"movement",requestId}});expect(r.status(),await r.text()).toBe(200);
 await login(request,"owner");let d=await(await request.get("/api/workspace")).json();const vehicle=d.vehicles.find((v:{id:string})=>v.id==="v-001");expect(vehicle.geofence).toBe("Outside");expect(d.alerts.some((a:{vehicleId:string;title:string})=>a.vehicleId==="v-001"&&a.title==="Simulated geofence exit")).toBe(true);const latest=vehicle.gpsAt;
 await login(request,"technical");expect((await request.post("/api/workspace",{headers:{Origin:origin},data:{action:"simulate",deviceId:"IG-DEMO-001",scenario:"delayed",requestId:crypto.randomUUID()}})).status()).toBe(200);
 await login(request,"owner");d=await(await request.get("/api/workspace")).json();expect(d.vehicles.find((v:{id:string})=>v.id==="v-001").gpsAt).toBe(latest);
 expect((await request.post("/api/workspace",{headers:{Origin:origin},data:{action:"simulate",deviceId:"IG-DEMO-001",scenario:"movement",requestId:crypto.randomUUID()}})).status()).toBe(403);
});
