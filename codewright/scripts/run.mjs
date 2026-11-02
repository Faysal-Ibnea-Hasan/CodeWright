#!/usr/bin/env node
// Run bookkeeping for /codewright:run. Gate verdicts come from here, not from an agent's opinion.
//   node run.mjs new "<title>"                          → creates the run folder, marks it active
//   node run.mjs active                                 → the active run folder, or null
//   node run.mjs end                                    → clears the active marker
//   node run.mjs add-findings <runDir> <chunk> <source> <file.json>   → validates and appends findings
//                                                       (file: a findings array, or a reviewer's whole verdict object)
//   node run.mjs set-status <runDir> <findingId> <open|fixed|accepted|wontfix|escalated> [reason]
//   node run.mjs summary <runDir>                       → open findings per chunk and pass/fail
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SEVERITIES = ['blocker', 'major', 'minor'];
// fixed: a change resolved it · accepted: a recorded decision resolved it · wontfix: the user accepted the problem as is
const STATUSES = ['open', 'fixed', 'accepted', 'wontfix', 'escalated'];
const runsDir = (dir) => path.join(dir, '.codewright', 'runs');
const activeFile = (dir) => path.join(runsDir(dir), '.active');
const findingsFile = (runDir) => path.join(runDir, 'findings.json');
const readFindings = (runDir) => (fs.existsSync(findingsFile(runDir)) ? JSON.parse(fs.readFileSync(findingsFile(runDir), 'utf8')) : []);
const writeFindings = (runDir, f) => fs.writeFileSync(findingsFile(runDir), `${JSON.stringify(f, null, 2)}\n`);

export function active(dir) {
  if (!fs.existsSync(activeFile(dir))) return null;
  const runDir = path.join(runsDir(dir), fs.readFileSync(activeFile(dir), 'utf8').trim());
  return fs.existsSync(runDir) ? runDir : null;
}

export function newRun(dir, title, now = new Date()) {
  const current = active(dir);
  if (current) throw new Error(`A run is already active: ${path.basename(current)}. Resume it, or end it first.`);
  const slug = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'run';
  const stamp = now.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  let name = `${stamp}-${slug}`;
  for (let n = 2; fs.existsSync(path.join(runsDir(dir), name)); n++) name = `${stamp}-${slug}-${n}`;
  const runDir = path.join(runsDir(dir), name);
  fs.mkdirSync(path.join(runDir, 'chunks'), { recursive: true });
  fs.writeFileSync(activeFile(dir), name);
  return runDir;
}

export function end(dir) {
  fs.rmSync(activeFile(dir), { force: true });
}

export function addFindings(runDir, chunk, source, verdictOrItems) {
  // Accepts a reviewer's whole verdict ({ verdict, findings, checked, ... }) so its evidence can be saved alongside.
  const items = Array.isArray(verdictOrItems) ? verdictOrItems : verdictOrItems?.findings;
  if (!Array.isArray(items)) throw new Error('Findings must be a JSON array, or a verdict object with a "findings" array (use [] for none).');
  items.forEach((f, i) => {
    const where = `finding ${i + 1}`;
    if (!SEVERITIES.includes(f?.severity)) throw new Error(`${where}: severity must be one of ${SEVERITIES.join(', ')}`);
    for (const k of ['title', 'evidence']) {
      if (typeof f[k] !== 'string' || !f[k].trim()) throw new Error(`${where}: "${k}" is required`);
    }
  });
  const all = readFindings(runDir);
  const prefix = `C${chunk}-`;
  let next = all.filter((f) => f.id.startsWith(prefix)).length + 1;
  const added = items.map((f) => ({
    id: `${prefix}F${next++}`,
    chunk: String(chunk),
    source,
    severity: f.severity,
    title: f.title.trim(),
    evidence: f.evidence.trim(),
    repro: f.repro ?? '',
    status: 'open',
  }));
  writeFindings(runDir, [...all, ...added]);
  return added;
}

export function setStatus(runDir, id, status, reason) {
  if (!STATUSES.includes(status)) throw new Error(`status must be one of ${STATUSES.join(', ')}`);
  const all = readFindings(runDir);
  const f = all.find((x) => x.id === id);
  if (!f) throw new Error(`No finding ${id}`);
  f.status = status;
  if (reason) f.reason = reason;
  writeFindings(runDir, all);
  return f;
}

export function summary(runDir) {
  const chunks = {};
  for (const f of readFindings(runDir)) {
    const c = (chunks[f.chunk] ??= { open: { blocker: 0, major: 0, minor: 0 }, total: 0 });
    c.total++;
    if (f.status === 'open') c.open[f.severity]++;
  }
  // A chunk passes with no open blockers or majors; minors go to the report.
  for (const c of Object.values(chunks)) c.pass = c.open.blocker === 0 && c.open.major === 0;
  const open = Object.values(chunks).reduce((n, c) => n + c.open.blocker + c.open.major, 0);
  return { chunks, openBlockersAndMajors: open, pass: open === 0 };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...args] = process.argv.slice(2);
  const cwd = process.cwd();
  try {
    let out;
    if (cmd === 'new') out = { runDir: newRun(cwd, args[0]) };
    else if (cmd === 'active') out = { active: active(cwd) };
    else if (cmd === 'end') { end(cwd); out = { ended: true }; }
    else if (cmd === 'add-findings') out = { added: addFindings(args[0], args[1], args[2], JSON.parse(fs.readFileSync(args[3], 'utf8'))) };
    else if (cmd === 'set-status') out = setStatus(args[0], args[1], args[2], args[3]);
    else if (cmd === 'summary') out = summary(args[0]);
    else throw new Error('usage: run.mjs new|active|end|add-findings|set-status|summary');
    console.log(JSON.stringify(out, null, 2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
