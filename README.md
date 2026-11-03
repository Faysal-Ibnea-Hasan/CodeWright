# Codewright

**A full software engineering team for Claude Code.** Codewright takes a task, from a one-line bug fix to a cross-module feature, and runs it through sixteen specialist roles that research it, plan it, build it, test it, attack it, run it, use it the way real users would, and report on it. You approve the plan before any code is written and review the result before anything is committed. Git stays in your hands the whole time.

```
/codewright:run Let customers cancel their own pending orders
```

## Why Codewright

Most AI coding workflows have one agent write the code and then mark its own homework. Codewright splits the work the way a real engineering team does, and keeps the roles independent:

- **Tests come from the spec, not the code.** The Planner writes an exact contract; the Test Designer and the Implementer build against it at the same time, so the tests never see the code they test.
- **Someone tries to break it.** The Adversary attacks every change and delivers failing tests, not opinions.
- **It runs for real.** The Runtime Monitor starts the app on a test port and hits every affected route as every role, watching for 500s and logged exceptions.
- **Real users try it.** Personas (a first-timer, a careless user, a curious user trying admin URLs, and more) use the running app through its API or a real browser.
- **Nothing is waved through.** Gate verdicts come from a script that counts open findings, not from an agent's judgment, and SQA signs off only on evidence.
- **The product stays coherent.** A Product Manager guards business rules across runs; a Senior Supervisor audits every agent, issues binding corrections, and records what the process should do better next time.
- **Nothing reaches git without you.** A guard hook keeps every agent away from git writes, real `.env` files and destructive database commands.

## How a run works

```
0 Intake      git status, active-run check, run folder
1 Context     knowledge base synced if code changed; Researcher for unfamiliar tech
2 Plan        spec, acceptance criteria tagged api / web, exact contract, chunks,
              role relevance matrix → Product Manager scope review, SQA criteria
              review, Supervisor plan check
              ── Gate 1: you answer open questions and approve the plan ──
              baseline: the test suite before any change
3 Build       per chunk: tests ∥ implementation → tests, lint, analysis
              → Behavior Verifier + Architecture Guardian → Adversary
              → app restarted, Runtime Monitor sweep → Supervisor check
              (max 3 fix loops, then it asks you)
4 Integrate   full suite vs baseline, final runtime sweep, SQA sign-off,
              Product Manager integrity review
5 Acceptance  personas and UI/UX QA against the running app
6 Report      Supervisor retrospective, Reporter's report and commit message
              ── Gate 2: you review and commit ──
              knowledge base updated with what changed
```

Every role checks whether it's needed before it runs, so a small fix doesn't pay for a full team. A quality floor can't be skipped when code changes: the Test Designer, SQA sign-off, and at least one reviewer. Every step is recorded in the run's ledger, which the Senior Supervisor audits.

Three size modes set how much of the team runs. The Planner proposes one and you can override it with `--mode`:

| Mode | Typical task | Reviews, attack, runtime | Personas |
| --- | --- | --- | --- |
| Small | Bug fix, 1–3 files | Once | None |
| Medium | Feature in one module | Per chunk | 2, picked for the change |
| Large | Cross-module feature | Per chunk | All defaults + your own |

## The team

| Role | Job |
| --- | --- |
| Orchestrator | Runs the workflow, holds the gates, keeps the ledger, escalates to you |
| Senior Supervisor | Audits every actor at checkpoints, issues binding corrections, writes the retrospective |
| Product Manager | Owns the product profile; reviews scope before Gate 1 and business-logic integrity before Gate 2 |
| System Analyst | Builds and maintains the project knowledge base, so agents don't re-read the codebase |
| Researcher | Researches external libraries, APIs and standards, matched to your lockfile versions |
| Planner | Spec, testable acceptance criteria, exact contract, chunks, which roles run |
| Implementer | Writes the code, one chunk at a time, in your codebase's conventions |
| Test Designer | Writes tests from the acceptance criteria, never from the code; turns every bug found into a regression test |
| Adversary | Attacks the change (authorization, validation, business rules, repetition, injection, money) with failing tests |
| Behavior Verifier | Checks diffs against business rules and the pre-run baseline; catches weakened tests |
| Architecture Guardian | Checks diffs against your architecture and conventions, and for duplicated helpers |
| Runtime Monitor | Hits affected routes on the running app as every role; reports 5xx, logged exceptions and slow responses |
| SQA | Reviews criteria for testability, builds the traceability matrix, and signs off only on evidence |
| UI/UX QA | Checks changed screens against Figma or your design system at 375, 768 and 1280 pixels |
| End User | Plays each persona against the running app, through the API or a real browser |
| Reporter | Writes the report and suggested commit message from the run's records |

Reviewers can't edit code: only the Implementer, Test Designer and Adversary change project files, and the Adversary only writes tests.

### Personas

Six defaults ship in `.codewright/personas/`: **first-timer**, **power user**, **careless user** (double-submits, back mid-form, refresh during save), **returning user** (expired session, stale data), **role-boundary user** (tries other roles' URLs and other users' IDs) and **accessibility and mobile user** (keyboard only, 375 pixels, 200% zoom). Edit them, or add your own: a cashier for a POS, a rider for a delivery app. Each is a short Markdown file; large mode runs them all.

