import { execFileSync } from 'node:child_process';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
if (process.env.VERCEL_ENV === 'production') {
  execFileSync(process.execPath, [path.join(root, 'scripts/migrate.mjs')], { stdio: 'inherit' });
}
const output = path.join(root, 'dist');
// Explicit allowlist: no credentials, enquiry records, or server source are published.
const files = ['index.html', 'styles.css', 'assets/site.js', 'logo.svg', 'privacy.html'];
for (const file of files) {
  const target = path.join(output, file);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(root, file), target);
}
await writeFile(path.join(output, '404.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found — AuronexAI</title><h1>Page not found</h1><p><a href="/">Return to AuronexAI</a></p></html>');
console.log('Static website built in dist/');
