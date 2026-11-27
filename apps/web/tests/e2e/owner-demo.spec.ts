import {test,expect} from '@playwright/test';
test('owner demo covers scenarios, requests, alerts and scoped records',async({page})=>{
 const origin=process.env.VAHAKIN_TEST_URL||'http://localhost:3000';
 const login=await page.request.post('/api/session',{headers:{Origin:origin},data:{email:'demo@gmail.com',password:'demo@123',portal:'owner'}});expect(login.status()).toBe(200);
 const data=await (await page.request.get('/api/workspace')).json();
 expect(data.account.role).toBe('vehicle_owner');
 for(let n=1;n<=8;n++)expect(data.vehicles.some((v:{id:string})=>v.id===`v-${String(n).padStart(3,'0')}`)).toBe(true);
 expect(data.vehicles.some((v:{id:string})=>v.id==='v-009')).toBe(false);
 await page.goto('/owner');await expect(page.getByRole('heading',{name:'Explore your owner demo'})).toBeVisible();
 await page.getByRole('link',{name:'Explore all vehicle scenarios'}).click();
 await expect(page.getByRole('heading',{name:'Your vehicle demonstration'})).toBeVisible();
 for(const name of ['Parked safely','Authorised trip','Geofence breach','Signal lost','Tamper warning','Low battery','Returned to parking','Boundary uncertainty']){
  await page.getByRole('button',{name:new RegExp(name+' ·')}).first().click();
  await expect(page.locator('article[aria-live="polite"]').getByText(name,{exact:true})).toBeVisible();
 }
 await page.getByRole('button',{name:/Geofence breach ·/}).first().click();
 await expect(page.getByText(/You can review the evidence and submit/)).toBeVisible();
 await page.getByRole('button',{name:/Signal lost ·/}).first().click();await expect(page.getByText(/0 km ×/)).toBeVisible();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/owner/requests');for(const status of ['Submitted','Under review','Approved','Rejected'])await expect(page.getByText(status,{exact:true}).first()).toBeVisible();
 await page.goto('/owner/alerts');await expect(page.getByText('Movement beyond parking boundary',{exact:true}).first()).toBeVisible();
 await page.goto('/owner/compliance');await expect(page.locator('body')).not.toContainText('Internal Server Error');
});
