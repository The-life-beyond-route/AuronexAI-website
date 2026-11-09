import { timingSafeEqual } from 'node:crypto';
import { retryNotifications } from '../lib/enquiries.mjs';
export default async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); return response.status(405).json({ error: 'Method not allowed.' }); }
  const expected = process.env.CRON_SECRET && Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  const actual = Buffer.from(request.headers.authorization || '');
  if (!expected || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return response.status(401).json({ error: 'Unauthorized.' });
  try {
    const { services } = await import('../lib/services.mjs');
    return response.status(200).json(await retryNotifications({ ...services(), env: process.env }));
  } catch { console.error('Notification retry failed'); return response.status(503).json({ error: 'Retry service unavailable.' }); }
};
