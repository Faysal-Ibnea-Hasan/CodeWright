import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { active, addFindings, end, newRun, setStatus, summary } from '../skill/scripts/run.mjs';
import { setup } from '../skill/scripts/setup.mjs';
import { stamp, status } from '../skill/scripts/kb-state.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cw-run-'));
const NOW = new Date('2026-11-02T08:15:00Z');

test('new run creates a dated folder, marks it active, and refuses a second', () => {
  const d = tmp();
  setup(d);
  const runDir = newRun(d, 'Add vendor payout approval!', NOW);
  assert.equal(path.basename(runDir), '20261102-0815-add-vendor-payout-approval');
  assert.ok(fs.existsSync(path.join(runDir, 'chunks')));
  assert.equal(active(d), runDir);
  assert.throws(() => newRun(d, 'other', NOW), /already active/);
  end(d);
  assert.equal(active(d), null);
  assert.match(path.basename(newRun(d, 'Add vendor payout approval!', NOW)), /-2$/);
});

test('an active marker pointing at a deleted run is ignored', () => {
  const d = tmp();
  setup(d);
  const runDir = newRun(d, 'x', NOW);
  fs.rmSync(runDir, { recursive: true });
  assert.equal(active(d), null);
});

test('findings are validated, numbered per chunk, and drive the gate verdict', () => {
  const d = tmp();
  setup(d);
  const runDir = newRun(d, 't', NOW);
  assert.throws(() => addFindings(runDir, 1, 'guardian', [{ severity: 'urgent', title: 'x', evidence: 'a.php:1' }]), /severity/);
  assert.throws(() => addFindings(runDir, 1, 'guardian', [{ severity: 'major', title: '', evidence: 'a.php:1' }]), /title/);
  assert.throws(() => addFindings(runDir, 1, 'guardian', { severity: 'major' }), /array/);

  const added = addFindings(runDir, 1, 'architecture-guardian', [
    { severity: 'major', title: 'Logic in controller', evidence: 'app/Http/Controllers/PayoutController.php:40' },
    { severity: 'minor', title: 'Naming', evidence: 'app/Services/Payout.php:3' },
  ]);
  assert.deepEqual(added.map((f) => f.id), ['C1-F1', 'C1-F2']);
  addFindings(runDir, 1, 'behavior-verifier', [{ severity: 'blocker', title: 'Wallet debited twice', evidence: 'tests/Feature/PayoutTest.php', repro: 'php artisan test --filter=PayoutTest' }]);
  addFindings(runDir, 2, 'architecture-guardian', { verdict: 'run', checked: ['AC1 → src/app.js:30'], findings: [] });
  assert.throws(() => addFindings(runDir, 2, 'x', { verdict: 'run' }), /findings/);

  let s = summary(runDir);
  assert.deepEqual(s.chunks['1'].open, { blocker: 1, major: 1, minor: 1 });
  assert.equal(s.chunks['1'].pass, false);
  assert.equal(s.pass, false);

  setStatus(runDir, 'C1-F1', 'fixed');
  setStatus(runDir, 'C1-F3', 'fixed');
  assert.equal(setStatus(runDir, 'C1-F2', 'accepted', 'Decision 2 in spec.md').reason, 'Decision 2 in spec.md');
  assert.throws(() => setStatus(runDir, 'C1-F9', 'fixed'), /No finding/);
  assert.throws(() => setStatus(runDir, 'C1-F2', 'done'), /status/);
  s = summary(runDir);
  assert.equal(s.chunks['1'].pass, true);
  assert.equal(s.pass, true);
});

test('kb status: files analyzed while uncommitted stay fresh once committed as-is', () => {
  const d = tmp();
  const git = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: d, stdio: 'ignore' });
  git('init', '-q');
  fs.writeFileSync(path.join(d, 'a.php'), 'v1');
  git('add', '.');
  git('commit', '-qm', 'base');
  setup(d);
  fs.writeFileSync(path.join(d, 'a.php'), 'v2 from a codewright run');
  fs.writeFileSync(path.join(d, 'b.php'), 'new file');
  stamp(d);
  git('add', '.');
  git('commit', '-qm', 'user commits the run');
  assert.deepEqual(status(d).changed, []);
  fs.writeFileSync(path.join(d, 'a.php'), 'v3');
  assert.deepEqual(status(d).changed, ['a.php']);
});
