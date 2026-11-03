# Contributing to Codewright

Thanks for helping. Issues and pull requests are welcome.

## Before you open a pull request

1. Run the tests and the validator; both must pass:

   ```bash
   npm test
   npm run validate
   ```

2. Any change to `scripts/guard.mjs` or `defaults/permissions.json` needs a test in `tests/guard.test.mjs`: one case showing the new rule fires, and one showing an ordinary command it must not catch.
3. Add a line to `CHANGELOG.md` under an `Unreleased` heading.

## Ground rules

- **The guard fails toward the human.** If it can't decide, it asks. Never change an error path to allow.
- **No runtime dependencies.** The scripts use only the Node.js standard library, so the plugin works straight from a clone.
- **Agents never write git.** No skill, agent or script may commit, push, stash or otherwise change git state.
- **Plain, specific instructions** in skills and agents: say what to do and what to report, not what to think about.

## Adding a stack adapter

Each adapter is one Markdown file in `references/stacks/<stack>.md` with the same sections: Detect, Commands, Test environment, Where things live, Grouping and conventions, Risk hotspots. Laravel is the reference adapter. Add detection for the new stack in `scripts/detect-stack.mjs` and a case in `tests/knowledge.test.mjs`; an adapter file named after the detected stack is picked up automatically.

## Adding a default persona

Personas are short Markdown files in `personas/`: who the person is, what they do (per surface), and what counts as a failure for them. Keep them about users, not attackers; attacks belong to the Adversary.
