#!/usr/bin/env bash
set -euo pipefail

# Minimal private runtime gate:
# 1) openclaw version reachable
# 2) gateway RPC healthy
# 3) frontdoor delegation smoke returns RUN_ACCEPTED
# 4) spawned child session is stored in child agent session store and subagent run has no workspace inheritance

say() {
  printf '[preflight] %s\n' "$*"
}

fail() {
  printf '[preflight] FAIL: %s\n' "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

need_cmd openclaw
need_cmd python3

TIMEOUT_SECONDS="${OC_PREFLIGHT_TIMEOUT_SECONDS:-120}"
FRONTDOOR_AGENT="${OC_PREFLIGHT_FRONTDOOR_AGENT:-frontdoor}"
TARGET_AGENT="${OC_PREFLIGHT_TARGET_AGENT:-worker}"

say "1/4 checking OpenClaw CLI version"
VERSION_LINE="$(openclaw --version 2>/dev/null || true)"
[[ -n "$VERSION_LINE" ]] || fail "openclaw --version returned empty output"
say "version: $VERSION_LINE"

say "2/4 checking gateway health"
GW_STATUS="$(openclaw gateway status 2>/dev/null || true)"
grep -q "RPC probe: ok" <<<"$GW_STATUS" || fail "gateway status does not report 'RPC probe: ok'"
say "gateway rpc probe: ok"

say "3/4 running frontdoor delegation smoke"
PROMPT="Delegate to ${TARGET_AGENT} and respond with a RUN_ACCEPTED line."
RUN_JSON="$(openclaw agent --agent "$FRONTDOOR_AGENT" --message "$PROMPT" --timeout "$TIMEOUT_SECONDS" --json 2>/dev/null || true)"
[[ -n "$RUN_JSON" ]] || fail "openclaw agent returned empty output"

PY_OUT="$(python3 - "$RUN_JSON" "$TARGET_AGENT" <<'PY'
import json
import re
import sys

raw = sys.argv[1]
target = sys.argv[2]

try:
    data = json.loads(raw)
except Exception:
    print("ERR:invalid_json")
    sys.exit(2)

payloads = (((data.get("result") or {}).get("payloads")) or [])
text = "\n".join(
    p.get("text", "")
    for p in payloads
    if isinstance(p, dict) and isinstance(p.get("text"), str)
)

if "RUN_ACCEPTED" not in text:
    print("ERR:no_run_accepted")
    sys.exit(3)

run_match = re.search(r"RUN_ACCEPTED\s+([0-9a-fA-F-]{36})", text)
if not run_match:
    print("ERR:no_run_id")
    sys.exit(4)

child_match = re.search(rf"agent:{re.escape(target)}:subagent:[0-9a-fA-F-]+", text)
if not child_match:
    print("ERR:no_child_session_key")
    sys.exit(5)

print(run_match.group(1))
print(child_match.group(0))
PY
)"

RUN_ID="$(sed -n '1p' <<<"$PY_OUT")"
CHILD_KEY="$(sed -n '2p' <<<"$PY_OUT")"
[[ "$RUN_ID" == ERR:* ]] && fail "$RUN_ID"
[[ "$CHILD_KEY" == ERR:* ]] && fail "$CHILD_KEY"
say "delegation accepted: runId=$RUN_ID child=$CHILD_KEY"

say "4/4 checking subagent run metadata + child store placement"
python3 - "$RUN_ID" "$CHILD_KEY" <<'PY'
import json
import os
import re
import sys

run_id = sys.argv[1]
child_key = sys.argv[2]
state = os.path.expanduser("~/.openclaw")
runs_path = os.path.join(state, "subagents", "runs.json")

if not os.path.exists(runs_path):
    print("ERR:runs_json_missing")
    sys.exit(11)

with open(runs_path, "r", encoding="utf-8") as fh:
    runs_doc = json.load(fh)
runs = runs_doc.get("runs", {})
entry = runs.get(run_id)
if not entry:
    print("ERR:run_id_not_found")
    sys.exit(12)

if entry.get("childSessionKey") != child_key:
    print("ERR:child_key_mismatch")
    sys.exit(13)

# No workspace inheritance bleed is expected.
if "workspaceDir" in entry and entry.get("workspaceDir") not in (None, ""):
    print("ERR:workspace_inheritance_detected")
    sys.exit(14)

m = re.match(r"^agent:([^:]+):subagent:", child_key)
if not m:
    print("ERR:cannot_parse_agent_from_child_key")
    sys.exit(15)

agent_id = m.group(1)
store_path = os.path.join(state, "agents", agent_id, "sessions", "sessions.json")
if not os.path.exists(store_path):
    print("ERR:child_store_missing")
    sys.exit(16)

with open(store_path, "r", encoding="utf-8") as fh:
    store = json.load(fh)
if child_key not in store:
    print("ERR:child_not_in_child_store")
    sys.exit(17)

print(f"OK:{agent_id}:{store_path}")
PY

say "PASS all checks"