### Stacks

Codewright detects your stack, Laravel first, and uses an adapter with its commands, test environment, layout, conventions and risk hotspots: **Laravel**, **.NET**, **Java** (Spring, Maven or Gradle), **Node**, **Django**, **React** and **Flutter**, plus a **generic** adapter for anything else that discovers commands from your CI, task runners and docs.

## Install

Codewright installs from this repository, which doubles as its own plugin marketplace. Replace `<github-user>` with the account that hosts it.

### With the install script

From your project's folder:

```bash
curl -fsSL https://raw.githubusercontent.com/<github-user>/codewright/main/install.sh | bash -s -- --source <github-user>/codewright
```

Or from a clone of this repository, run from your project's folder:

```bash
/path/to/codewright/install.sh
```

Run it from your project's **root** folder (where `artisan` or `package.json` is). It refuses to run from a subfolder of a git repository, because Codewright keeps test credentials in `.codewright/` and a subfolder like Laravel's `public/` is served to the web; add `--here` only if the subfolder really is a separate project.

Options: `--scope local` (default: only you, this project), `--scope project` (everyone on the project, via `.claude/settings.json`), `--scope user` (you, every project), and `--browser` to also install Chrome for browser personas. The script checks for Claude Code and Node.js, adds or refreshes the marketplace, and installs the plugin. Run it again to update. On Windows, run it from Git Bash or WSL, or use the commands below.

### With Claude Code commands

Inside Claude Code:

```
/plugin marketplace add <github-user>/codewright
/plugin install codewright@codewright
```

Or from your shell, choosing where it applies:

```bash
claude plugin marketplace add <github-user>/codewright

# For everyone on the project (written to .claude/settings.json)
claude plugin install codewright@codewright --scope project

# Only for you, in this project (written to .claude/settings.local.json)
claude plugin install codewright@codewright --scope local
```

To try a local checkout without installing: `claude --plugin-dir ./codewright`.

### Requirements

- Claude Code with plugin support
- **Node.js 18.19 or newer**, which runs the permission guard and the helpers
- git (read access only; Codewright never writes to it)
- Your project's own toolchain, and a **testing environment** separate from your real data (for Laravel, `.env.testing` with its own database)
- For browser personas and UI/UX QA: a Chrome or Chromium browser that Playwright can drive (`npx playwright install chrome`). Without it, personas test through the API

## Quick start

```
/codewright:init
```

Init walks you through setup:

1. It checks `git status` and recommends committing first, so everything Codewright changes is one clean diff.
2. It creates `.codewright/` with your editable permission policy.
3. It detects your stack and confirms the project's test, lint, analysis and run commands with you, plus test accounts for each role.
4. It shows an estimate, then runs the deep scan: the System Analyst maps the project, analyzes each module in parallel and consolidates the business rules. The scan is resumable if interrupted.
5. The Product Manager drafts a product profile and asks you a few questions to confirm the rules that matter.

Then give the team a task:

```
/codewright:run --mode medium Admins can mark a pending order as shipped
```

## Commands

| Command | What it does |
| --- | --- |
| `/codewright:init` | Sets up Codewright in this project, end to end; re-run it to resume an interrupted scan |
| `/codewright:run <task>` | Runs the team on a task, with both gates. `--mode small\|medium\|large`, `--with <role>`, `--without <role>`, `--resume` |
| `/codewright:sync` | Re-analyzes only what changed since the last analysis, and has the Product Manager check changed rules |
| `/codewright:status` | Knowledge-base freshness, rule counts, the profile, the policy, the test app and recent guard decisions |
| `/codewright:clean [--all]` | Deletes run history; `--all` removes `.codewright/` before uninstalling |

## The knowledge base

Agents work from a map of your project instead of re-reading the code on every task. It lives in `.codewright/knowledge/`:

| File | Holds |
| --- | --- |
| `INDEX.md` | One-page map: stack, entry points, modules, where to find what. Start reading here |
| `product.md` | The Product Manager's profile: user roles, core flows, non-negotiable rules |
| `architecture.md` | Layers, patterns and conventions, each with example paths |
| `modules/<name>.md` | Per module: data, routes, logic, rules, dependencies, risk notes |
| `business-rules.md` | Every rule as `BR-###`, with its source file and line, tagged `[inferred]`, `[confirmed: code]`, `[confirmed: user]` or `[disputed]` |
| `glossary.md` | Domain terms as the code uses them |
| `changelog.md` | What each run changed |
| `modules.json` | Which files belong to which module |
| `state.json` | The commit and file hashes last analyzed |

Every statement cites a file, so you can check it. When the code and the knowledge base disagree, the code wins and the analyst corrects the entry. A rule you confirmed that later changes in code is flagged to you, not silently updated.

When you start Claude Code, a session hook checks the knowledge base in milliseconds without using any tokens. If code has changed since the last analysis, it suggests `/codewright:sync`.

## Safety and permissions

