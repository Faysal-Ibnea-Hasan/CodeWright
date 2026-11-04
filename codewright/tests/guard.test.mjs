import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decideBash, decidePath, evaluate, helperAllowRules, profileAllowRules, splitSegments } from '../skill/scripts/guard.mjs';
import { setup } from '../skill/scripts/setup.mjs';
import { clean } from '../skill/scripts/clean.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'skill');
const GUARD = path.join(ROOT, 'scripts', 'guard.mjs');
const policy = JSON.parse(fs.readFileSync(path.join(ROOT, 'defaults', 'permissions.json'), 'utf8'));
const bash = (cmd) => decideBash(cmd, policy, helperAllowRules())?.decision ?? null;
const tmpProject = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cw-test-'));

const cases = {
  deny: [
    'git push --force origin main',
    'git push -f',
    'git push origin +main',
    'git -C repo push --force-with-lease',
    'php artisan migrate:fresh --seed',
    'php artisan db:wipe',
    'python manage.py flush',
    'echo {} > .codewright/permissions.json',
    'cat a.json > .codewright/permissions.json',
    'cp other.json .codewright/permissions.json',
    'echo "{}" > .codewright/profile.json',
    'echo APP_KEY=x >> .env',
    'cp .env.example .env',
    "sed -i 's/a/b/' .env",
    'git commit -m x && git push --force',
    'php artisan \\\nmigrate:fresh --seed',
    'git push \\\n--force origin main',
    'php artisan migrate:fresh # --env=testing',
    'command git push --force',
    'echo x >| .env',
    'echo x>.env',
    'sed -e s/a/b/ -i .env',
    'perl -pi -e s/a/b/ .env',
    'ln -sf /x .env',
    'echo x >> .env.local',
    'git diff --output=.env',
  ],
  ask: [
    'git commit -m "wip"',
    'git add .',
    'git -c user.name=bot commit -m x',
    'git stash',
    'git checkout main',
    'git branch feature-x',
    'git reset --hard HEAD~1',
    'git fetch origin',
    'cd app && git commit -m x',
    'bash -c "git commit -m x"',
    'echo $(git commit -m x)',
    'composer require spatie/laravel-permission',
    'npm install lodash',
    'flutter pub add http',
    'php artisan migrate',
    'php artisan migrate:rollback',
    'rm -rf storage/framework/cache',
    'git status && rm -rf build',
    'php artisan test; git commit -m x',
    'git -c "user.name=Claude Code" commit -m x',
    'git -C "my dir" push origin main',
    'git -C /repo \\\ncommit -m x',
    'git commit -m "add git stash show support"',
    'git commit --amend --no-edit',
    'git switch -c feature',
    'env git push origin main',
    'git remote add origin git@github.com:x/y.git',
    'git reflog expire --all',
    // A message that mentions a denied command is still only a commit: ask, not deny.
    'git commit -m "fix: never git push -f from CI"',
    'git commit -m "docs: add cp .env.example .env to setup"',
    "git commit -m \"$(cat <<'EOF'\nfix: never git push -f\nEOF\n)\"",
    // Quoted text can hide a real command, so it still asks.
    'bash -c "git push --force"',
    `git push ${'x '.repeat(4500)}`,
  ],
  allow: [
    'git status',
    'git diff HEAD~1 -- app/',
    'git --no-pager log -5 --oneline',
    'git status && git diff',
    'cd /tmp/shop && git diff',
    'php artisan test 2>&1',
    'vendor/bin/pest --filter OrderTest',
    './vendor/bin/pint --test',
    'flutter test',
    'npm run test:unit',
    'git log | head',
    'npm test 2>&1 | tail -20',
    'git status --porcelain | wc -l',
    'php artisan route:list --json --path=api',
    `node "${ROOT}/scripts/kb-state.mjs" stamp`,
    `node ${ROOT}/scripts/detect-stack.mjs`,
    `node "${ROOT}/scripts/setup.mjs" --adapter laravel`,
    `node "${ROOT}/scripts/run.mjs" summary .codewright/runs/20261102-0815-x`,
    './gradlew test',
    'mvn clean test',
  ],
  none: [
    'ls -la',
    'echo "commit"',
    'git branch --show-current',
    'git stash list',
    'git config --get user.name',
    'npm install',
    'npm ci',
    'php artisan migrate --env=testing',
    'APP_ENV=testing php artisan db:wipe',
    'php artisan migrate:fresh --env=testing',
    'cp .env.example .env.testing',
    'cat .codewright/permissions.json',
    'cat .env',
    'git diff > out.patch',
    'git log --output=out.txt',
    'mvn test deploy',
    'gradle test publish',
    'npm run test-and-deploy',
    'php artisan test:purge-prod',
    'git remote -v',
    // Only Codewright's own helpers are auto-allowed, and only their read-only or setup modes.
    'node ./scripts/setup.mjs',
    `node ${ROOT}/scripts/clean.mjs --all`,
    `node ${ROOT}/scripts/kb-state.mjs stamp > out.txt`,
    // Only the real plugin location counts, not any path containing "codewright".
    'node /tmp/codewright-evil/scripts/http.mjs request GET /a',
    // Quote tracking must follow bash, so none of these smuggle a second command past an allow rule.
    "npm test \\' ; touch pwned ; \\'",
    "git status \\' ; touch pwned ; \\'",
    "npm test $'\\'' ; touch pwned ; #'",
    'npm test <(touch pwned)',
    `node ${ROOT}/scripts/http.mjs request GET /a <(touch pwned)`,
    'npm test x >&2out',
    'npm test x >/dev/null2',
    'npm test "unbalanced',
  ],
};

