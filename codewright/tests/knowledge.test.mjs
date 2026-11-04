import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { detectStack } from '../skill/scripts/detect-stack.mjs';
import { stamp, status } from '../skill/scripts/kb-state.mjs';

const KB_STATE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'skill', 'scripts', 'kb-state.mjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cw-kb-'));
const write = (dir, file, content = '') => {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), content);
};
const git = (dir, ...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: dir, stdio: 'ignore' });

test('detects Laravel first, with its locked version', () => {
  const d = tmp();
  write(d, 'artisan');
  write(d, 'composer.json', JSON.stringify({ require: { 'laravel/framework': '^11.0' } }));
  write(d, 'composer.lock', JSON.stringify({ packages: [{ name: 'laravel/framework', version: 'v11.31.0' }] }));
  write(d, 'package.json', JSON.stringify({ devDependencies: { vite: '5' } }));
  const r = detectStack(d);
  assert.equal(r.stack, 'laravel');
  assert.equal(r.adapter, 'laravel');
  assert.equal(r.version, 'v11.31.0');
  assert.deepEqual(r.candidates.map((c) => c.stack), ['laravel', 'node']);
});

test('artisan without laravel/framework is not Laravel', () => {
  const d = tmp();
  write(d, 'artisan');
  write(d, 'composer.json', JSON.stringify({ require: { php: '^8.2' } }));
  assert.equal(detectStack(d).stack, null);
});

test('each stack gets its own adapter; unknown projects get the generic one', () => {
  const cases = [
    [{ 'api.csproj': '' }, 'dotnet'],
    [{ 'pom.xml': '' }, 'java'],
    [{ 'manage.py': '' }, 'django'],
    [{ 'pubspec.yaml': 'dependencies:\n  flutter:\n    sdk: flutter\n' }, 'flutter'],
    [{ 'package.json': JSON.stringify({ dependencies: { react: '18' } }) }, 'react'],
    [{ 'package.json': JSON.stringify({ dependencies: { express: '4' } }) }, 'node'],
    [{ 'README.md': 'hi' }, null],
  ];
  for (const [files, expected] of cases) {
    const d = tmp();
    for (const [f, c] of Object.entries(files)) write(d, f, c);
    const r = detectStack(d);
    assert.equal(r.stack, expected, JSON.stringify(files));
    assert.equal(r.adapter, expected ?? 'generic');
    if (expected) assert.ok(fs.existsSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'skill', 'references', 'stacks', `${expected}.md`)));
  }
});

function repo() {
  const d = tmp();
  git(d, 'init', '-q');
  write(d, 'app/Models/Order.php', 'v1');
  write(d, 'app/Models/User.php', 'v1');
  write(d, 'routes/api.php', 'v1');
  git(d, 'add', '.');
  git(d, 'commit', '-qm', 'base');
  write(d, '.codewright/.gitignore', '*\n');
  write(d, '.codewright/knowledge/modules.json', JSON.stringify({
    modules: { orders: { paths: ['app/Models/Order.php', 'app/Http/Controllers/**/Order*'] }, users: { paths: ['app/Models/User.php'] } },
  }));
  return d;
}

test('kb status: uninitialized, then fresh after stamp', () => {
  const d = repo();
  assert.equal(status(d).initialized, false);
  stamp(d);
  const s = status(d);
  assert.equal(s.stale, false);
  assert.deepEqual(s.changed, []);
});

test('kb status: commits and uncommitted edits map to modules', () => {
  const d = repo();
  stamp(d);
  write(d, 'app/Models/Order.php', 'v2');
  git(d, 'commit', '-qam', 'change order');
  write(d, 'app/Http/Controllers/Admin/OrderController.php', 'new');
  write(d, 'config/app.php', 'new');
  write(d, '.claude/skills/codewright/SKILL.md', 'tooling, not app code');
  const s = status(d);
  assert.equal(s.stale, true);
  assert.deepEqual(s.changed, ['app/Http/Controllers/Admin/OrderController.php', 'app/Models/Order.php', 'config/app.php']);
  assert.deepEqual(s.affectedModules, ['orders']);
  assert.deepEqual(s.unmapped, ['config/app.php']);
});

test('kb status: an uncommitted file analyzed as-is stays fresh until it changes again', () => {
  const d = repo();
  write(d, 'app/Models/User.php', 'dirty');
  stamp(d);
  assert.equal(status(d).stale, false);
  write(d, 'app/Models/User.php', 'dirty again');
  assert.deepEqual(status(d).changed, ['app/Models/User.php']);
  write(d, 'app/Models/User.php', 'v1'); // reverted to committed content
  assert.deepEqual(status(d).changed, ['app/Models/User.php']);
});

test('kb status: rewritten history asks for a full rescan', () => {
  const d = repo();
  write(d, 'routes/api.php', 'v2');
  git(d, 'commit', '-qam', 'second');
  stamp(d);
  git(d, 'reset', '-q', '--hard', 'HEAD~1');
  git(d, 'reflog', 'expire', '--expire=now', '--all');
  git(d, 'gc', '-q', '--prune=now');
  assert.equal(status(d).fullRescan, true);
});

test('session hook: silent when fresh, hints when stale', () => {
  const d = repo();
  stamp(d);
  const run = () => spawnSync('node', [KB_STATE, 'hook'], { encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: d } }).stdout;
  assert.equal(run(), '');
  write(d, 'app/Models/Order.php', 'v3');
  const ctx = JSON.parse(run()).hookSpecificOutput.additionalContext;
  assert.match(ctx, /1 file\(s\) changed.*orders.*\/codewright sync/);
});
