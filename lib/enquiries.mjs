import { createHash, createHmac, randomUUID } from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const limits = { name: 120, business: 180, email: 254, service: 100, message: 3000 };
export function validateEnquiry(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Please complete the enquiry form.');
  if (typeof body.website === 'string' && body.website) return null;
  const data = {};
  for (const [key, max] of Object.entries(limits)) {
    if (typeof body[key] !== 'string' || body[key].trim().length < 2 || body[key].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body[key])) throw new HttpError(400, `Please check the ${key} field.`);
    data[key] = body[key].trim();
  }
  if (!/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(data.email) || /[\r\n]/.test(data.name + data.business + data.service)) throw new HttpError(400, 'Please check your contact details.');
  if (body.consent !== true) throw new HttpError(400, 'Please agree to the privacy notice.');
  const requestId = body.requestId || randomUUID();
  if (typeof requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new HttpError(400, 'Please refresh the page and try again.');
  return { ...data, requestId, payloadHash: createHash('sha256').update(JSON.stringify(data)).digest('hex') };
}

export function emailConfig(env) {
  const domain = env.RESEND_EMAIL_DOMAIN?.trim();
  const from = env.RESEND_FROM || (domain && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) ? `AuronexAI <enquiries@${domain}>` : undefined);
  if (!env.RESEND_API_KEY || !from || !env.ENQUIRY_TO || !/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(env.ENQUIRY_TO)) throw new HttpError(503, 'Our enquiry service is being configured. Please try again later.');
  return { from, to: env.ENQUIRY_TO };
}

export function notificationEmail(entry, config) {
  return {
    from: config.from,
    to: [config.to],
    replyTo: entry.email,
    subject: `New AuronexAI enquiry — ${entry.business}`,
    text: `New website enquiry\n\nName: ${entry.name}\nBusiness: ${entry.business}\nEmail: ${entry.email}\nInterested in: ${entry.service}\nReceived: ${new Date(entry.createdAt).toISOString()}\nReference: ${entry.id}\n\nMessage:\n${entry.message}\n\nReply to this email to contact the enquirer.`,
  };
}

export async function notifyEnquiry({ db, mailer, entry, config, logger = console }) {
  if (entry.notificationSentAt) return true;
  // A database lease stops simultaneous requests/retries from sending together.
  const now = new Date();
  const claim = await db.enquiry.updateMany({
    where: { id: entry.id, notificationSentAt: null, notificationAttempts: { lt: 5 }, OR: [{ notificationLeaseUntil: null }, { notificationLeaseUntil: { lt: now } }] },
    data: { notificationStatus: 'SENDING', notificationLeaseUntil: new Date(now.getTime() + 120000), notificationAttempts: { increment: 1 } },
  });
  if (!claim.count) return false;
  try {
    const { data, error } = await mailer.emails.send(notificationEmail(entry, config), { idempotencyKey: `enquiry/${entry.id}` });
    if (error || !data?.id) throw new Error('Email provider rejected notification');
    await db.enquiry.update({ where: { id: entry.id }, data: { notificationStatus: 'SENT', notificationId: data.id, notificationSentAt: new Date(), notificationLeaseUntil: null } });
    return true;
  } catch {
    // Never log customer messages, API keys, or provider responses containing data.
    logger.error('Enquiry notification pending', { enquiryId: entry.id });
    try { await db.enquiry.update({ where: { id: entry.id }, data: { notificationStatus: 'PENDING', notificationLeaseUntil: null } }); } catch { logger.error('Could not update notification status', { enquiryId: entry.id }); }
    return false;
  }
}

export async function submitEnquiry({ body, ip, db, mailer, env, logger = console }) {
  const input = validateEnquiry(body);
  if (!input) return { ok: true };
  const config = emailConfig(env);
  let entry = await db.enquiry.findUnique({ where: { requestId: input.requestId } });
  if (entry && entry.payloadHash !== input.payloadHash) throw new HttpError(409, 'The enquiry changed. Please submit it again.');
  if (!entry) {
    const bucket = Math.floor(Date.now() / 600000);
    const hash = createHmac('sha256', env.RATE_LIMIT_SECRET || env.RESEND_API_KEY).update(ip || 'unknown').digest('hex');
    const rate = await db.rateLimit.upsert({ where: { id: `${hash}:${bucket}` }, create: { id: `${hash}:${bucket}`, count: 1, expiresAt: new Date((bucket + 1) * 600000) }, update: { count: { increment: 1 } } });
    if (rate.count > 10) throw new HttpError(429, 'Too many enquiries. Please try again in ten minutes.');
    try { entry = await db.enquiry.create({ data: { ...input, consentAt: new Date() } }); }
    catch (error) {
      if (error.code !== 'P2002') throw error;
      entry = await db.enquiry.findUnique({ where: { requestId: input.requestId } });
      if (!entry || entry.payloadHash !== input.payloadHash) throw new HttpError(409, 'Please submit your enquiry again.');
    }
  }
  // Once persistence succeeds, notification failures must not ask the visitor to resubmit.
  try { await notifyEnquiry({ db, mailer, entry, config, logger }); }
  catch { logger.error('Enquiry saved; notification needs retry', { enquiryId: entry.id }); }
  return { ok: true, id: entry.id };
}

export async function retryNotifications({ db, mailer, env, logger = console }) {
  const config = emailConfig(env);
  const entries = await db.enquiry.findMany({ where: { notificationSentAt: null, notificationAttempts: { lt: 5 }, OR: [{ notificationLeaseUntil: null }, { notificationLeaseUntil: { lt: new Date() } }] }, orderBy: { createdAt: 'asc' }, take: 25 });
  let sent = 0;
  for (const entry of entries) if (await notifyEnquiry({ db, mailer, entry, config, logger })) sent++;
  await db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return { processed: entries.length, sent };
}
