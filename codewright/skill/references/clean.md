
# Codewright clean

Arguments: everything after `clean` in the arguments the skill was given.

1. **Confirm first.** Deletion cannot be undone, so ask the user before running anything:
   - Without `--all`: "Delete all run history and guard logs in `.codewright/runs/` and `.codewright/logs/`? The knowledge base and your permission policy stay."
   - With `--all`: "Delete the entire `.codewright/` folder, including the knowledge base and your edited permission policy? Do this only before uninstalling."

2. **Only after a clear yes**, stop the app if Codewright started it (`node "<skill>/scripts/app.mjs" stop`), then run one of:

   ```bash
   node "<skill>/scripts/clean.mjs"
   node "<skill>/scripts/clean.mjs" --all
   ```

3. Report what the printed JSON says was removed. After `--all`, remind the user that Codewright itself is removed with its `uninstall.sh`, using the scope they installed it with.