test('pathological inputs stay fast', () => {
  for (const cmd of [`git push ${'a '.repeat(3900)}`, `git${' -C -C'.repeat(500)}`, `echo ${'> '.repeat(3000)}.envx`]) {
    const start = process.hrtime.bigint();
    bash(cmd);
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    assert.ok(ms < 1000, `${cmd.slice(0, 30)}… took ${ms.toFixed(0)}ms`);
  }
});

for (const [expected, commands] of Object.entries(cases)) {
  for (const cmd of commands) {
    test(`bash ${expected}: ${cmd}`, () => assert.equal(bash(cmd), expected === 'none' ? null : expected));
  }
}

test('profile commands the user confirmed are allowed, templates included; nothing else rides on them', () => {
  const extra = profileAllowRules({ commands: {
    test: 'npm test',
    testFilter: 'node --test --test-name-pattern={name} test/*.test.js',
    lint: null,
    serve: 'PORT=8765 npm start',
  } });
  const d = (cmd) => decideBash(cmd, policy, extra)?.decision ?? null;
  assert.equal(d('node --test --test-name-pattern=cancel test/*.test.js'), 'allow');
  assert.equal(d('cd /tmp/shop && node --test --test-name-pattern=cancel test/*.test.js'), 'allow');
  assert.equal(d('npm test -- --verbose'), 'allow');
  assert.equal(d('node --test --test-name-pattern=x test/*.test.js; rm -rf /'), 'ask');
  assert.equal(d('node --test test/other.js'), null);
  assert.equal(d('PORT=8765 npm start'), null); // serve isn't auto-allowed
  assert.equal(d('npm test > out.txt'), null);
  assert.deepEqual(profileAllowRules(null), []);
});

test('splitSegments keeps 2>&1 out of the pieces', () => {
  assert.deepEqual(splitSegments('php artisan test 2>&1 && git status'), ['php artisan test', 'git status']);
});

test('paths: env files, policy file, outside project, symlink escape', () => {
  const root = tmpProject();
  const outside = tmpProject();
  fs.symlinkSync(outside, path.join(root, 'link'));
  const p = (file, extra = []) => decidePath(file, root, policy, extra)?.decision ?? null;

  assert.equal(p('.env'), 'deny');
  assert.equal(p('config/.env.production'), 'deny');
  assert.equal(p('.env.testing'), null);
  assert.equal(p('.env.example'), null);
  assert.equal(p('.codewright/permissions.json'), 'deny');
  assert.equal(p('.codewright/profile.json'), 'ask');
  assert.equal(p('.codewright/app.json'), 'deny');
  assert.equal(p('app/Models/Order.php'), null);
  assert.equal(p(path.join(root, 'routes/api.php')), null);
  assert.equal(p('/etc/hosts'), 'deny');
  assert.equal(p('../elsewhere/file.txt'), 'deny');
  assert.equal(p('link/inside-looking.txt'), 'deny');
  assert.equal(p(path.join(os.homedir(), '.claude', 'notes.md')), null);
  assert.equal(p(path.join(outside, 'scratch.txt'), [`${outside.split(path.sep).join('/')}/**`]), null);
});

test('enforce during-runs only applies while a run is active', () => {
  const root = tmpProject();
  setup(root);
  const file = path.join(root, '.codewright', 'permissions.json');
  fs.writeFileSync(file, JSON.stringify({ ...policy, enforce: 'during-runs' }));
  const input = { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } };
  assert.equal(evaluate(input, root), null);
  fs.writeFileSync(path.join(root, '.codewright', 'runs', '.active'), '');
  assert.equal(evaluate(input, root).decision, 'ask');
});

const runGuard = (input, root) => spawnSync('node', [GUARD], {
  input: JSON.stringify(input),
  encoding: 'utf8',
  env: { ...process.env, CLAUDE_PROJECT_DIR: root },
});