A guard hook checks every shell command and file edit, in the main session and in every subagent, against `.codewright/permissions.json`. It answers **allow** (runs without a prompt), **ask** (you approve or reject) or **deny** (blocked, and the agent is told why). Anything the policy doesn't mention goes through Claude Code's normal permission flow, which agents running in the background can't answer, so they're told to stick to pre-approved commands.

| Tier | Default rules |
| --- | --- |
| Allow | Read-only git (`status`, `diff`, `log`, `show`, `blame`…); common test, lint and static-analysis commands; `php artisan route:list`; read-only text filters after a pipe; `cd`; Codewright's own helpers (which write only inside `.codewright/`, start only your confirmed serve command, and call only localhost); **the test, lint and analysis commands you confirmed in `.codewright/profile.json`** |
| Ask | Every git write (`commit`, `push`, `add`, `checkout`, `reset`, `stash`, `branch`, `merge`, `rebase`, `fetch`…); adding or changing dependencies; migrations outside the testing environment; `rm -rf`; edits to `.codewright/profile.json`, because its commands are auto-allowed |
| Deny | Force-push; `migrate:fresh`, `migrate:reset`, `migrate:refresh`, `db:wipe` and `manage.py flush` outside testing; writing the real `.env`; edits outside the project; any change to `permissions.json` itself |

The app the Runtime Monitor and personas use is started only by Codewright's helper, with the serve command you confirmed, on its own test port. It refuses to start if something else is already on that port, so it never attaches to your dev server. The HTTP helper they use refuses any host but localhost.

### Editing the policy

`.codewright/permissions.json` is yours to edit; agents can't touch it. Each Bash rule has an `id`, a `decision`, a JavaScript regular expression `pattern`, an optional `unless` exception and a `reason`. Path rules use globs with optional `except` globs. When several rules match, deny beats ask beats allow. A command is allowed without a prompt only when every part of it (each piece of a `&&` chain or pipe) matches an allow rule, and never when it contains command substitution.

Quoted strings, heredoc bodies and comments are treated as data. A commit message that mentions `git push -f` makes the commit ask rather than be denied. Quoted text can still hide a real command (`bash -c "git commit"`), so a match inside quotes always asks and never auto-allows. Commands over 8,000 characters always ask.

Set `"enforce": "during-runs"` to apply the policy only while a Codewright run is active, instead of the default `"always"`.

Codewright never overwrites your policy, so rules added or changed in a newer version don't reach it automatically. `/codewright:init` and `/codewright:status` list them, so you can copy them in from `defaults/permissions.json`.

If the policy file is unreadable or invalid, the guard asks you about every command rather than letting anything through. Decisions to ask or deny are logged to `.codewright/logs/guard.jsonl`, tagged with the agent that made the call.

### What the guard is not

The guard is a guardrail against mistakes, not a sandbox against a determined attacker. It matches command text, so an agent deliberately obfuscating a command could get past it, and path matching is case-sensitive. Pair it with Claude Code's own permission settings and with reviewing the final diff, which Gate 2 asks you to do anyway.

## Without subagents

If your Claude Code session can't start subagents, `/codewright:run` runs the same phases in a single session. The orchestrator plays each role in turn from its definition in `.codewright/roles/`, writes the tests before the implementation, reviews only what's on disk, and says "single-session fallback" at the top of the report. You lose the independence of separate agents, so treat those reports with more care.

## What Codewright adds to your project

```
.codewright/
├── .gitignore          # "*": the folder ignores itself; your .gitignore is untouched
├── permissions.json    # your allow / ask / deny policy
├── profile.json        # stack, confirmed commands, test port, role test accounts
├── adapter.md          # the stack adapter agents work from (refreshed each run)
├── roles/              # role definitions, for the single-session fallback (refreshed each run)
├── personas/           # default and custom personas (yours are never overwritten)
├── knowledge/          # the project knowledge base
├── improvements.md     # the Supervisor's retrospectives
├── runs/<date>-<task>/ # request, research, spec, plan, baseline, ledger, findings,
│                       # per-chunk reports and verdicts, routes swept, app log, report
└── logs/               # guard decisions, browser screenshots
```

Nothing in it is committed, including the test credentials in `profile.json`.

## Uninstall

From your project's folder:

```bash
/path/to/codewright/uninstall.sh                      # remove the plugin (scope: local)
/path/to/codewright/uninstall.sh --scope project      # use the scope you installed with
/path/to/codewright/uninstall.sh --purge              # also delete this project's .codewright/ (asks first)
/path/to/codewright/uninstall.sh --remove-marketplace # also forget the marketplace
```

`--purge` stops the test app if it's running, then deletes the knowledge base, run history, your permission policy and test accounts; add `-y` to skip the question. Without the script: `/codewright:clean --all` inside Claude Code, then `claude plugin uninstall codewright@codewright --scope <scope>`.

## Development

```bash
npm test             # guard, setup, stack detection, knowledge state, run bookkeeping, app and HTTP helpers
npm run validate     # claude plugin validate . --strict
```

The scripts use only the Node.js standard library. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
