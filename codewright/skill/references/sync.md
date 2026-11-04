
# Codewright sync

## 1. What changed

```bash
node "<skill>/scripts/kb-state.mjs" status
```

- `initialized: false` → tell the user to run `/codewright init` and stop.
- `stale: false` → say the knowledge base is current (and as of which commit) and stop.
- `fullRescan: true` → explain the reason it gives, and ask whether to re-analyze everything now. If yes, run the deep scan exactly as `/codewright init` step 6 describes, in Rebuild mode for modules: re-run every module pass, not only missing ones. Then go to step 4.

Refresh the in-project adapter copy, in case Codewright was updated: read `adapter` from `.codewright/profile.json`, then run `node "<skill>/scripts/setup.mjs" --adapter <adapter>`.

## 2. Update the affected modules

Delegate to `codewright-system-analyst`. Each brief includes the status JSON.

- **Three or fewer affected modules:** one agent in mode `sync` with the whole change list.
- **More:** one agent in mode `module` per affected module, up to 5 at once, each told to update its existing file in place and keep `[confirmed: user]` tags; then one agent in mode `sync` for the unmapped files and the shared files (`business-rules.md`, `glossary.md`, `architecture.md`, `INDEX.md`).

Without subagents, do the same work yourself following `<skill>/agents/system-analyst.md`.

## 3. Mark current

As soon as the analysts finish, so an unanswered product question can't leave the knowledge base flagged as stale:

```bash
node "<skill>/scripts/kb-state.mjs" stamp
```

## 4. Product check

If the analyst reports added, removed or changed business rules, start `codewright-product-manager` in mode `refresh` with the rule IDs. If it returns questions, put them to the user, then run mode `confirm` with the answers. Unanswered questions stay listed in `product.md`. A rule that now contradicts something the user confirmed is the first thing you tell the user.

## 5. Report

One short paragraph: files and modules re-analyzed, modules added, business rules changed (with IDs), and any contradiction with a confirmed rule.