test('hook end to end: ask is printed, logged, and silent calls print nothing', () => {
  const root = tmpProject();
  setup(root);
  const ask = runGuard({ tool_name: 'Bash', tool_input: { command: 'git commit -m x' }, agent_type: 'implementer' }, root);
  const out = JSON.parse(ask.stdout).hookSpecificOutput;
  assert.equal(out.permissionDecision, 'ask');
  assert.match(out.permissionDecisionReason, /git-write/);
  const logLine = JSON.parse(fs.readFileSync(path.join(root, '.codewright', 'logs', 'guard.jsonl'), 'utf8').trim());
  assert.equal(logLine.agent, 'implementer');

  const quiet = runGuard({ tool_name: 'Bash', tool_input: { command: 'ls' } }, root);
  assert.equal(quiet.stdout, '');
  assert.equal(quiet.status, 0);
});

test('hook fails toward asking when the policy is broken', () => {
  const root = tmpProject();
  setup(root);
  fs.writeFileSync(path.join(root, '.codewright', 'permissions.json'), '{ not json');
  const res = runGuard({ tool_name: 'Bash', tool_input: { command: 'ls' } }, root);
  assert.equal(JSON.parse(res.stdout).hookSpecificOutput.permissionDecision, 'ask');
});

test('hook stays silent in projects without .codewright, and uses the bundled defaults once it exists', () => {
  const root = tmpProject();
  const edit = { tool_name: 'Edit', tool_input: { file_path: '.env' } };
  assert.equal(runGuard(edit, root).stdout, '');
  assert.equal(runGuard({ tool_name: 'Bash', tool_input: { command: 'git commit -m x' } }, root).stdout, '');
  fs.mkdirSync(path.join(root, '.codewright'));
  assert.equal(JSON.parse(runGuard(edit, root).stdout).hookSpecificOutput.permissionDecision, 'deny');
});

test('setup is idempotent and never overwrites an edited policy', () => {
  const root = tmpProject();
  const first = setup(root);
  assert.ok(first.created.includes('.codewright/permissions.json'));
  assert.equal(fs.readFileSync(path.join(root, '.codewright', '.gitignore'), 'utf8'), '*\n');
  const file = path.join(root, '.codewright', 'permissions.json');
  fs.writeFileSync(file, '{"edited":true}');
  assert.ok(fs.existsSync(path.join(root, '.codewright', 'roles', 'planner.md')));
  assert.ok(fs.existsSync(path.join(root, '.codewright', 'personas', 'careless-user.md')));
  const persona = path.join(root, '.codewright', 'personas', 'careless-user.md');
  fs.writeFileSync(persona, '# edited by the user');
  assert.deepEqual(setup(root).created, []);
  assert.equal(fs.readFileSync(file, 'utf8'), '{"edited":true}');
  assert.equal(fs.readFileSync(persona, 'utf8'), '# edited by the user');
});

test('setup reports default rules an older project policy lacks', () => {
  const root = tmpProject();
  setup(root);
  const file = path.join(root, '.codewright', 'permissions.json');
  const retired = { id: 'codewright-scripts', decision: 'allow', pattern: '^\\s*node\\s+\\S*codewright\\S*', reason: 'old' };
  fs.writeFileSync(file, JSON.stringify({ ...policy, bash: [...policy.bash, retired], paths: policy.paths.filter((r) => r.id !== 'edit-app-state') }));
  const r = setup(root);
  assert.deepEqual(r.missingDefaultRules, ['edit-app-state']);
  assert.deepEqual(r.retiredRules, ['codewright-scripts']);
  // The guard ignores the retired rule even though the project policy still has it.
  assert.equal(evaluate({ tool_name: 'Bash', tool_input: { command: 'node /tmp/codewright-evil/x.mjs' } }, root), null);
  fs.writeFileSync(file, JSON.stringify(policy));
  assert.deepEqual(setup(root).missingDefaultRules, []);
});

test('setup copies a known adapter into the project and rejects unknown names', () => {
  const root = tmpProject();
  setup(root, 'laravel');
  assert.match(fs.readFileSync(path.join(root, '.codewright', 'adapter.md'), 'utf8'), /^# Laravel adapter/);
  assert.throws(() => setup(root, '../../etc/passwd'), /Unknown adapter/);
  assert.throws(() => setup(root, 'cobol'), /Unknown adapter/);
});

test('clean keeps the knowledge base; --all removes everything', () => {
  const root = tmpProject();
  setup(root);
  fs.writeFileSync(path.join(root, '.codewright', 'runs', 'r1.md'), 'x');
  fs.writeFileSync(path.join(root, '.codewright', 'knowledge', 'INDEX.md'), 'x');
  clean(root, false);
  assert.equal(fs.existsSync(path.join(root, '.codewright', 'runs', 'r1.md')), false);
  assert.equal(fs.existsSync(path.join(root, '.codewright', 'knowledge', 'INDEX.md')), true);
  clean(root, true);
  assert.equal(fs.existsSync(path.join(root, '.codewright')), false);
});
