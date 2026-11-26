import { authenticateDemo } from "./demo-auth";
import { test, expect } from "@playwright/test";
const origin=process.env.VAHAKIN_TEST_URL||"http://localhost:3000";
test("dashboard sections render cleanly and scoped navigation preserves filters",async({page})=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await authenticateDemo(page.request);
 await page.request.post("/api/session",{headers:{Origin:origin},data:{mode:"demo",accountId:"demo-rto"}});
 for(const section of ["", "vehicles", "declarations", "alerts", "investigations", "requests", "devices", "employees", "reports", "audit", "compliance"]){
  await page.goto(`/gov/${section}`);await expect(page.locator(".dashboard-heading h1")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),section).toBe(true);
 }
 await page.goto("/gov?status=Unavailable&q=GJ-03");
 await expect(page.getByRole("textbox",{name:"Search authorized records"})).toHaveValue("GJ-03");
 await page.locator(".reference-top-nav").getByRole("link",{name:"Vehicles",exact:true}).click();
 await expect(page.getByRole("textbox",{name:"Search authorized records"})).toHaveValue("GJ-03");
 await expect(page.getByRole("combobox",{name:"Monitoring status"})).toHaveValue("Unavailable");
 await page.screenshot({path:"/tmp/vahakin-dashboard-review.png",fullPage:true});
 await page.setViewportSize({width:390,height:844});
 for(const section of ["vehicles","alerts","devices","employees"]){await page.goto(`/gov/${section}`);await expect(page.locator(".dashboard-heading h1")).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),section).toBe(true);}
 expect(errors).toEqual([]);
});
test("national office drilldown opens the scoped overview and coverage agrees",async({page})=>{
 await authenticateDemo(page.request);
 await page.request.post("/api/session",{headers:{Origin:origin},data:{mode:"demo",accountId:"demo-national"}});
 await page.goto("/gov/offices");
 await page.getByRole("button",{name:"Scope overview"}).first().click();
 await expect(page).toHaveURL(/\/gov\?.*office=GJ-03/);
 await expect(page.getByRole("combobox",{name:"Viewing RTO office"})).toHaveValue("GJ-03");
 const response=await page.request.get("/api/workspace");const data=await response.json();
 expect(data.offices.reduce((n:number,o:{coverage:number})=>n+o.coverage,0)).toBe(data.summary.current);
 expect(data.states.reduce((n:number,s:{coverage:number})=>n+s.coverage,0)).toBe(data.summary.current);
});
