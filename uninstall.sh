#!/usr/bin/env bash
# Uninstalls Codewright from Claude Code.
#
#   ./uninstall.sh [--scope local|project|user] [--purge] [--remove-marketplace] [-y]
#
#   --scope               the scope it was installed with (default: local)
#   --purge               also delete this project's .codewright/ folder: knowledge base, run history,
#                         your permission policy and test accounts. Asks first unless -y is given.
#   --remove-marketplace  also remove the codewright marketplace from Claude Code
#   -y                    don't ask for confirmation
#
# Run it from your project's folder for the local and project scopes, and for --purge.
set -euo pipefail

SCOPE=local
PURGE=0
REMOVE_MARKETPLACE=0
YES=0
MARKETPLACE=codewright
PLUGIN=codewright@codewright

die() { echo "uninstall.sh: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --scope) SCOPE="${2:-}"; shift 2 ;;
    --purge) PURGE=1; shift ;;
    --remove-marketplace) REMOVE_MARKETPLACE=1; shift ;;
    -y|--yes) YES=1; shift ;;
    -h|--help) sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown option: $1 (see --help)" ;;
  esac
done

case "$SCOPE" in local|project|user) ;; *) die "--scope must be local, project or user" ;; esac
command -v claude >/dev/null 2>&1 || die "Claude Code isn't installed, so there's nothing to uninstall."

if [ "$PURGE" = 1 ] && [ -d .codewright ]; then
  if [ "$YES" != 1 ]; then
    printf 'Delete %s/.codewright (knowledge base, run history, permission policy, test accounts)? [y/N] ' "$PWD"
    read -r answer < /dev/tty || answer=""
    case "$answer" in y|Y|yes|YES) ;; *) echo "Kept .codewright/."; PURGE=0 ;; esac
  fi
  if [ "$PURGE" = 1 ]; then
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
elif [ "$PURGE" = 1 ]; then
  echo "No .codewright/ folder in $PWD; nothing to purge."
fi

echo "Uninstalling $PLUGIN (scope: $SCOPE)…"
claude plugin uninstall "$PLUGIN" --scope "$SCOPE" \
  || echo "  It wasn't installed at scope '$SCOPE'. Try --scope user, project or local."

if [ "$REMOVE_MARKETPLACE" = 1 ]; then
  claude plugin marketplace remove "$MARKETPLACE" || echo "  The $MARKETPLACE marketplace wasn't configured."
fi

echo "Done."
