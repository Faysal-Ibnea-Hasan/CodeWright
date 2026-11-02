#!/usr/bin/env node
// Codewright permission guard: a PreToolUse hook that applies .codewright/permissions.json
// to Bash commands and file edits, answering allow / ask / deny (or nothing).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RANK = { allow: 1, ask: 2, deny: 3 };
const MAX_COMMAND = 8000; // longer commands are asked about, which also bounds regex cost

const toPosix = (p) => p.split(path.sep).join('/');

// Remove only whole fd duplications (2>&1) and discards (>/dev/null), never part of a file name like >&2out.
const stripHarmlessRedirects = (c) => c
  .replace(/\s*\d*>&\d+(?=\s|$|[;&|])/g, '')
  .replace(/\s*\d*>\s*\/dev\/null(?=\s|$|[;&|])/g, '');

// Split a shell command into the pieces that actually run: chains, pipes, subshells.
// Over-splitting is safe: deny/ask match any piece, allow needs every piece.
export function splitSegments(command) {
  return stripHarmlessRedirects(command)
    .split(/&&|\|\||(?<![>&])&(?![>&])|[;\n]|(?<!>)\||\$\(|`|<\(/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// The same pieces, but splitting only outside quotes, so a quoted URL like "/orders?a=1&b=2" stays whole.
// Used only for allow rules. Follows bash: a backslash outside quotes escapes the next character,
// and inside double quotes escapes the next one too. Returns null when quotes don't balance.
export function splitUnquoted(command) {
  const text = stripHarmlessRedirects(command);
  const segments = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      current += c;
      if (c === quote) quote = null;
      else if (c === '\\' && quote === '"') current += text[++i] ?? '';
    } else if (c === '\\') { current += c + (text[++i] ?? ''); }
    else if (c === '"' || c === "'") { quote = c; current += c; }
    else if (c === ';' || c === '\n' || c === '&' || (c === '|' && text[i - 1] !== '>')) {
      if (text[i + 1] === c) i++; // && and ||
      segments.push(current); current = '';
    } else current += c;
  }
  if (quote) return null;
  segments.push(current);
  return segments.map((s) => s.trim()).filter(Boolean);
}

const compile = (source, flags = '') => new RegExp(source, flags);
const joinContinuations = (c) => c.replace(/\\\r?\n/g, ' ');

// The command as the shell runs it, minus data: heredoc bodies, quoted strings and comments.
// Commit messages live here, so a message that mentions "git push -f" isn't read as one.
export function stripData(command) {
  return joinContinuations(command)
    .replace(/<<-?\s*(['"]?)(\w+)\1([^\n]*)\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$|\))/g, '<<$2$3')
    .replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '""')
    .replace(/(^|\s)#[^\n]*/g, '$1');
}

function strongestBlocker(segments, policy) {
  let best = null;
  for (const rule of policy.bash ?? []) {
    if (rule.decision === 'allow') continue;
    const re = compile(rule.pattern, rule.flags);
    const unless = rule.unless ? compile(rule.unless, rule.flags) : null;
    const hit = segments.some((s) => re.test(s) && !(unless && unless.test(s)));
    if (hit && (!best || RANK[rule.decision] > RANK[best.decision])) best = rule;
  }
  return best;
}

// Rules shipped in older defaults that turned out unsafe; ignored even if a project policy still has them.
export const RETIRED_RULES = new Set(['codewright-scripts']);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Codewright's own helpers, matched by the plugin's real location only (not any path containing "codewright").
export function pluginAllowRules(roots = [PLUGIN_ROOT, process.env.CLAUDE_PLUGIN_ROOT]) {
  const unique = [...new Set(roots.filter(Boolean).map((r) => toPosix(path.resolve(r))))];
  if (!unique.length) return [];
  const root = unique.map(escapeRe).join('|');
  const arg = `(?:\\s+(?:"[^"$\`\\\\]*"|'[^']*'|[^\\s;&|<>"'\\\\$\`]+))*`;
  return [{
    id: 'codewright-helpers',
    decision: 'allow',
    pattern: `^\\s*node\\s+(["']?)(?:${root})/scripts/(?:kb-state\\.mjs\\1\\s+(?:status|stamp)|(?:detect-stack|setup|run|app|http)\\.mjs\\1)${arg}\\s*$`,
    reason: "Codewright's own helpers: they write only inside .codewright/, start only the confirmed serve command, and call only localhost.",
  }];
}

// The test, lint and analysis commands the user confirmed in profile.json, as allow rules.
// "{name}" in a command template matches one argument; extra trailing arguments are allowed.
export function profileAllowRules(profile) {
  const commands = profile?.commands ?? {};
  return ['test', 'testFilter', 'lint', 'analyze', 'routes']
    .filter((k) => typeof commands[k] === 'string' && commands[k].trim())
    .map((k) => {
      // No shell metacharacters, substitutions or backslashes in the {name} slot or the trailing arguments.
      const safe = String.raw`[^\s;&|<>$` + '`' + String.raw`\\]`;
      const body = escapeRe(commands[k].trim()).replace(/\\\{name\\\}/g, () => `${safe}+`);
      const trailing = String.raw`(?:\s+[^;&|<>$` + '`' + String.raw`\\]*)?`;
      return { id: `profile-${k}`, decision: 'allow', pattern: String.raw`^\s*` + body + trailing + String.raw`\s*$`, reason: `The ${k} command confirmed in profile.json.` };
    });
}

export function decideBash(command, policy, extraAllow = []) {
  if (typeof command !== 'string') throw new Error('Bash command is not a string');
  if (command.length > MAX_COMMAND) {
    return { id: 'too-long', decision: 'ask', reason: `The command is over ${MAX_COMMAND} characters, too long to check automatically.` };
  }
  const segments = splitSegments(stripData(command));
  const blocker = strongestBlocker(segments, policy);
  if (blocker) return blocker;

  // Text inside quotes can hide a real command (bash -c "git commit"), but can also be a
  // harmless message. It may raise the decision to ask, never to deny, and it blocks allow.
  const quoted = strongestBlocker(splitSegments(joinContinuations(command)), policy);
  if (quoted) return { ...quoted, decision: 'ask', reason: `${quoted.reason} (matched inside quoted text)` };

  // Allow rules see the real text, so they can match quoted paths. No blocker matched in either view.
  // Substitutions run even inside double quotes, and ANSI-C quoting defeats quote tracking: never auto-allowed.
  if (/\$\(|`|\$'|[<>]\(/.test(command)) return null;
  const rawSegments = splitUnquoted(joinContinuations(command));
  if (!rawSegments?.length) return null;
  const allowRules = [...(policy.bash ?? []).filter((r) => r.decision === 'allow' && !RETIRED_RULES.has(r.id)), ...extraAllow];
  const matched = rawSegments.map((s) => allowRules.find((r) => compile(r.pattern, r.flags).test(s)));
  return matched.every(Boolean) ? matched[0] : null;
}

export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

const expandHome = (g) => (g.startsWith('~/') ? toPosix(path.join(os.homedir(), g.slice(2))) : g);
const matchesAny = (globs = [], p) => globs.some((g) => globToRegExp(expandHome(g)).test(p));

// Resolve symlinks where the file (or its parent, for new files) exists.
function realish(p) {
  try { return fs.realpathSync(p); } catch {}
  try { return path.join(fs.realpathSync(path.dirname(p)), path.basename(p)); } catch {}
  return p;
}

export function decidePath(filePath, root, policy, extraOutsideOk = []) {
  if (!filePath) return null;
  const rootReal = realish(path.resolve(root));
  const abs = realish(path.resolve(rootReal, filePath));
  const rel = path.relative(rootReal, abs);

  // shortcut: matching is case-sensitive, so case-insensitive filesystems (macOS, Windows) can dodge a glob by casing; add lowercase variants to the policy if that matters.
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    const rule = policy.outsideProject;
    if (!rule) return null;
    const ok = [...(rule.except ?? []), ...extraOutsideOk];
    return matchesAny(ok, toPosix(abs)) ? null : { id: 'outside-project', ...rule };
  }

  const relPosix = toPosix(rel);
  let best = null;
  for (const rule of policy.paths ?? []) {
    if (matchesAny(rule.globs, relPosix) && !matchesAny(rule.except, relPosix)) {
      if (!best || RANK[rule.decision] > RANK[best.decision]) best = rule;
    }
  }
  return best;
}

export function loadPolicy(root) {
  const projectFile = path.join(root, '.codewright', 'permissions.json');
  const file = fs.existsSync(projectFile) ? projectFile : path.join(PLUGIN_ROOT, 'defaults', 'permissions.json');
  const policy = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(policy.bash) || !Array.isArray(policy.paths)) {
    throw new Error(`${file} must have "bash" and "paths" arrays`);
  }
  return policy;
}

export function evaluate(input, root) {
  const policy = loadPolicy(root);
  if (policy.enforce === 'during-runs' && !fs.existsSync(path.join(root, '.codewright', 'runs', '.active'))) {
    return null;
  }
  const ti = input.tool_input ?? {};
  if (input.tool_name === 'Bash') {
    let profile = null;
    try { profile = JSON.parse(fs.readFileSync(path.join(root, '.codewright', 'profile.json'), 'utf8')); } catch {}
    return decideBash(ti.command ?? '', policy, [...pluginAllowRules(), ...profileAllowRules(profile)]);
  }
  const tmpOk = [`${toPosix(os.tmpdir())}/**`, '/tmp/**'];
  if (input.scratchpad_dir) tmpOk.push(`${toPosix(input.scratchpad_dir)}/**`);
  return decidePath(ti.file_path ?? ti.notebook_path, root, policy, tmpOk);
}

function output(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  }));
}

function log(root, input, rule) {
  const dir = path.join(root, '.codewright');
  if (!fs.existsSync(dir)) return;
  try {
    fs.mkdirSync(path.join(dir, 'logs'), { recursive: true });
    const ti = input.tool_input ?? {};
    const entry = {
      time: new Date().toISOString(),
      decision: rule.decision,
      rule: rule.id,
      tool: input.tool_name,
      agent: input.agent_type ?? 'main',
      target: String(ti.command ?? ti.file_path ?? ti.notebook_path ?? '').slice(0, 160),
    };
    fs.appendFileSync(path.join(dir, 'logs', 'guard.jsonl'), `${JSON.stringify(entry)}\n`);
  } catch {} // logging must never break the guard
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { raw += c; });
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(raw);
      const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
      const rule = evaluate(input, root);
      if (!rule) return;
      if (rule.decision !== 'allow') log(root, input, rule);
      output(rule.decision, `Codewright policy (${rule.id}): ${rule.reason}`);
    } catch (err) {
      // Fail toward the human: an unreadable policy must not silently allow anything.
      output('ask', `Codewright guard could not check this call (${err.message}). Approve only if you expected it.`);
    }
  });
}

const invokedDirectly = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
