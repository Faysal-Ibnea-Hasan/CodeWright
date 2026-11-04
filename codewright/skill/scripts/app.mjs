#!/usr/bin/env node
// Starts and stops the project's app on its test port, using the `serve` command confirmed in profile.json.
//   node app.mjs start [logDir]   → waits until the port answers; refuses if the port is already in use
//   node app.mjs status
//   node app.mjs stop
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const stateFile = (dir) => path.join(dir, '.codewright', 'app.json');
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function portOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const s = net.connect({ port, host });
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('error', () => resolve(false));
    s.setTimeout(1000, () => { s.destroy(); resolve(false); });
  });
}

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

export async function start(dir, logDir, { timeoutMs = 60000 } = {}) {
  const profile = readJson(path.join(dir, '.codewright', 'profile.json'));
  const serve = profile?.commands?.serve;
  const port = profile?.appPort;
  if (!serve || !port) throw new Error('profile.json needs commands.serve and appPort to start the app.');
  const current = readJson(stateFile(dir));
  if (current && alive(current.pid)) return { ...current, alreadyRunning: true };
  // Never attach to something else on the port: it could be the user's dev server with real data.
  if (await portOpen(port)) throw new Error(`Port ${port} is already in use by another process. Free it or change appPort in profile.json.`);

  const logs = path.resolve(dir, logDir ?? path.join('.codewright', 'logs'));
  fs.mkdirSync(logs, { recursive: true });
  const log = path.join(logs, 'app.log');
  const out = fs.openSync(log, 'a');
  const child = spawn(serve, { cwd: dir, shell: true, detached: true, stdio: ['ignore', out, out] });
  child.unref();
  const state = { pid: child.pid, port, url: `http://127.0.0.1:${port}`, log: path.relative(dir, log), startedAt: new Date().toISOString() };
  fs.writeFileSync(stateFile(dir), `${JSON.stringify(state, null, 2)}\n`);

  for (const deadline = Date.now() + timeoutMs; Date.now() < deadline; await sleep(300)) {
    if (await portOpen(port)) return state;
    if (!alive(child.pid)) break;
  }
  await stop(dir);
  const tail = fs.readFileSync(log, 'utf8').split('\n').slice(-20).join('\n');
  throw new Error(`The app did not start listening on port ${port}. Last log lines:\n${tail}`);
}

export async function stop(dir) {
  const state = readJson(stateFile(dir));
  fs.rmSync(stateFile(dir), { force: true });
  if (!state) return { stopped: false, reason: 'not running' };
  const kill = (sig) => { try { process.kill(-state.pid, sig); } catch { try { process.kill(state.pid, sig); } catch {} } };
  kill('SIGTERM');
  for (let i = 0; i < 20 && alive(state.pid); i++) await sleep(150);
  if (alive(state.pid)) kill('SIGKILL');
  return { stopped: true, pid: state.pid };
}

export async function status(dir) {
  const state = readJson(stateFile(dir));
  if (!state) return { running: false };
  return { ...state, running: alive(state.pid), listening: await portOpen(state.port) };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, arg] = process.argv.slice(2);
  const dir = process.cwd();
  const run = { start: () => start(dir, arg), stop: () => stop(dir), status: () => status(dir) }[cmd];
  if (!run) { console.error('usage: app.mjs start [logDir] | status | stop'); process.exit(2); }
  run().then((r) => console.log(JSON.stringify(r, null, 2))).catch((e) => { console.error(e.message); process.exit(1); });
}
