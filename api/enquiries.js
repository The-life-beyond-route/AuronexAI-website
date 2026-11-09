import { HttpError, submitEnquiry } from '../lib/enquiries.mjs';

export function createHandler({ getServices, env = process.env, logger = console }) {
  return async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return response.status(405).json({ error: 'Method not allowed.' }); }
    try {
      const origin = request.headers.origin;
      const allowed = new Set([env.SITE_URL, env.VERCEL_URL && `https://${env.VERCEL_URL}`, env.VERCEL_PROJECT_PRODUCTION_URL && `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`].filter(Boolean));
      // Local server uses the same handler when database settings are present.
      if (!env.VERCEL) allowed.add(`http://${request.headers.host}`);
      if (origin && !allowed.has(origin)) throw new HttpError(403, 'This request origin is not allowed.');
      if (!request.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'Please submit the website form.');
      let body = request.body;
      if (Buffer.byteLength(typeof body === 'string' ? body : JSON.stringify(body || {})) > 16000) throw new HttpError(413, 'Your enquiry is too long.');
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { throw new HttpError(400, 'Invalid enquiry.'); } }
      const { db, mailer } = await getServices();
      const ip = env.VERCEL ? String(request.headers['x-forwarded-for'] || '').split(',')[0].trim() : request.socket?.remoteAddress;
      const result = await submitEnquiry({ body, ip, db, mailer, env, logger });
      return response.status(201).json(result);
    } catch (error) {
      if (!(error instanceof HttpError)) logger.error('Enquiry processing failed', { code: error.code || 'INTERNAL' });
      return response.status(error.status || 503).json({ error: error instanceof HttpError ? error.message : 'We could not save your enquiry right now. Please try again shortly.' });
    }
  };
}

export default createHandler({ getServices: async () => (await import('../lib/services.mjs')).services() });
