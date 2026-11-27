import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const out=path.resolve('../../docs/media/screenshots');const manifest=[];const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});const page=await context.newPage();
async function capture(url,name){try{await page.goto('http://localhost:3000'+url,{waitUntil:'domcontentloaded',timeout:20000});await page.waitForTimeout(2200);await page.screenshot({path:path.join(out,name+'.png'),fullPage:true,animations:'disabled'});manifest.push({name,url,capturedAt:new Date().toISOString()});console.log(name);}catch(e){manifest.push({name,url,error:e.message});}}
for(const [url,name]of [['/','home'],['/login/owner','login-owner'],['/login/government','login-government'],['/demo','demo-roles'],['/auth/reset-password','reset-password']])await capture(url,name);
for(const [id,portal]of [['demo-rto','gov'],['demo-owner','owner'],['demo-technical','ops'],['demo-national','national']]){
 await context.clearCookies();await context.request.post('http://localhost:3000/api/session',{headers:{Origin:'http://localhost:3000'},data:{email:'demo@gmail.com',password:'demo@123',portal:'government'}});
 const r=await context.request.post('http://localhost:3000/api/session',{headers:{Origin:'http://localhost:3000'},data:{mode:'demo',accountId:id}});if(!r.ok())throw new Error('Demo login failed '+id);
 const prefix=portal==='national'?'gov':portal;await capture('/'+prefix,portal+'-overview');
 const links=await page.locator('nav[aria-label="Workspace navigation"] a').evaluateAll(as=>as.map(a=>a.getAttribute('href')?.split('?')[0]).filter(Boolean));
 for(const url of [...new Set(links)]){if(url==='/'+prefix)continue;if(portal==='national'&&!['/gov/states','/gov/offices'].includes(url))continue;await capture(url,portal+'-'+url.split('/').pop());}
 if(portal==='owner')await capture('/owner/onboarding','owner-onboarding');
 if(portal==='gov'){await page.goto('http://localhost:3000/gov/vahan-ai');await page.waitForTimeout(5000);mkdirSync(path.resolve('../../docs/media/ai-frames'),{recursive:true});for(let i=0;i<12;i++){await page.screenshot({path:path.resolve('../../docs/media/ai-frames',`${String(i).padStart(3,'0')}.png`)});await page.evaluate(()=>window.scrollBy(0,90));await page.waitForTimeout(350);}}
}
await browser.close();writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
