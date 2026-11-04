#!/usr/bin/env bash
# Installs the Codewright skill into Claude Code.
#
#   bash install.sh [--scope user|project] [--source <owner/repo | git URL | folder>] [--browser] [--here]
#
#   --scope    user     you, in every project: ~/.claude (default)
#              project  everyone on this project: <project>/.claude, which you commit
#   --source   where to get Codewright. Defaults to the folder this script is in. A GitHub
#              owner/repo or git URL is downloaded first (needed when piped from curl).
#   --browser  also set up a headless browser for browser personas and UI/UX QA
#              (adds the codewright-playwright MCP server and installs Chrome for Playwright).
#   --here     with --scope project, allow a subfolder of a git repository (for monorepos).
#
# It installs:
#   <base>/skills/codewright/        the skill: /codewright init | run | sync | status | clean
#   <base>/agents/codewright-*.md    the team's roles, each with its own tool limits
#   <base>/settings.json             two hooks: the permission guard and the knowledge-base check
set -euo pipefail

SCOPE=user
SOURCE=""
BROWSER=0
HERE=0
ARGS="$*"
TMP_DIR=""

die() { echo "install.sh: $*" >&2; exit 1; }
cleanup() { if [ -n "${TMP_DIR}" ]; then rm -rf "${TMP_DIR}"; fi; }
trap cleanup EXIT

while [ $# -gt 0 ]; do
  case "$1" in
    --scope) SCOPE="${2:-}"; shift 2 ;;
    --source) SOURCE="${2:-}"; shift 2 ;;
    --browser) BROWSER=1; shift ;;
    --here) HERE=1; shift ;;
    -h|--help) sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown option: $1 (see --help)" ;;
  esac
done

case "${SCOPE}" in user|project) ;; *) die "--scope must be user or project" ;; esac

command -v node >/dev/null 2>&1 || die "Node.js 18.19 or newer is required (it runs Codewright's permission guard)."
node -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a > 18 || (a === 18 && b >= 19) ? 0 : 1)' \
  || die "Node.js 18.19 or newer is required; found $(node --version)."
HAS_CLAUDE=0
if command -v claude >/dev/null 2>&1; then HAS_CLAUDE=1; else
  echo "Note: the claude command wasn't found. Codewright will be ready once Claude Code is installed."
fi

# --- Where to install from -------------------------------------------------------------
if [ -z "${SOURCE}" ]; then
  SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
fi
if [ -d "${SOURCE}" ]; then
  REPO="${SOURCE}"
else
  case "${SOURCE}" in
    *://*|git@*) URL="${SOURCE}" ;;
    */*) URL="https://github.com/${SOURCE}.git" ;;
    *) die "pass --source <owner/repo> (for example: --source your-user/codewright)" ;;
  esac
  TMP_DIR="$(mktemp -d)"
  REPO="${TMP_DIR}/repo"
  echo "Downloading Codewright from ${URL}..."
  if command -v git >/dev/null 2>&1; then
    git clone --quiet --depth 1 "${URL}" "${REPO}" || die "couldn't download ${URL}. Check the name, and that the repository is public or you have access."
  else
    case "${URL}" in https://github.com/*) ;; *) die "git is needed to download ${URL}" ;; esac
    TARBALL="${URL%.git}/archive/HEAD.tar.gz"
    mkdir -p "${REPO}" && curl -fsSL "${TARBALL}" | tar -xz -C "${REPO}" --strip-components 1 \
      || die "couldn't download ${TARBALL}"
  fi
fi

# The skill folder: skill/ at the top of the repository, or one level down (a repository uploaded inside a folder).
SKILL_SRC=""
for candidate in "${REPO}/skill" "${REPO}"/*/skill; do
  if [ -f "${candidate}/SKILL.md" ] && grep -q '^name: codewright$' "${candidate}/SKILL.md"; then SKILL_SRC="${candidate}"; break; fi
