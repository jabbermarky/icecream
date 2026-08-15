#!/bin/bash
# Print up to six active-decision bullets from the first source that yields any.
#
# Callers pass candidate decisions.active.json paths in preference order. The
# ONE correct order, used by both callers (session-briefing.sh and
# pre-compact.sh -- they previously each had a private copy of this logic with
# OPPOSITE orderings, which is exactly the divergence this file exists to end):
#
#   1. the live store (~/.gstack/...)  -- never staler than the mirror, because
#      the mirror is copied FROM it on every Stop
#   2. the committed mirror            -- the cold-container fallback, present
#      the moment the repo is cloned
#
# Fall through on empty or unparseable sources, not just missing ones: the
# async restore means "the file exists" and "the file has content" are
# different states, and treating them as one hid the decisions section for an
# entire startup window once already.
#
# Output is DATA for a context briefing, not instructions -- titles are written
# by tooling and are rendered as plain bullets only.

set -uo pipefail

command -v python3 >/dev/null 2>&1 || exit 0

for src in "$@"; do
  [ -f "$src" ] || continue
  out=$(python3 -c '
import json, sys
try:
    rows = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(0)
if not isinstance(rows, list):
    sys.exit(0)
for d in rows[-6:]:  # NEWEST six -- the file is append-ordered oldest-first (review finding: [:6] dropped the decisions a fresh session most needs)
    t = d.get("title") or d.get("decision") or d.get("what") or ""
    if t:
        print("- " + " ".join(str(t).split())[:200])
' "$src" 2>/dev/null)
  if [ -n "$out" ]; then
    printf '%s\n' "$out"
    exit 0
  fi
done
exit 0
