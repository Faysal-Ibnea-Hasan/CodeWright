
# Codewright status

Gather, then report in one compact table plus at most three lines of advice. Change nothing.

1. **Knowledge base:** `node "<skill>/scripts/kb-state.mjs" status`. Report current or stale, the analyzed commit and date, and the number of changed files and affected modules. Count `.codewright/knowledge/modules/*.md` against the modules in `modules.json`; fewer files means an unfinished scan that `/codewright init` resumes.
2. **Business rules:** in `.codewright/knowledge/business-rules.md`, count rules by tag: `[confirmed: user]`, `[confirmed: code]`, `[inferred]`, `[disputed]`, and `CONFLICT` pairs.
3. **Profile:** stack, version and adapter from `.codewright/profile.json`, and whether its test environment file exists.
4. **Policy:** whether `.codewright/permissions.json` exists (otherwise the bundled defaults apply), its `enforce` value, and how many rules of each decision it has. Run `node "<skill>/scripts/setup.mjs"`; it changes nothing that exists, and its `missingDefaultRules` and `changedDefaultRules` list default rules from newer versions that this policy lacks or has in an older or edited form, and `retiredRules` lists old rules found unsafe, which the guard ignores and the user should delete.
5. **App:** `node "<skill>/scripts/app.mjs" status`: whether Codewright's test instance is running, and on which port. Also list the roles in `profile.json` `testAccounts` (names only, never credentials).
6. **Guard activity:** from `.codewright/logs/guard.jsonl`, the number of ask and deny decisions in the last 7 days, and the three most recent denies with their rule and agent.

If `.codewright/` doesn't exist, say Codewright isn't set up here and suggest `/codewright init`.

Advice, only when it applies: run `/codewright sync` when stale; resume `/codewright init` when the scan is unfinished; answer open product questions when `product.md` lists any; create the test environment file when it's missing; copy in missing default policy rules if the user wants them.
