#!/usr/bin/env bash
# Installs Codewright into Claude Code.
#
#   ./install.sh [--scope local|project|user] [--source <owner/repo | git URL | path>] [--browser] [--here]
#
#   --scope    local    only you, in the current project (default)
#              project  everyone on the current project (written to .claude/settings.json)
#              user     you, in every project
#   --source   where to install from. Defaults to the folder this script is in, when run from a
#              clone; required when piped from curl (e.g. --source your-user/codewright).
#   --browser  also install Chrome for Playwright, used by browser personas and UI/UX QA.
#   --here     allow running from a subfolder of a git repository (for monorepos).
#
# Run it from your project's root folder for the local and project scopes.
set -euo pipefail

SCOPE=local
SOURCE=""
BROWSER=0
HERE=0
ARGS="$*"
MARKETPLACE=codewright
PLUGIN=codewright@codewright

die() { echo "install.sh: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --scope) SCOPE="${2:-}"; shift 2 ;;
    --source) SOURCE="${2:-}"; shift 2 ;;
    --browser) BROWSER=1; shift ;;
    --here) HERE=1; shift ;;
    -h|--help) sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown option: $1 (see --help)" ;;
  esac
done

case "${SCOPE}" in local|project|user) ;; *) die "--scope must be local, project or user" ;; esac

command -v claude >/dev/null 2>&1 || die "Claude Code isn't installed. Install it first: https://code.claude.com/docs"
command -v node >/dev/null 2>&1 || die "Node.js 18.19 or newer is required (it runs Codewright's permission guard)."
node -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a > 18 || (a === 18 && b >= 19) ? 0 : 1)' \
  || die "Node.js 18.19 or newer is required; found $(node --version)."

if [ -z "${SOURCE}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
  if [ -n "${SCRIPT_DIR}" ] && [ -f "${SCRIPT_DIR}/.claude-plugin/marketplace.json" ]; then
    SOURCE="${SCRIPT_DIR}"
  else
    die "pass --source <owner/repo> (for example: --source your-user/codewright)"
  fi
fi

if [ "${SCOPE}" != user ]; then
  TOP="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  if [ -z "${TOP}" ]; then
    echo "  Note: this folder isn't a git repository. Run the script from your project's root folder."
  elif [ "$(pwd -P)" != "$(cd "${TOP}" && pwd -P)" ] && [ "${HERE}" != 1 ]; then
    # Codewright keeps test credentials in .codewright/; inside a web root like Laravel's public/ they could be served.
    SELF="$0"
    [ -f "${SELF}" ] && SELF="$(cd "$(dirname "${SELF}")" && pwd -P)/$(basename "${SELF}")"
    die "run this from your project's root folder, not a subfolder:
  cd \"${TOP}\" && bash \"${SELF}\" ${ARGS}
(If this subfolder really is a separate project, add --here.)"
  fi
  echo "Installing for the project in: ${PWD}"
fi

# Add the marketplace, or refresh it if it's already there.
if claude plugin marketplace list --json 2>/dev/null | node -e '
  let s = ""; process.stdin.on("data", (c) => (s += c)).on("end", () => {
    try { process.exit(JSON.parse(s).some((m) => m.name === process.argv[1]) ? 0 : 1); } catch { process.exit(1); }
  });' "${MARKETPLACE}"; then
  echo "Updating the ${MARKETPLACE} marketplace..."
  claude plugin marketplace update "${MARKETPLACE}"
else
  echo "Adding the ${MARKETPLACE} marketplace from ${SOURCE}..."
  claude plugin marketplace add "${SOURCE}"
fi

echo "Installing ${PLUGIN} (scope: ${SCOPE})..."
claude plugin install "${PLUGIN}" --scope "${SCOPE}"

if [ "${BROWSER}" = 1 ]; then
  echo "Installing Chrome for Playwright..."
  npx -y playwright install chrome \
    || echo "  Chrome install failed. Browser personas will fall back to the API. Retry with: npx playwright install chrome"
fi

cat <<EOF

Codewright is installed.
Next, in this project:
  1. Commit your work, so Codewright's changes stay one clean diff.
  2. Start Claude Code:   claude
  3. Set up the project:  /codewright:init
EOF
