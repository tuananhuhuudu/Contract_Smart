"""Evaluate milestones from JSON on stdin and print the decisions as JSON on stdout.

The API (apps/api/src/services/engine.service.ts) calls this script after every workflow action. It sends
rows in the organiser's Data Pack layout, built from the PostgreSQL tables, plus the event types of the
database so the policy knows every type people created on the web:

    {"contracts": [...], "parties": [...], "milestones": [...], "events": [...], "rules": [...],
     "event_types": {"DELIVERY": {"category": "EVIDENCE", "side": "SUPPLIER", "valid_status": "CONFIRMED"}, ...},
     "milestone_ids": ["12", "13"]}

The decision logic is the unchanged codecash_engine package (copied from the CodeCash project). Exit code 2
with a message on stderr means the input was rejected.
"""
import copy
import json
import sys
from datetime import date, datetime
from decimal import Decimal

from codecash_engine import DEFAULT_POLICY, Pack, Policy, evaluate


def encode(value):
    """JSON for the values the engine returns: money as exact strings, dates as ISO text."""
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, (set, frozenset, tuple)):
        return list(value)
    return str(value)


def policy_for(event_types):
    """The organiser's policy with the database's event types merged in (category, recording side, status)."""
    with open(DEFAULT_POLICY, encoding="utf-8") as handle:
        document = json.load(handle)
    merged = copy.deepcopy(document["event_types"])
    for code, kind in event_types.items():
        entry = {"category": kind["category"], "valid_status": kind["valid_status"]}
        if kind.get("side"):
            entry["side"] = kind["side"]
        merged[code] = {**merged.get(code, {}), **entry}
    document["event_types"] = merged
    return Policy(document)


def main():
    request = json.load(sys.stdin)
    pack = Pack(request["contracts"], request["parties"], request["milestones"], request["events"], request["rules"])
    policy = policy_for(request.get("event_types", {}))
    results = []
    for mid in request["milestone_ids"]:
        if mid not in pack.milestones:
            raise ValueError(f"UNKNOWN_MILESTONE {mid}")
        r = evaluate(pack, mid, policy=policy, explain=True)
        results.append({
            "milestone_id": mid, "decision": r["decision"], "reason_code": r["reason_code"], "rule_id": r["rule_id"],
            "status": r["status"], "payable": r["payable"], "penalty": r["penalty"],
            "missing": r["missing"], "unauthorized": r["unauthorized"], "duplicates": r["duplicates"],
            "unrelated": r["unrelated"], "open_dispute_ids": r["open_dispute_ids"],
            "valid_approval_count": r["valid_approval_count"], "quorum": r["quorum"], "days_late": r["days_late"],
            "completion_ts": r["completion_ts"], "warnings": r["warnings"], "issues": r["issues"],
            "variables": r["explanation"]["variables"], "trail": r["explanation"]["trail"],
        })
    json.dump({"results": results}, sys.stdout, default=encode, ensure_ascii=False)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError) as error:
        print(f"ENGINE_INPUT_REJECTED: {error}", file=sys.stderr)
        sys.exit(2)
