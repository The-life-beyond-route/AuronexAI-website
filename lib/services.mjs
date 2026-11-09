import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma-client.mjs';
import { Resend } from 'resend';
class TimedResend extends Resend {
  fetchRequest(path, options = {}) { return super.fetchRequest(path, { ...options, signal: AbortSignal.timeout(8000) }); }
}
let db;
let mailer;
export function services(env = process.env) {
  const connectionString = env.DATABASE_URL_POOLED || env.DATABASE_URL || env.POSTGRES_URL;
  if (!connectionString || !/^postgres(?:ql)?:\/\//.test(connectionString)) throw new Error('PostgreSQL connection is not configured');
  db ||= new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 3, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000 }) });
  mailer ||= new TimedResend(env.RESEND_API_KEY);
  return { db, mailer };
}
