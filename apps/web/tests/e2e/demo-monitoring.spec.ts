import {test,expect} from '@playwright/test';
import {authenticateDemo} from './demo-auth';
test('government demo previews seeded journeys and illustrative assessment',async({page})=>{
 await authenticateDemo(page.request);
 await page.goto('/gov/monitoring');
 await expect(page.getByRole('heading',{name:'Fleet demonstration'})).toBeVisible();
 await page.getByRole('button',{name:/Geofence breach ·/}).first().click();
 await expect(page.getByText(/Warning: simulated journey crosses/)).toBeVisible();
 await page.getByLabel('Hypothetical rate per kilometre').fill('20');
 await expect(page.getByText(/km × ₹20.00/)).toBeVisible();
 await page.getByRole('button',{name:/Signal lost ·/}).first().click();
 await expect(page.getByText(/Current position is unknown/)).toBeVisible();
 await expect(page.getByText(/0 km × ₹20.00/)).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
