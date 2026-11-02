#!/usr/bin/env node
// Removes Codewright run history, or the whole .codewright/ folder with --all.
// Usage: node clean.mjs [--all] [projectDir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function clean(projectDir, all) {
  const dir = path.join(projectDir, '.codewright');
  if (!fs.existsSync(dir)) return { removed: [] };
  const targets = all ? [dir] : ['runs', 'logs'].map((s) => path.join(dir, s));
  const removed = targets.filter((t) => fs.existsSync(t));
  for (const t of removed) fs.rmSync(t, { recursive: true, force: true });
  if (!all) for (const s of ['runs', 'logs']) fs.mkdirSync(path.join(dir, s), { recursive: true });
  return { removed: removed.map((t) => path.relative(projectDir, t) || t) };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const projectDir = path.resolve(args.find((a) => a !== '--all') ?? process.cwd());
  console.log(JSON.stringify(clean(projectDir, all), null, 2));
}
