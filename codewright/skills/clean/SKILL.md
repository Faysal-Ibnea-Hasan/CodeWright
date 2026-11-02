---
name: clean
description: Delete Codewright run history from this project, or remove the whole .codewright/ folder before uninstalling with --all.
disable-model-invocation: true
argument-hint: "[--all]"
---

# Codewright clean

Arguments: `$ARGUMENTS`

1. **Confirm first.** Deletion cannot be undone, so ask the user before running anything:
   - Without `--all`: "Delete all run history and guard logs in `.codewright/runs/` and `.codewright/logs/`? The knowledge base and your permission policy stay."
   - With `--all`: "Delete the entire `.codewright/` folder, including the knowledge base and your edited permission policy? Do this only before uninstalling."

2. **Only after a clear yes**, stop the app if Codewright started it (`node "${CLAUDE_PLUGIN_ROOT}/scripts/app.mjs" stop`), then run one of:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/clean.mjs"
   node "${CLAUDE_PLUGIN_ROOT}/scripts/clean.mjs" --all
   ```

3. Report what the printed JSON says was removed. After `--all`, remind the user the plugin itself is removed with `claude plugin uninstall codewright@codewright --scope <scope>`, using the scope they installed it with.
