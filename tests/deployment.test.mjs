import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import handler from '../api/enquiries.js';

test('Vercel publishes static browser assets and excludes private/server files', async () => {
  execFileSync(process.execPath, ['scripts/build.mjs']);
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

function response() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
test('hosted form does not claim to save an enquiry before integration exists', () => {
  const res = response(); handler({ method: 'POST' }, res);
  assert.equal(res.code, 503); assert.ok(res.body.error); assert.equal(res.body.ok, undefined);
  assert.equal(res.headers['Cache-Control'], 'no-store');
});
test('hosted endpoint rejects unsupported methods', () => {
  const res = response(); handler({ method: 'GET' }, res);
  assert.equal(res.code, 405); assert.equal(res.headers.Allow, 'POST');
});
