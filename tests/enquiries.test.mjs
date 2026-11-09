import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { submitEnquiry, validateEnquiry, emailConfig, retryNotifications } from '../lib/enquiries.mjs';
const env = { RESEND_API_KEY: 'test-only-key', RESEND_EMAIL_DOMAIN: 'example.com', ENQUIRY_TO: 'owner@example.com' };
const sample = () => ({ requestId: randomUUID(), name: 'Alex Smith', business: 'Example Salon', email: 'alex@example.com', service: 'Bookings & reminders', message: 'Automate appointment reminders.', consent: true });
const logger = { error() {} };
function fixture() {
  const entries = new Map(); const calls = []; let count = 0;
  const db = {
    enquiry: {
      async findUnique({ where }) { return [...entries.values()].find(x => x.requestId === where.requestId); },
      async create({ data }) {
        if ([...entries.values()].some(x => x.requestId === data.requestId)) throw Object.assign(new Error(), { code: 'P2002' });
        const entry = { id: randomUUID(), createdAt: new Date(), notificationAttempts: 0, notificationSentAt: null, notificationLeaseUntil: null, notificationStatus: 'PENDING', ...data }; entries.set(entry.id, entry); return { ...entry };
      },
      async updateMany({ where, data }) {
        const entry=entries.get(where.id);
        if(entry.notificationSentAt || entry.notificationAttempts >= 5 || (entry.notificationLeaseUntil && entry.notificationLeaseUntil > new Date()))return {count:0};
        entry.notificationAttempts++;entry.notificationStatus=data.notificationStatus;entry.notificationLeaseUntil=data.notificationLeaseUntil;return {count:1};
      },
      async update({ where, data }) { Object.assign(entries.get(where.id), data); },
      async findMany() { return [...entries.values()].filter(x => !x.notificationSentAt && x.notificationAttempts < 5); },
    },
    rateLimit: { async upsert() { return { count: ++count }; }, async deleteMany() {} },
  };
  const mailer = { emails: { async send(payload, options) { calls.push({payload,options});return {data:{id:'email-123'}}; } } };
  const submit = (body) => submitEnquiry({body,ip:'127.0.0.1',db,mailer,env,logger});
  return { db, mailer, calls, entries, submit };
}
test('valid enquiry is stored before a notification and Reply-To points to the customer',async()=>{
  const f=fixture();const body=sample();const result=await f.submit(body);
  assert.equal(result.ok,true);assert.equal(f.entries.size,1);const saved=f.entries.get(result.id);assert.equal(saved.notificationStatus,'SENT');assert.ok(saved.consentAt);
  assert.equal(f.calls[0].payload.replyTo,body.email);assert.deepEqual(f.calls[0].payload.to,['owner@example.com']);assert.match(f.calls[0].payload.text,/Automate appointment reminders/);
  assert.equal(f.calls[0].options.idempotencyKey,`enquiry/${result.id}`);
});
test('repeating a submission creates one lead and sends one notification',async()=>{
  const f=fixture();const body=sample();const first=await f.submit(body);const second=await f.submit(body);
  assert.equal(first.id,second.id);assert.equal(f.entries.size,1);assert.equal(f.calls.length,1);
});
test('parallel duplicate requests share a lead and notification lease',async()=>{
  const f=fixture();const body=sample();const results=await Promise.all([f.submit(body),f.submit(body)]);
  assert.equal(results[0].id,results[1].id);assert.equal(f.entries.size,1);assert.equal(f.calls.length,1);
});
test('a reused request ID with different content is rejected',async()=>{
  const f=fixture();const body=sample();await f.submit(body);await assert.rejects(()=>f.submit({...body,message:'A different enquiry'}),{status:409});assert.equal(f.calls.length,1);
});
test('provider failure retains lead, returns success, and a retry sends it',async()=>{
  const f=fixture();const send=f.mailer.emails.send;f.mailer.emails.send=async()=>({error:{message:'Provider down'}});
  const result=await f.submit(sample());assert.equal(result.ok,true);assert.equal(f.entries.get(result.id).notificationStatus,'PENDING');
  f.mailer.emails.send=send;const retry=await retryNotifications({...f,env,logger});assert.equal(retry.sent,1);assert.equal(f.entries.get(result.id).notificationStatus,'SENT');
});
test('a database failure never sends an email',async()=>{
  const f=fixture();f.db.enquiry.create=async()=>{throw new Error('DB down');};await assert.rejects(()=>f.submit(sample()));assert.equal(f.calls.length,0);
});
test('missing email configuration never accepts an enquiry',async()=>{
  const f=fixture();await assert.rejects(()=>submitEnquiry({...f,env:{},body:sample(),ip:'127.0.0.1',logger}),{status:503});assert.equal(f.entries.size,0);
});
test('rate limiting is database-backed and rejects the eleventh new enquiry',async()=>{
  const f=fixture();for(let i=0;i<10;i++)await f.submit(sample());await assert.rejects(()=>f.submit(sample()),{status:429});assert.equal(f.entries.size,10);
});
test('input validation rejects missing consent, header injection and invalid email',()=>{
  for(const body of [{...sample(),consent:false},{...sample(),email:'wrong'},{...sample(),business:'Business\r\nBcc: victim@example.com'},{...sample(),message:'x'.repeat(3001)}])assert.throws(()=>validateEnquiry(body),{status:400});
  assert.equal(validateEnquiry({website:'spam'}),null);assert.equal(emailConfig(env).from,'AuronexAI <enquiries@example.com>');
});
