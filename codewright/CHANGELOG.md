# Changelog

All notable changes to Codewright are recorded here. Versions follow [Semantic Versioning](https://semver.org).

## [2.0.0] - 2026-11-04

Codewright is now a Claude Code skill instead of a plugin. No plugin, marketplace or hidden `.claude-plugin/` folder is needed, so the repository also survives being uploaded through the GitHub website.

### Changed

- **Commands** are one skill with subcommands: `/codewright init`, `/codewright run <task>`, `/codewright sync`, `/codewright status`, `/codewright clean`.
- **Agents** are installed as `codewright-<role>` (for example `codewright-planner`) into `~/.claude/agents/` or `<project>/.claude/agents/`, keeping each role's tool limits.
- **Hooks** (the permission guard and the knowledge-base check) are merged into `settings.json` by the installer and removed by the uninstaller, without touching other settings.
- **Browser server** is added with `install.sh --browser` as `codewright-playwright`, instead of being bundled.
- **Scopes** are `user` (default, every project) and `project` (committed with the project).
- The guard now acts only in projects with a `.codewright/` folder, since a user-wide install runs it everywhere.
- The knowledge-base check ignores `.claude/`, so installing or updating Codewright doesn't mark the knowledge base stale.

### Added

- `install.sh` downloads from GitHub (`--source owner/repo`) or installs from a local copy, finds the skill even one folder down, and removes the 1.x plugin if present.
- Manual install: copying `skill/` into a skills folder works on its own; without installed agents, general-purpose agents play each role.
- `skill/scripts/settings.mjs`: adds and removes Codewright's hooks in a settings file; refuses to touch invalid JSON.

### Removed

- The plugin manifest, marketplace manifest, `hooks/hooks.json` and `.mcp.json`.

## [1.0.1] - 2026-11-03

### Fixed

- `install.sh` failed on macOS with `SOURCE…: unbound variable`: macOS's bash 3.2 read the `…` after `$SOURCE` as part of the variable name. Both scripts are now plain ASCII and brace every variable.
- `install.sh` now refuses to run from a subfolder of a git repository (for example Laravel's web-served `public/`), where `.codewright/` and its test credentials could be exposed. `--here` overrides it for monorepos.

## [1.0.0] - 2026-11-02

The full team.

### Added

- **Adversary:** attacks each change (authorization, validation, business rules, repetition, injection, money, information leaks) and delivers the weaknesses as failing tests.
- **Runtime Monitor:** sweeps the affected routes on the running app as every role, reading the app and framework logs; 5xx and logged exceptions are blockers.
- **SQA:** reviews acceptance criteria for testability before Gate 1, then builds the traceability matrix from the test files, runs the suite and signs off only on evidence.
- **End User** with six default personas (first-timer, power user, careless user, returning user, role-boundary user, accessibility and mobile user), through the API or a real browser. Custom personas go in `.codewright/personas/`.
- **UI/UX QA:** checks changed screens against Figma or the existing design system at three widths, in every state.
- **Researcher:** researches external tech before planning, matched to installed versions.
- **Reporter:** writes the report and commit message from the run's records.
- `app.mjs`: starts the app with the confirmed serve command on the test port, refuses a busy port, and stops it.
- `http.mjs`: a localhost-only HTTP client with role-based test accounts (headers or login), and route sweeps that summarize 5xx, errors and slow responses.
- Playwright MCP server in the plugin's `.mcp.json` for browser personas and UI/UX QA.
- Stack adapters for .NET, Java, Node, Django, React and Flutter.
- Single-session fallback: role definitions are copied to `.codewright/roles/` and the orchestrator plays each role in turn.
- `init` collects role-based test accounts; `status` shows the test app and account roles.
- `install.sh` (checks Claude Code and Node.js, adds or refreshes the marketplace, installs at any scope, optionally installs Chrome) and `uninstall.sh` (any scope, optional purge of `.codewright/` and marketplace removal). Both work from a clone or piped from curl.

### Changed

- The orchestrator runs research, SQA criteria review, the Adversary and Runtime Monitor gates, SQA sign-off, a user-acceptance phase and the Reporter, and manages the app's lifecycle.
- Allow rules split commands only outside quotes, so quoted URLs with `&` work, and never auto-allow command substitution.

### Security

Found by an adversarial review before release, each verified by running the bypass:

- Quote tracking for allow rules now follows bash: a backslash outside quotes escapes the next character, and unbalanced quotes never auto-allow. Before, `npm test \' ; other-command ; \'` was auto-allowed.
- `$'…'` quoting and `<(…)` / `>(…)` substitution are never auto-allowed.
- Codewright's helper scripts are matched by the plugin's real install path. The `codewright-scripts` rule, which matched any path containing "codewright", is retired: the guard ignores it in existing policies and `setup` reports it for deletion.
- Only whole `2>&1` and `>/dev/null` tokens are ignored, so `>&2out` can't hide a file write.
- Agents can't edit `.codewright/app.json`, so the app helper can't be pointed at a process it didn't start.
- The `{name}` slot and trailing arguments of profile commands accept no shell metacharacters, substitutions or backslashes.

## [0.3.0] - 2026-11-02

### Added

- `/codewright:run`: the Orchestrator takes a task through intake, knowledge sync, planning, Gate 1, per-chunk build with fix loops, integration, report and Gate 2, then updates the knowledge base. Resumable with `--resume`; `--mode`, `--with` and `--without` adjust the team.
- Agents: Planner (spec, acceptance criteria, interface contract, chunks, relevance matrix), Implementer, Test Designer (write, regression and dispute modes; never reads the chunk's implementation), Behavior Verifier, Architecture Guardian, Senior Supervisor (plan-check, chunk-check, final-retro, binding corrections).
- Product Manager `scope-review` (before Gate 1) and `integrity-review` (before Gate 2) modes.
- `run.mjs`: run folders, the active-run marker, validated findings with per-chunk IDs, and a mechanical pass/fail verdict per chunk.
- Every run keeps a ledger, a baseline of the test suite before any change, per-chunk gate results and a report with acceptance-criteria traceability.
- `setup.mjs` also reports default policy rules whose content changed in a newer version.
- The guard auto-allows the test, lint and analysis commands confirmed in `profile.json`, and plain `cd`, so subagents (which can't stop to ask) can run the project's tests. Agent edits to `profile.json` now ask first, since its commands are trusted.
- Reviewers return a required `checked` list (what they verified, with file and line) and read a diff file the orchestrator writes; the Supervisor treats a missing `checked` list as a rubber stamp.
- Findings gain an `accepted` status with a reason, for problems resolved by a recorded decision rather than a code change.
- Agents are told to run only the exact pre-approved commands from `plan.md` and `profile.json`, and the Planner builds each chunk's test command from the confirmed `testFilter` template.
- The orchestrator saves every agent's report per chunk and loop, re-runs the Supervisor's plan check after revisions that change acceptance criteria, and states at Gate 1 when the quality floor can't be fully met in this version.

### Fixed

- Files analyzed while uncommitted no longer count as changed once they are committed as-is, so committing a run doesn't trigger a needless re-scan.

## [0.2.0] - 2026-11-02

### Added

- Stack detection: Laravel first (`artisan` plus `laravel/framework`, with the locked version), then .NET, Java, Django, Flutter, React and Node.
- Stack adapters: a full Laravel adapter (commands, test environment, where things live, module grouping, conventions, risk hotspots) and a generic adapter that discovers commands from CI, task runners and docs.
- System Analyst agent: builds the knowledge base in map, module (parallel) and consolidate passes, and keeps it current in sync mode. Every statement cites a file; every rule is tagged by certainty.
- Product Manager agent: drafts the product profile, confirms business rules with the user, and flags code changes that contradict rules the user confirmed.
- `/codewright:init` now runs end to end: stack question flow, project profile, scan estimate, resumable deep scan, product profile.
- `/codewright:sync`: re-analyzes only changed files and the modules they belong to.
- `/codewright:status`: knowledge-base freshness, rule counts, profile, policy and guard activity.
- Session-start hook that tells Claude when the knowledge base is out of date, without using tokens.
- Allow rules for `php artisan route:list`, read-only text filters and Codewright's own helper scripts.
- `setup.mjs` reports default policy rules that an existing project policy lacks.

### Fixed

- Agents could not read the stack adapter, because it lived outside the project. It is now copied to `.codewright/adapter.md`.
- Allow rules now match the command's real text, so quoted script paths can be auto-allowed.

## [0.1.0] - 2026-11-02

### Added

- Plugin manifest and a marketplace manifest, so this repository installs directly with `/plugin marketplace add`.
- Permission guard: a PreToolUse hook that checks every shell command and file edit, in the main session and in subagents, against an allow / ask / deny policy.
- Default policy: read-only git and common test commands allowed; git writes, dependency changes, non-testing migrations and `rm -rf` ask first; force-push, destructive database commands outside testing, writing the real `.env`, edits outside the project and edits to the policy itself denied.
- Guard fails toward asking when the policy is unreadable, and logs ask/deny decisions with the calling agent to `.codewright/logs/guard.jsonl`.
- `/codewright:init`: creates the self-ignoring `.codewright/` folder and copies the editable policy.
- `/codewright:clean [--all]`: removes run history, or the whole folder before uninstalling.
- Test suite for the guard, setup and clean scripts (`npm test`).
