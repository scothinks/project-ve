#!/usr/bin/env python3
"""Injects the mandatory Project VE guardrails into context.

Used by SessionStart and PostCompact hooks (see .claude/settings.json) so the
guardrails in docs/codex/skills/project-ve-guardrails/SKILL.md are always
present, not dependent on the model choosing to look them up.
"""
import json
import pathlib
import sys

sys.stdin.read()

root = pathlib.Path(__file__).resolve().parents[2]
guardrails_path = root / "docs" / "codex" / "skills" / "project-ve-guardrails" / "SKILL.md"
content = guardrails_path.read_text()

event = sys.argv[1] if len(sys.argv) > 1 else "SessionStart"

preamble = (
    "PROJECT VE GUARDRAILS — mandatory standing policy for this repository "
    "(see AGENTS.md). These are binding for every task, not a suggestion to "
    "weigh against convenience or task size:\n\n"
)

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": event,
        "additionalContext": preamble + content,
    }
}))
