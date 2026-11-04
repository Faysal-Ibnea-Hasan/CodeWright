import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { addHooks, removeHooks } from '../skill/scripts/settings.mjs';

const SETTINGS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'skill', 'scripts', 'settings.mjs');
const run = (...args) => spawnSync('node', [SETTINGS, ...args], { encoding: 'utf8' });

const users = () => ({
  model: 'opus',
  permissions: { allow: ['Bash(npm test)'] },
  hooks: {
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'my-own-check.sh' }] }],
    PostToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'prettier.sh' }] }],
  },
});

test('install adds both hooks, keeps the user\'s own settings, and is idempotent', () => {
  const data = addHooks(addHooks(users(), '$HOME/.claude/skills/codewright'), '$HOME/.claude/skills/codewright');
  assert.equal(data.model, 'opus');
  assert.deepEqual(data.permissions, { allow: ['Bash(npm test)'] });
  assert.equal(data.hooks.PreToolUse.length, 2);
  assert.equal(data.hooks.PreToolUse[0].hooks[0].command, 'my-own-check.sh');
  assert.equal(data.hooks.PreToolUse[1].hooks[0].command, 'node "$HOME/.claude/skills/codewright/scripts/guard.mjs"');
  assert.equal(data.hooks.SessionStart.length, 1);
  assert.match(data.hooks.SessionStart[0].hooks[0].command, /kb-state\.mjs" hook$/);
  assert.deepEqual(data.hooks.PostToolUse, users().hooks.PostToolUse);
});

test('uninstall removes only Codewright\'s hooks and empty containers', () => {
  assert.deepEqual(removeHooks(addHooks(users(), '$CLAUDE_PROJECT_DIR/.claude/skills/codewright')), users());
  assert.deepEqual(removeHooks(addHooks({}, '$HOME/.claude/skills/codewright')), {});
  // A group shared with someone else's hook keeps theirs.
  const shared = { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node "$HOME/.claude/skills/codewright/scripts/guard.mjs"' }, { type: 'command', command: 'mine.sh' }] }] } };
  assert.deepEqual(removeHooks(shared).hooks.PreToolUse[0].hooks, [{ type: 'command', command: 'mine.sh' }]);
});

test('cli: creates the file, refuses invalid JSON without touching it, uninstall of a missing file is a no-op', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-settings-'));
  const file = path.join(dir, '.claude', 'settings.json');
  assert.equal(run('install', file, '$HOME/.claude/skills/codewright').status, 0);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).hooks.PreToolUse.length, 1);
  assert.equal(run('uninstall', file).status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), {});

  fs.writeFileSync(file, '{ broken');
  const bad = run('install', file, '$HOME/.claude/skills/codewright');
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /isn't valid JSON/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{ broken');

  assert.equal(run('uninstall', path.join(dir, 'nope.json')).status, 0);
  assert.equal(fs.existsSync(path.join(dir, 'nope.json')), false);
  assert.equal(run('install', file, 'bad"path').status, 1);
});
