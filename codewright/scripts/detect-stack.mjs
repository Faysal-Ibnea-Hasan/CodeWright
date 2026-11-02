#!/usr/bin/env node
// Detects the project's stack from marker files. Laravel is checked first.
// Usage: node detect-stack.mjs [projectDir]  → JSON
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STACKS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'references', 'stacks');
// A stack with no adapter file of its own uses the generic adapter.
const hasAdapter = (stack) => fs.existsSync(path.join(STACKS_DIR, `${stack}.md`));

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const readText = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };

export function detectStack(dir) {
  const has = (f) => fs.existsSync(path.join(dir, f));
  // shortcut: only the project root is scanned, so a monorepo with the app in a subfolder needs the user to pick the stack.
  const files = fs.readdirSync(dir);
  const composer = readJson(path.join(dir, 'composer.json'));
  const pkg = readJson(path.join(dir, 'package.json'));
  const pkgDeps = { ...pkg?.dependencies, ...pkg?.devDependencies };

  const checks = [
    ['laravel', 'backend', () => has('artisan') && composer?.require?.['laravel/framework'] && ['artisan', 'composer.json requires laravel/framework']],
    ['dotnet', 'backend', () => { const f = files.filter((n) => /\.(csproj|sln)$/.test(n)); return f.length && f; }],
    ['java', 'backend', () => { const f = ['pom.xml', 'build.gradle', 'build.gradle.kts'].filter(has); return f.length && f; }],
    ['django', 'backend', () => has('manage.py') && ['manage.py']],
    ['flutter', 'frontend-mobile', () => /sdk:\s*flutter/.test(readText(path.join(dir, 'pubspec.yaml'))) && ['pubspec.yaml depends on flutter']],
    ['react', 'frontend-mobile', () => pkgDeps.react && ['package.json depends on react']],
    ['node', 'backend', () => pkg && ['package.json']],
  ];

  const candidates = [];
  for (const [stack, category, check] of checks) {
    const evidence = check();
    if (evidence) candidates.push({ stack, category, evidence });
  }
  const top = candidates[0] ?? null;
  const result = {
    stack: top?.stack ?? null,
    category: top?.category ?? null,
    adapter: top && hasAdapter(top.stack) ? top.stack : 'generic',
    evidence: top?.evidence ?? [],
    candidates,
  };
  if (top?.stack === 'laravel') {
    const lock = readJson(path.join(dir, 'composer.lock'));
    result.version = lock?.packages?.find((p) => p.name === 'laravel/framework')?.version
      ?? composer.require['laravel/framework'];
  }
  return result;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(detectStack(path.resolve(process.argv[2] ?? process.cwd())), null, 2));
}
