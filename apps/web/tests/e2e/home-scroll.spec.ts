import { test, expect } from "@playwright/test";

test("brand reveal has a scrollable stage and navigation tracks it",async({page})=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("/");
 await page.locator(".desktop-links").getByRole("link",{name:"The brand",exact:true}).click();
 const section=page.locator("#how-it-works");
 await expect(section).toHaveText("VahakIN.");
 await expect(section.locator("img, article, p")).toHaveCount(0);
 await expect(section.locator("svg")).toBeVisible();
 await expect(section.locator("h2")).toBeVisible();
 await expect(page.locator(".desktop-links a[aria-current=location]")).toHaveText("The brand");
 expect(await section.evaluate(el=>el.clientHeight>innerHeight)).toBe(true);
 await expect(section.locator(".brand-reveal-stage")).toHaveCSS("position","sticky");
 await page.evaluate(()=>{const el=document.querySelector("#how-it-works")!;window.scrollTo({top:el.getBoundingClientRect().top+scrollY+250,behavior:"instant"});});
 await page.screenshot({path:"/tmp/vahakin-grand-reveal.png"});
 await page.locator(".desktop-links").getByRole("link",{name:"Connect",exact:true}).click();
 await expect(page.locator(".desktop-links a[aria-current=location]")).toHaveText("Connect");
 expect(errors).toEqual([]);
});

test("reduced motion removes sticky staging and keeps mobile content accessible",async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:"reduce"});await page.goto("/");
 await page.getByRole("button",{name:"Open navigation"}).click();await page.locator("#mobile-panel").getByRole("link",{name:"The brand",exact:true}).click();
 const section=page.locator("#how-it-works");await expect(section).toBeInViewport();await expect(section.locator("h2")).toBeVisible();
 await expect(section.locator(".brand-reveal-stage")).toHaveCSS("position","relative");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
