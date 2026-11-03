#!/usr/bin/env node
// Local-only HTTP client for the Runtime Monitor and personas. Refuses any host but this machine,
// so it is safe to run without a prompt.
//   node http.mjs request <METHOD> <url-or-path> [--as <role>] [-H "Name: value"]... [-d '<json or text>']
//   node http.mjs sweep <routes.json>      routes: [{ "method", "path", "as"?, "body"?, "headers"? }]
// Roles come from profile.json "testAccounts": { "<role>": { "headers": {...} } }
//   or { "<role>": { "login": { "method", "path", "body", "tokenPath", "header", "prefix" } } }.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCAL = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const SLOW_MS = 2000;
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };

export function resolveUrl(target, profile) {
  const url = new URL(target, `http://127.0.0.1:${profile?.appPort ?? 80}`);
  if (!['http:', 'https:'].includes(url.protocol) || !LOCAL.has(url.hostname)) {
    throw new Error(`Refusing ${url.href}: only this machine (localhost) can be called.`);
  }
  return url;
}

const parseBody = (text) => { try { return JSON.parse(text); } catch { return text.length > 4000 ? `${text.slice(0, 4000)}…[truncated]` : text; } };
const dig = (obj, dotted) => dotted.split('.').reduce((o, k) => o?.[k], obj);

export function client(profile) {
  const tokens = new Map();

  async function roleHeaders(role) {
    if (!role) return {};
    const account = profile?.testAccounts?.[role];
    if (!account) throw new Error(`No test account "${role}" in profile.json testAccounts.`);
    if (account.headers) return account.headers;
    if (!tokens.has(role)) {
      const l = account.login;
      const res = await send(l.method ?? 'POST', l.path, { body: l.body });
      const token = dig(res.body, l.tokenPath ?? 'token');
      if (!token) throw new Error(`Login for "${role}" returned ${res.status} without a token at "${l.tokenPath ?? 'token'}".`);
      tokens.set(role, { [l.header ?? 'Authorization']: `${l.prefix ?? 'Bearer '}${token}` });
    }
    return tokens.get(role);
  }

  async function send(method, target, { as, headers = {}, body } = {}) {
    const url = resolveUrl(target, profile);
    const h = { accept: 'application/json', ...(await roleHeaders(as)), ...headers };
    let payload;
    if (body !== undefined) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      if (typeof body !== 'string' || /^[[{]/.test(body.trim())) h['content-type'] ??= 'application/json';
    }
    const started = Date.now();
    let res;
    try {
      res = await fetch(url, { method, headers: h, body: payload, redirect: 'manual', signal: AbortSignal.timeout(15000) });
    } catch (e) {
      throw new Error(`Cannot reach ${url.origin}: ${e.cause?.code ?? e.message}. Is the app running? The orchestrator starts it with app.mjs start.`);
    }
    const text = await res.text();
    return {
      method, url: url.pathname + url.search, as: as ?? null, status: res.status, ms: Date.now() - started,
      location: res.headers.get('location') ?? undefined, body: parseBody(text),
    };
  }

  async function sweep(routes) {
    const results = [];
    for (const r of routes) {
      try { results.push(await send(r.method ?? 'GET', r.path, r)); } catch (e) { results.push({ method: r.method ?? 'GET', url: r.path, as: r.as ?? null, error: e.message }); }
    }
    const count = (f) => results.filter(f).length;
    return {
      summary: {
        total: results.length,
        '2xx': count((r) => r.status >= 200 && r.status < 300),
        '3xx': count((r) => r.status >= 300 && r.status < 400),
        '4xx': count((r) => r.status >= 400 && r.status < 500),
        '5xx': count((r) => r.status >= 500),
        errors: count((r) => r.error),
        slow: count((r) => r.ms > SLOW_MS),
      },
      serverErrors: results.filter((r) => r.status >= 500 || r.error),
      slow: results.filter((r) => r.ms > SLOW_MS),
      results,
    };
  }

  return { send, sweep };
}

function parseArgs(argv) {
  const opts = { headers: {} };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--as') opts.as = argv[++i];
    else if (argv[i] === '-H') { const [k, ...v] = argv[++i].split(':'); opts.headers[k.trim()] = v.join(':').trim(); }
    else if (argv[i] === '-d') opts.body = argv[++i];
    else rest.push(argv[i]);
  }
  return { opts, rest };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const profile = readJson(path.join(process.cwd(), '.codewright', 'profile.json'));
  const c = client(profile);
  const [cmd, ...argv] = process.argv.slice(2);
  const { opts, rest } = parseArgs(argv);
  const job = cmd === 'request' ? c.send(rest[0], rest[1], opts)
    : cmd === 'sweep' ? c.sweep(JSON.parse(fs.readFileSync(rest[0], 'utf8')))
    : Promise.reject(new Error('usage: http.mjs request <METHOD> <url> [--as role] [-H "K: V"] [-d body] | sweep <routes.json>'));
  job.then((r) => console.log(JSON.stringify(r, null, 2))).catch((e) => { console.error(e.message); process.exit(1); });
}
