#!/usr/bin/env python3
"""Inject the canonical Project VE guardrails into agent context."""

import json
import pathlib
import sys


def read_input() -> dict:
    raw = sys.stdin.read()
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


payload = read_input()
root = pathlib.Path(__file__).resolve().parents[2]
guardrails_path = root / "docs" / "codex" / "skills" / "project-ve-guardrails" / "SKILL.md"
content = guardrails_path.read_text(encoding="utf-8")
event = (
    sys.argv[1]
    if len(sys.argv) > 1
    else str(payload.get("hook_event_name") or "SessionStart")
)

preamble = (
    "PROJECT VE GUARDRAILS — mandatory standing policy for this repository "
    "(see AGENTS.md). Apply the architecture, performance/read-path, security, "
    "test/CI, product-scope and documentation rules throughout this task:\n\n"
)

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": event,
        "additionalContext": preamble + content,
    }
}))
