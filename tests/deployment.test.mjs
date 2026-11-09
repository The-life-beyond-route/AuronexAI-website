import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHandler } from '../api/enquiries.js';

test('Vercel publishes static browser assets and excludes private/server files', async () => {
  execFileSync(process.execPath, ['scripts/build.mjs'], { env: { ...process.env, VERCEL_ENV: 'preview' } });
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  assert.equal(config.framework, null);
  assert.equal(config.outputDirectory, 'dist');
  const html = await readFile('dist/index.html', 'utf8');
  assert.match(html, /src="assets\/site.js"/);
  assert.doesNotMatch(html, /src="app.js"/);
  const files = (await readdir('dist', { recursive: true })).map(file => file.replaceAll('\\', '/')).sort();
  assert.deepEqual(files, ['404.html', 'assets', 'assets/site.js', 'index.html', 'logo.svg', 'privacy.html', 'styles.css']);
  assert.match(await readFile('dist/assets/site.js', 'utf8'), /document.querySelector/);
  assert.match(await readFile('server.mjs', 'utf8'), /'\/assets\/site.js':'assets\/site.js'/);
});

export function response() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
const quiet = { error() {} };
test('missing database settings never acknowledge receipt', async () => {
  const handler = createHandler({ env: {}, logger: quiet, getServices: () => { throw new Error('Missing database'); } });
  const res = response(); await handler({ method: 'POST', headers: { 'content-type': 'application/json', host: 'localhost' }, body: {} }, res);
  assert.equal(res.code, 503); assert.equal(res.body.ok, undefined);
  assert.equal(res.headers['Cache-Control'], 'no-store');
});
test('hosted endpoint rejects unsupported methods', async () => {
  const handler = createHandler({ getServices: () => { throw new Error('Not called'); } });
  const res = response(); await handler({ method: 'GET' }, res);
  assert.equal(res.code, 405); assert.equal(res.headers.Allow, 'POST');
});
test('hosted endpoint rejects untrusted origins and oversized payloads before accessing credentials', async () => {
  const handler = createHandler({ env: { VERCEL: '1', SITE_URL: 'https://example.com' }, getServices: () => { throw new Error('Not called'); } });
  const first = response(); await handler({ method: 'POST', headers: { origin: 'https://evil.test' } }, first);assert.equal(first.code,403);
  const second = response(); await handler({ method: 'POST', headers: { origin: 'https://example.com', 'content-type': 'application/json' }, body: 'x'.repeat(16001) }, second);assert.equal(second.code,413);
});
