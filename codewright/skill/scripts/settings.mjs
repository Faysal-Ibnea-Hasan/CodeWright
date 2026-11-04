#!/usr/bin/env node
// Adds or removes Codewright's hooks in a Claude Code settings.json, leaving everything else untouched.
//   node settings.mjs install <settings.json> <skill folder as a shell expression>
//       e.g. '$HOME/.claude/skills/codewright' or '$CLAUDE_PROJECT_DIR/.claude/skills/codewright'
//   node settings.mjs uninstall <settings.json>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Every Codewright hook command contains this, which is how uninstall finds only ours.
const MARKER = 'skills/codewright/scripts/';

function read(file) {
  if (!fs.existsSync(file)) return {};
  const text = fs.readFileSync(file, 'utf8');
  if (!text.trim()) return {};
  try {
    const data = JSON.parse(text);
    if (data && typeof data === 'object' && !Array.isArray(data)) return data;
  } catch {}
  throw new Error(`${file} isn't valid JSON, so it was left unchanged. Fix it, then run the installer again.`);
}

function write(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.codewright-tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(tmp, file); // atomic: a crash never leaves a half-written settings file
}

const isOurs = (h) => typeof h?.command === 'string' && h.command.includes(MARKER);

export function removeHooks(data) {
  const hooks = data.hooks;
  if (!hooks || typeof hooks !== 'object') return data;
  for (const event of Object.keys(hooks)) {
    if (!Array.isArray(hooks[event])) continue;
    hooks[event] = hooks[event]
      .map((group) => (Array.isArray(group?.hooks) ? { ...group, hooks: group.hooks.filter((h) => !isOurs(h)) } : group))
      .filter((group) => !Array.isArray(group?.hooks) || group.hooks.length > 0);
    if (hooks[event].length === 0) delete hooks[event];
  }
  if (Object.keys(hooks).length === 0) delete data.hooks;
  return data;
}

export function addHooks(data, skillDir) {
  if (!skillDir || /["`\n]/.test(skillDir)) throw new Error('The skill folder must be a non-empty path without quotes or backticks.');
  removeHooks(data); // installing twice must not duplicate the hooks
  const hooks = (data.hooks ??= {});
  const cmd = (script, arg = '') => ({ type: 'command', command: `node "${skillDir}/scripts/${script}"${arg}`, timeout: 10 });
  (hooks.SessionStart ??= []).push({ hooks: [cmd('kb-state.mjs', ' hook')] });
  (hooks.PreToolUse ??= []).push({ matcher: 'Bash|Edit|Write|MultiEdit|NotebookEdit', hooks: [cmd('guard.mjs')] });
  return data;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, file, skillDir] = process.argv.slice(2);
  try {
    if (mode === 'install' && file) write(file, addHooks(read(file), skillDir));
    else if (mode === 'uninstall' && file) { if (fs.existsSync(file)) write(file, removeHooks(read(file))); }
    else throw new Error('usage: settings.mjs install <settings.json> <skill folder> | uninstall <settings.json>');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