done
[ -n "${SKILL_SRC}" ] || die "no Codewright skill found in ${SOURCE}: expected a skill/ folder with SKILL.md (Codewright 2.0 or newer)."
VERSION="$(cat "${SKILL_SRC}/VERSION" 2>/dev/null || echo unknown)"

# --- Where to install to ---------------------------------------------------------------
if [ "${SCOPE}" = user ]; then
  BASE="${HOME}/.claude"
  SKILL_EXPR='$HOME/.claude/skills/codewright'
else
  TOP="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  if [ -z "${TOP}" ]; then
    echo "Note: this folder isn't a git repository. Run the script from your project's root folder."
  elif [ "$(pwd -P)" != "$(cd "${TOP}" && pwd -P)" ] && [ "${HERE}" != 1 ]; then
    die "run this from your project's root folder, not a subfolder:
  cd \"${TOP}\" && bash install.sh ${ARGS}
(If this subfolder really is a separate project, add --here.)"
  fi
  BASE="${PWD}/.claude"
  SKILL_EXPR='$CLAUDE_PROJECT_DIR/.claude/skills/codewright'
fi
SKILL_DIR="${BASE}/skills/codewright"
echo "Installing Codewright ${VERSION} (scope: ${SCOPE}) into ${BASE}"

# --- Codewright 1.x was a plugin; remove it so its hooks and agents don't run twice -----
if [ "${HAS_CLAUDE}" = 1 ] && claude plugin list --json 2>/dev/null | grep -q '"codewright@codewright"'; then
  echo "Removing the old Codewright plugin..."
  for s in user project local; do claude plugin uninstall codewright@codewright --scope "${s}" >/dev/null 2>&1 || true; done
  claude plugin marketplace remove codewright >/dev/null 2>&1 || true
fi

# --- Copy the skill and the agents -----------------------------------------------------
mkdir -p "${BASE}/skills" "${BASE}/agents"
rm -rf "${SKILL_DIR}"
cp -R "${SKILL_SRC}" "${SKILL_DIR}"
for old in "${BASE}"/agents/codewright-*.md; do
  if [ -f "${old}" ]; then rm -f "${old}"; fi
done
for role in "${SKILL_SRC}"/agents/*.md; do
  cp "${role}" "${BASE}/agents/codewright-$(basename "${role}")"
done
echo "  skill:  ${SKILL_DIR}"
echo "  agents: ${BASE}/agents/codewright-*.md ($(ls "${SKILL_SRC}"/agents/*.md | wc -l | tr -d ' ') roles)"

# --- Hooks -----------------------------------------------------------------------------
node "${SKILL_DIR}/scripts/settings.mjs" install "${BASE}/settings.json" "${SKILL_EXPR}"
echo "  hooks:  ${BASE}/settings.json (permission guard, knowledge-base check)"

# --- Optional browser ------------------------------------------------------------------
if [ "${BROWSER}" = 1 ]; then
  if [ "${HAS_CLAUDE}" = 1 ]; then
    claude mcp remove codewright-playwright --scope "${SCOPE}" >/dev/null 2>&1 || true
    claude mcp add codewright-playwright --scope "${SCOPE}" -- npx -y @playwright/mcp@latest --headless --isolated --output-dir .codewright/logs/playwright \
      && echo "  browser: codewright-playwright MCP server (scope: ${SCOPE})"
  else
    echo "  browser: skipped the MCP server, because the claude command wasn't found."
  fi
  npx -y playwright install chrome \
    || echo "  Chrome install failed. Browser personas will use the API instead. Retry with: npx playwright install chrome"
fi

cat <<EOF

Codewright ${VERSION} is installed.
Next, in your project's root folder:
  1. Commit your work, so Codewright's changes stay one clean diff.
  2. Start Claude Code:  claude   (restart it if it was already open)
  3. Set up the project: /codewright init
EOF
if [ "${SCOPE}" = project ]; then
  echo "Commit .claude/skills/codewright, .claude/agents/codewright-*.md and .claude/settings.json to share it with your team."
fi
