import { expect, type APIRequestContext } from '@playwright/test';
export async function authenticateDemo(request: APIRequestContext) {
  const existing = await request.get('/api/workspace');
  if (existing.ok() && (await existing.json()).account?.mode === 'demo') return;
  const response = await request.post('/api/session', { headers: { Origin: process.env.VAHAKIN_TEST_URL || 'http://localhost:3000' }, data: { email: 'demo@gmail.com', password: 'demo@123', portal: 'government' } });
  expect(response.status(), await response.text()).toBe(200);
}
