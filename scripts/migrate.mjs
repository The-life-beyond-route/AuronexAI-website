import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
if (!(process.env.DIRECT_URL || process.env.DATABASE_URL)) throw new Error('Set DIRECT_URL or DATABASE_URL before applying migrations.');
execFileSync(process.execPath, [fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url)), 'migrate', 'deploy'], { stdio: 'inherit' });
