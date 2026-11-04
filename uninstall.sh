#!/usr/bin/env bash
# Uninstalls the Codewright skill from Claude Code.
#
#   bash uninstall.sh [--scope user|project] [--purge] [-y]
#
#   --scope  the scope it was installed with: user (default) or project
#   --purge  also delete this project's .codewright/ folder: knowledge base, run history,
#            your permission policy and test accounts. Asks first unless -y is given.
#   -y       don't ask for confirmation
#
# Run it from your project's root folder for the project scope and for --purge.
set -euo pipefail

SCOPE=user
PURGE=0
YES=0

die() { echo "uninstall.sh: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --scope) SCOPE="${2:-}"; shift 2 ;;
    --purge) PURGE=1; shift ;;
    -y|--yes) YES=1; shift ;;
    -h|--help) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown option: $1 (see --help)" ;;
  esac
done

case "${SCOPE}" in user|project) ;; *) die "--scope must be user or project" ;; esac
if [ "${SCOPE}" = user ]; then BASE="${HOME}/.claude"; else BASE="${PWD}/.claude"; fi
SKILL_DIR="${BASE}/skills/codewright"
HAS_CLAUDE=0; command -v claude >/dev/null 2>&1 && HAS_CLAUDE=1

if [ "${PURGE}" = 1 ] && [ -d .codewright ]; then
  if [ "${YES}" != 1 ]; then
    printf 'Delete %s/.codewright (knowledge base, run history, permission policy, test accounts)? [y/N] ' "${PWD}"
    read -r answer < /dev/tty || answer=""
    case "${answer}" in y|Y|yes|YES) ;; *) echo "Kept .codewright/."; PURGE=0 ;; esac
  fi
  if [ "${PURGE}" = 1 ]; then
    # Stop the test app Codewright started, if it's still running.
    if [ -f .codewright/app.json ] && command -v node >/dev/null 2>&1; then
      node -e '
        const { pid } = JSON.parse(require("fs").readFileSync(".codewright/app.json", "utf8"));
        for (const target of [-pid, pid]) { try { process.kill(target, "SIGTERM"); break; } catch {} }
      ' 2>/dev/null || true
    fi
    rm -rf .codewright
    echo "Deleted .codewright/."
  fi
elif [ "${PURGE}" = 1 ]; then
  echo "No .codewright/ folder in ${PWD}; nothing to purge."
fi

# Hooks first, while the installed helper that removes them still exists.
SETTINGS_HELPER="${SKILL_DIR}/scripts/settings.mjs"
[ -f "${SETTINGS_HELPER}" ] || SETTINGS_HELPER="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)/skill/scripts/settings.mjs"
if [ -f "${BASE}/settings.json" ]; then
  if [ -f "${SETTINGS_HELPER}" ] && command -v node >/dev/null 2>&1; then
    node "${SETTINGS_HELPER}" uninstall "${BASE}/settings.json" && echo "Removed Codewright's hooks from ${BASE}/settings.json."
  else
    echo "Couldn't remove the hooks automatically: delete the two hooks that mention skills/codewright/scripts from ${BASE}/settings.json."
  fi
fi

removed=0
for role in "${BASE}"/agents/codewright-*.md; do
  if [ -f "${role}" ]; then rm -f "${role}"; removed=$((removed + 1)); fi
done
[ "${removed}" -gt 0 ] && echo "Removed ${removed} Codewright agents from ${BASE}/agents."

if [ -d "${SKILL_DIR}" ]; then
  rm -rf "${SKILL_DIR}"
  echo "Removed the skill from ${SKILL_DIR}."
else
  echo "No Codewright skill in ${SKILL_DIR}. If you installed with the other scope, add --scope user or --scope project."
fi

if [ "${HAS_CLAUDE}" = 1 ]; then
  claude mcp remove codewright-playwright --scope "${SCOPE}" >/dev/null 2>&1 && echo "Removed the codewright-playwright browser server."
  # Codewright 1.x was a plugin.
  if claude plugin list --json 2>/dev/null | grep -q '"codewright@codewright"'; then
    for s in user project local; do claude plugin uninstall codewright@codewright --scope "${s}" >/dev/null 2>&1 || true; done
    claude plugin marketplace remove codewright >/dev/null 2>&1 || true
    echo "Removed the old Codewright plugin."
  fi
fi

echo "Done."
