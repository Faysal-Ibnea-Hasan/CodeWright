#!/usr/bin/env node
// Tracks whether the knowledge base is current.
//   node kb-state.mjs status [dir]  → JSON: changed files since the last analysis, and the modules they touch
//   node kb-state.mjs stamp  [dir]  → records the current commit and uncommitted-file hashes as analyzed
//   node kb-state.mjs hook          → SessionStart hook: tells Claude when the knowledge base is stale
// state.json is owned by this script; modules.json (module → path globs) is owned by the System Analyst.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { globToRegExp } from './guard.mjs';

const kbDir = (dir) => path.join(dir, '.codewright', 'knowledge');
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };

function git(dir, args) {
  try { return execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; }
}

function dirtyFiles(dir) {
  const out = git(dir, ['status', '--porcelain', '-z', '--untracked-files=all']);
  if (out === null) return null;
  const entries = out.split('\0');
  const files = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e) continue;
    files.push(e.slice(3));
    if (e[0] === 'R' || e[0] === 'C') i++; // renames carry the old path as the next entry
  }
  return files.filter((f) => !f.startsWith('.codewright/'));
}

const hashFile = (dir, f) => {
  try { return crypto.createHash('sha1').update(fs.readFileSync(path.join(dir, f))).digest('hex'); } catch { return 'missing'; }
};

export function stamp(dir) {
  const head = git(dir, ['rev-parse', 'HEAD'])?.trim() ?? null;
  const dirty = Object.fromEntries((dirtyFiles(dir) ?? []).map((f) => [f, hashFile(dir, f)]));
  const state = { analyzedCommit: head, analyzedAt: new Date().toISOString(), dirty };
  fs.mkdirSync(kbDir(dir), { recursive: true });
  fs.writeFileSync(path.join(kbDir(dir), 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
  return state;
}

export function status(dir) {
  const state = readJson(path.join(kbDir(dir), 'state.json'));
  if (!state) return { initialized: false, stale: true, reason: 'No knowledge base yet. Run /codewright:init.' };
  if (git(dir, ['rev-parse', '--is-inside-work-tree']) === null) {
    return { initialized: true, git: false, stale: true, fullRescan: true, reason: 'Not a git repository, so changes cannot be tracked. Sync re-analyzes everything.' };
  }
  const head = git(dir, ['rev-parse', 'HEAD'])?.trim() ?? null;
  const changed = new Set();
  // Content analyzed while uncommitted counts as analyzed, whether it is still uncommitted or committed as-is.
  const sameAsAnalyzed = (f) => f in (state.dirty ?? {}) && state.dirty[f] === hashFile(dir, f);
  if (state.analyzedCommit && head && state.analyzedCommit !== head) {
    const diff = git(dir, ['diff', '--name-only', state.analyzedCommit, head]);
    if (diff === null) {
      return { initialized: true, stale: true, fullRescan: true, analyzedCommit: state.analyzedCommit, head, reason: 'The analyzed commit is no longer in history (rebase or reset). Sync re-analyzes everything.' };
    }
    diff.split('\n').filter((f) => f && !f.startsWith('.codewright/') && !sameAsAnalyzed(f)).forEach((f) => changed.add(f));
  }
  const dirtyNow = dirtyFiles(dir) ?? [];
  for (const f of dirtyNow) if (!sameAsAnalyzed(f)) changed.add(f);
  // Uncommitted at analysis time and clean now: either committed as analyzed, or reverted.
  for (const f of Object.keys(state.dirty ?? {})) if (!dirtyNow.includes(f) && !sameAsAnalyzed(f)) changed.add(f);

  const modules = readJson(path.join(kbDir(dir), 'modules.json'))?.modules ?? {};
  const matchers = Object.entries(modules).map(([name, m]) => [name, (m.paths ?? []).map(globToRegExp)]);
  const affected = new Set();
  const unmapped = [];
  for (const f of changed) {
    const hits = matchers.filter(([, res]) => res.some((re) => re.test(f))).map(([name]) => name);
    hits.forEach((h) => affected.add(h));
    if (!hits.length) unmapped.push(f);
  }
  return {
    initialized: true,
    stale: changed.size > 0,
    analyzedCommit: state.analyzedCommit,
    analyzedAt: state.analyzedAt,
    head,
    changed: [...changed].sort(),
    affectedModules: [...affected].sort(),
    unmapped: unmapped.sort(),
  };
}

function hook() {
  try {
    const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    if (!fs.existsSync(path.join(kbDir(dir), 'state.json'))) return;
    const s = status(dir);
    if (!s.stale) return;
    const what = s.fullRescan ? s.reason : `${s.changed.length} file(s) changed since the last analysis${s.affectedModules.length ? ` (modules: ${s.affectedModules.join(', ')})` : ''}.`;
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: `Codewright knowledge base is out of date: ${what} Suggest /codewright:sync to the user before starting a Codewright run.`,
      },
    }));
  } catch {} // a freshness hint must never break session start
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, dirArg] = process.argv.slice(2);
  const dir = path.resolve(dirArg ?? process.cwd());
  if (mode === 'hook') hook();
  else if (mode === 'stamp') console.log(JSON.stringify(stamp(dir), null, 2));
  else if (mode === 'status') console.log(JSON.stringify(status(dir), null, 2));
  else { console.error('usage: kb-state.mjs status|stamp [dir] | hook'); process.exit(2); }
}
