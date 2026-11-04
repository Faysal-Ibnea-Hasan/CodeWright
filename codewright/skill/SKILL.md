---
name: codewright
description: Run a full software engineering team on a task - research, plan with your approval, build against tests written from the spec, attack, review, run it live, test it as real users, and hand off for you to commit. Commands - init, run, sync, status, clean.
argument-hint: "init | run <task> [--mode small|medium|large] [--with <role>] [--without <role>] [--resume] | sync | status | clean [--all]"
disable-model-invocation: true
---

# Codewright

Arguments: `$ARGUMENTS`

The skill folder is `${CLAUDE_SKILL_DIR}`. In every file under it, **`<skill>` means this folder**: write the full path out in every command you run and every brief you give an agent, quoted.

## Pick the command

Take the first word of the arguments as the command; everything after it is that command's arguments.

| Command | Read and follow |
| --- | --- |
| `init` | `<skill>/references/init.md` |
| `run` | `<skill>/references/run.md` |
| `sync` | `<skill>/references/sync.md` |
| `status` | `<skill>/references/status.md` |
| `clean` | `<skill>/references/clean.md` |

Read the whole reference file before you start, then follow it as written. Read Codewright's own files (`.codewright/`, `<skill>`) with the Read tool, not with shell commands: the permission guard blocks shell commands that touch `.codewright/permissions.json` or `profile.json`. Where it says "Arguments", use the arguments that came after the command word.

If there is no command, or the first word isn't one of these, show this table with one line about each command, then stop:

- `init` sets Codewright up in this project (permission policy, stack, knowledge base, product profile). Run it once per project.
- `run <task>` runs the team on a task, with your approval of the plan and of the result.
- `sync` updates the knowledge base after code changes.
- `status` shows Codewright's state in this project.
- `clean` deletes run history; `clean --all` removes `.codewright/`.

## Team agents

The roles are installed as agent types named `codewright-<role>`: `codewright-planner`, `codewright-implementer`, `codewright-test-designer`, `codewright-behavior-verifier`, `codewright-architecture-guardian`, `codewright-adversary`, `codewright-runtime-monitor`, `codewright-sqa`, `codewright-product-manager`, `codewright-senior-supervisor`, `codewright-system-analyst`, `codewright-researcher`, `codewright-end-user`, `codewright-uiux-qa`, `codewright-reporter`. Their definitions are also in `<skill>/agents/<role>.md`.

If those agent types aren't available in this session (Codewright was copied without running its installer), start a general-purpose agent instead, and begin its brief with: "Read `<skill>/agents/<role>.md` and act exactly as that role, including its limits on what you may edit." Mention once to the user that running the installer gives each role its own restricted tools.

If no agents can be started at all, follow the "Without subagents" section of the reference file.
