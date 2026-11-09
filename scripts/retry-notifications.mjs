import 'dotenv/config';
import { services } from '../lib/services.mjs';
import { retryNotifications } from '../lib/enquiries.mjs';
const { db, mailer } = services();
try { console.log(await retryNotifications({ db, mailer, env: process.env })); }
finally { await db.$disconnect(); }
