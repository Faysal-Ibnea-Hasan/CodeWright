
# Codewright init

Work through the steps in order. Create a task list with one item per step so the user can follow along.

## 1. Check git state (read-only)

Run `git status --porcelain`. If it prints anything, tell the user they have uncommitted changes and recommend committing them first, so everything Codewright changes later is one clean diff. Never commit or stash yourself. Continue either way.

## 2. Create the project folder

```bash
node "<skill>/scripts/setup.mjs"
```

Safe to re-run; it never overwrites an existing `.codewright/permissions.json`. If its output lists `missingDefaultRules` or `changedDefaultRules`, a newer Codewright version added or changed default rules this project's policy doesn't have or has in an older form (possibly edited by the user on purpose); tell the user their IDs and that the rules are in `<skill>/defaults/permissions.json` to copy in if they want them. If it lists `retiredRules`, those are old rules found unsafe: the guard already ignores them, and the user should delete them. Don't change the policy yourself.

If `.codewright/knowledge/modules.json` already exists, a previous init ran. Ask the user (AskUserQuestion): **Resume** the unfinished scan (recommended when some module files are missing), **Rebuild** the knowledge base from scratch, or **Keep** it and stop after step 4. For Rebuild, delete only the files inside `.codewright/knowledge/`, after the user picked it.

## 3. Identify the stack

```bash
node "<skill>/scripts/detect-stack.mjs"
```

- **Laravel detected:** ask one question: "Detected Laravel <version>. Use the Laravel adapter?" Options: "Yes, Laravel (Recommended)", "No, choose another stack".
- **Otherwise, or if they said no:** ask two questions in sequence.
  1. Category: "Backend", "Frontend or mobile", "Any stack". Mark the detected category "(Recommended)".
  2. Stack. Backend offers four of Laravel, .NET, Java, Node, Django, with the detected one first and "(Recommended)"; the description says "Not listed? Choose Other and type it." Frontend or mobile offers React and Flutter.

Adapter: `laravel` for Laravel; `generic` for every other choice in this release, and tell the user a dedicated adapter for their stack arrives in a later version. Copy it into the project, where agents can read it without a permission prompt:

```bash
node "<skill>/scripts/setup.mjs" --adapter <adapter>
```

## 4. Write the project profile

Read `.codewright/adapter.md`. Following its "Commands" and "Test environment" sections, find the commands this project really has (check installed packages, `vendor/bin/`, scripts, CI config). Don't run tests or the app yet.

Write `.codewright/profile.json`:

```json
{
  "stack": "laravel",
  "version": "v11.31.0",
  "adapter": "laravel",
  "commands": {
    "test": "php artisan test",
    "testFilter": "php artisan test --filter={name}",
    "lint": "vendor/bin/pint --test",
    "analyze": null,
    "routes": "php artisan route:list --json",
    "migrateTesting": "php artisan migrate --env=testing",
    "serve": "php artisan serve --env=testing --port=8765"
  },
  "appPort": 8765,
  "testEnv": { "file": ".env.testing", "exists": true, "database": "sqlite" },
  "confirmedAt": "<ISO date>"
}
```

Use `null` for anything the project doesn't have. The `serve` command must start the app on `appPort` with the testing environment; the Runtime Monitor and personas run against it, and the guard auto-allows `test`, `testFilter`, `lint`, `analyze` and `routes`, so get those exactly right.

**Test accounts.** Ask the user in plain text which roles the app has and how a test user of each role authenticates (seeded users or tokens that exist only in the testing environment). Never accept real or production credentials; say so. Add them to the profile as `testAccounts`, keyed by role, in one of two forms:

```json
"testAccounts": {
  "customer": { "headers": { "Authorization": "Bearer test-token-customer" } },
  "admin": { "login": { "method": "POST", "path": "/api/v1/auth/login", "body": { "email": "admin@test.local", "password": "password" }, "tokenPath": "token", "header": "Authorization", "prefix": "Bearer " } }
}
```

If the user has none yet, leave `testAccounts` empty and say runtime checks and personas will test only what a guest can reach until accounts are added.

Show the profile to the user as a short table (mask passwords and tokens) and ask: "Looks right" or "I'll correct it". Apply corrections. If the test environment file is missing, say runtime checks will need one before the first run, and that Codewright will not create it from `.env`. `.codewright/` is never committed, so these test credentials stay on this machine.

## 5. Estimate the deep scan

Count source files: `git ls-files | wc -l` (subtract obvious vendored or generated paths if they are tracked). Tell the user:

- the file count;
- that the scan runs one map pass, then one analyst per module (several in parallel), then a consolidation pass;
- that on a large project this is the most expensive step Codewright does, it is done once, and later runs only re-read what changed;
- that it can be interrupted and resumed with `/codewright init`.

Ask: "Start the scan" or "Later". On Later, stop here and say how to resume.

## 6. Deep scan

Delegate to the `codewright-system-analyst` agent. Each brief names the mode; the agent reads `.codewright/adapter.md` and `.codewright/profile.json` itself.

1. **Map:** one agent, `model: opus`, mode `map`. Skip when resuming and `modules.json` exists.
2. **Modules:** read `modules.json`. For every module without a `modules/<name>.md` file, start an agent in mode `module` with that module's name and globs. Run up to 5 at once; wait for a batch before starting the next. A module whose file exists is done; that is how resume works.
3. **Consolidate:** one agent, `model: opus`, mode `consolidate`.

After each pass, mark your task list and relay one line of progress. If an agent reports something risky (committed secrets, an obvious security hole), tell the user right away.

**Without subagents** (no Agent tool available): do each pass yourself, in order, following `<skill>/agents/system-analyst.md` exactly as if you were that agent. Finish each module file before starting the next.

## 7. Mark the knowledge base current

Right after the scan, so stopping during the product questions can't leave it flagged as stale:

```bash
node "<skill>/scripts/kb-state.mjs" stamp
```

## 8. Product profile

1. Start `codewright-product-manager` in mode `profile`.
2. Put its questions to the user with AskUserQuestion, up to four per call, the PM's recommended answer first and marked "(Recommended)". Say they can skip any question; unanswered ones stay listed in `product.md`.
3. Start `codewright-product-manager` in mode `confirm` with the user's answers, verbatim.

Without subagents, do both modes yourself following `<skill>/agents/product-manager.md`.

## 9. Report

In a few lines: the stack and adapter; the module count; how many business rules were found and how many the user confirmed; anything flagged as risky; and that `.codewright/` ignores itself, so nothing is committed. Point to `.codewright/knowledge/INDEX.md` as the place to start reading.

## Rules

- Never edit `.codewright/permissions.json`. If the user wants a rule changed, show them the exact change and let them make it.
- Never run git write commands, migrations against a non-testing environment, or the app during init.
