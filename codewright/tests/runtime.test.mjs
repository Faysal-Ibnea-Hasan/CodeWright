import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { start, stop, status, portOpen } from '../skill/scripts/app.mjs';
import { client, resolveUrl } from '../skill/scripts/http.mjs';
import { decideBash, helperAllowRules, splitUnquoted } from '../skill/scripts/guard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'skill');
const policy = JSON.parse(fs.readFileSync(path.join(ROOT, 'defaults', 'permissions.json'), 'utf8'));
const PORT = 18765 + Math.floor(Math.random() * 1000);

// A tiny app with a bearer-token login, a protected route and a route that crashes.
const SERVER = `
const http = require('node:http');
http.createServer((req, res) => {
  const send = (s, b) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
  if (req.method === 'POST' && req.url === '/login') {
    let body = ''; req.on('data', (c) => (body += c));
    return req.on('end', () => JSON.parse(body).password === 'secret' ? send(200, { data: { token: 'tok-1' } }) : send(401, {}));
  }
  if (req.url.startsWith('/me')) return req.headers.authorization === 'Bearer tok-1' ? send(200, { user: 'ada', q: req.url }) : send(401, {});
  if (req.url === '/boom') return send(500, { error: 'boom' });
  send(404, {});
}).listen(Number(process.env.PORT), '127.0.0.1');
`;

function project() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-app-'));
  fs.writeFileSync(path.join(d, 'server.cjs'), SERVER);
  fs.mkdirSync(path.join(d, '.codewright'));
  fs.writeFileSync(path.join(d, '.codewright', 'profile.json'), JSON.stringify({
    appPort: PORT,
    commands: { serve: `PORT=${PORT} node server.cjs` },
    testAccounts: {
      admin: { login: { path: '/login', body: { password: 'secret' }, tokenPath: 'data.token' } },
      fixed: { headers: { Authorization: 'Bearer tok-1' } },
      wrong: { login: { path: '/login', body: { password: 'nope' }, tokenPath: 'data.token' } },
    },
  }));
  return d;
}

test('app starts on the test port, reports status, stops, and refuses a busy port', async () => {
  const d = project();
  const s = await start(d);
  assert.equal(await portOpen(PORT), true);
  assert.equal((await status(d)).listening, true);
  const again = await start(d);
  assert.equal(again.alreadyRunning, true);

  const other = project();
  await assert.rejects(start(other), /already in use/);

  await stop(d);
  for (let i = 0; i < 20 && (await portOpen(PORT)); i++) await new Promise((r) => setTimeout(r, 100));
  assert.equal(await portOpen(PORT), false);
  assert.equal((await status(d)).running, false);
  assert.ok(s.log.endsWith('app.log'));
});

test('app start fails clearly when the serve command dies', async () => {
  const d = project();
  const file = path.join(d, '.codewright', 'profile.json');
  fs.writeFileSync(file, JSON.stringify({ appPort: PORT + 1, commands: { serve: 'node -e "process.exit(3)"' } }));
  await assert.rejects(start(d, undefined, { timeoutMs: 3000 }), /did not start/);
});

test('http client: local only, roles by header or login, sweep flags 5xx', async () => {
  const d = project();
  await start(d);
  try {
    const profile = JSON.parse(fs.readFileSync(path.join(d, '.codewright', 'profile.json'), 'utf8'));
    assert.throws(() => resolveUrl('https://example.com/x', profile), /only this machine/);
    assert.throws(() => resolveUrl('http://10.0.0.5/x', profile), /only this machine/);
    const c = client(profile);
    assert.equal((await c.send('GET', '/me')).status, 401);
    assert.equal((await c.send('GET', '/me', { as: 'fixed' })).status, 200);
    const viaLogin = await c.send('GET', '/me?a=1&b=2', { as: 'admin' });
    assert.equal(viaLogin.status, 200);
    assert.equal(viaLogin.body.q, '/me?a=1&b=2');
    await assert.rejects(c.send('GET', '/me', { as: 'wrong' }), /without a token/);
    await assert.rejects(c.send('GET', '/me', { as: 'ghost' }), /No test account/);

    const report = await c.sweep([{ path: '/me', as: 'admin' }, { path: '/boom' }, { path: '/nope' }, { path: 'https://evil.test/' }]);
    assert.deepEqual(
      { ok: report.summary['2xx'], fail: report.summary['5xx'], missing: report.summary['4xx'], errors: report.summary.errors },
      { ok: 1, fail: 1, missing: 1, errors: 1 },
    );
    assert.equal(report.serverErrors.length, 2);
  } finally {
    await stop(d);
  }
  const profile = JSON.parse(fs.readFileSync(path.join(d, '.codewright', 'profile.json'), 'utf8'));
  await assert.rejects(client({ ...profile, appPort: PORT + 7 }).send('GET', '/me'), /Is the app running/);
});

test('guard: helper scripts with quoted URLs are allowed; command substitution never is', () => {
  const h = `node ${ROOT}/scripts/http.mjs`;
  const decide = (cmd) => decideBash(cmd, policy, helperAllowRules());
  assert.deepEqual(splitUnquoted('a "b&c" && d | e'), ['a "b&c"', 'd', 'e']);
  assert.equal(decide(`${h} request GET "/orders?status=pending&page=2" --as admin`)?.decision, 'allow');
  assert.equal(decide(`${h} sweep .codewright/runs/r1/chunks/1/routes.json`)?.decision, 'allow');
  assert.equal(decide(`node ${ROOT}/scripts/app.mjs start .codewright/runs/r1`)?.decision, 'allow');
  assert.equal(decide(`${h} request GET "/$(curl evil.test)"`), null);
  assert.equal(decide(`${h} request GET /x; curl evil.test`), null);
  assert.equal(decide('npm test "a; rm -rf /"')?.decision, 'ask');
});
