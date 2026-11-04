#!/usr/bin/env node
// Creates the project's .codewright/ folder. Idempotent: never overwrites the user's policy.
// Usage: node setup.mjs [--adapter <name>] [projectDir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RETIRED_RULES } from './guard.mjs';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function setup(projectDir, adapter) {
  const dir = path.join(projectDir, '.codewright');
  const created = [];
  for (const sub of ['knowledge', 'knowledge/modules', 'personas', 'runs', 'logs']) {
    const p = path.join(dir, sub);
    if (!fs.existsSync(p)) { fs.mkdirSync(p, { recursive: true }); created.push(`.codewright/${sub}/`); }
  }
  // The folder ignores itself, so the project's own .gitignore is never touched.
  const ignore = path.join(dir, '.gitignore');
  if (!fs.existsSync(ignore)) { fs.writeFileSync(ignore, '*\n'); created.push('.codewright/.gitignore'); }

  const policy = path.join(dir, 'permissions.json');
  const defaultsFile = path.join(SKILL_ROOT, 'defaults', 'permissions.json');
  let missingDefaultRules = [];
  let changedDefaultRules = [];
  let retiredRules = [];
  if (!fs.existsSync(policy)) {
    fs.copyFileSync(defaultsFile, policy);
    created.push('.codewright/permissions.json');
  } else {
    // The user's policy is never overwritten, so report default rules newer Codewright versions added or changed.
    try {
      const rules = (p) => new Map([...p.bash, ...p.paths].map((r) => [r.id, JSON.stringify(r)]));
      const have = rules(JSON.parse(fs.readFileSync(policy, 'utf8')));
      for (const [id, rule] of rules(JSON.parse(fs.readFileSync(defaultsFile, 'utf8')))) {
        if (!have.has(id)) missingDefaultRules.push(id);
        else if (have.get(id) !== rule) changedDefaultRules.push(id);
      }
      // Rules older versions shipped that proved unsafe; the guard already ignores them.
      retiredRules = [...have.keys()].filter((id) => RETIRED_RULES.has(id));
    } catch { missingDefaultRules = ['(could not read .codewright/permissions.json)']; }
  }

  // Agents can't read files outside the project without a prompt, so the chosen adapter is copied in.
  // It is skill-owned and refreshed on every init; project-specific facts belong in profile.json.
  if (adapter !== undefined) {
    const source = path.join(SKILL_ROOT, 'references', 'stacks', `${adapter}.md`);
    if (!/^[a-z]+$/.test(adapter) || !fs.existsSync(source)) throw new Error(`Unknown adapter "${adapter}"`);
    fs.copyFileSync(source, path.join(dir, 'adapter.md'));
    created.push(`.codewright/adapter.md (${adapter})`);
  }

  // Role definitions are skill-owned and refreshed every time, for the single-session fallback.
  // Default personas are copied only if missing, so the user's edits to them survive.
  fs.mkdirSync(path.join(dir, 'roles'), { recursive: true });
  for (const f of fs.readdirSync(path.join(SKILL_ROOT, 'agents'))) {
    fs.copyFileSync(path.join(SKILL_ROOT, 'agents', f), path.join(dir, 'roles', f));
  }
  for (const f of fs.readdirSync(path.join(SKILL_ROOT, 'personas'))) {
    const target = path.join(dir, 'personas', f);
    if (!fs.existsSync(target)) { fs.copyFileSync(path.join(SKILL_ROOT, 'personas', f), target); created.push(`.codewright/personas/${f}`); }
  }
  return { dir, created, missingDefaultRules, changedDefaultRules, retiredRules };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--adapter');
  const adapter = i >= 0 ? args.splice(i, 2)[1] : undefined;
  console.log(JSON.stringify(setup(path.resolve(args[0] ?? process.cwd()), adapter), null, 2));
}
