#!/usr/bin/env python3
"""Emit CME FedWatch move probabilities for FOMC meetings in the next 6 months.

Primary value per meeting = probability of a +25bp move into the next target
band (what CME FedWatch / media usually quote), not the sum of all hike bands.

Requires: pip install cme-fedwatch
"""

from __future__ import annotations

import json
import sys
from datetime import date, timedelta


def parse_target(label: str) -> tuple[float, float]:
    parts = label.replace("%", "").split("-")
    return float(parts[0]), float(parts[1])


def range_bounds(label: str) -> tuple[float, float]:
    parts = label.replace("%", "").split("-")
    return float(parts[0]), float(parts[1])


def move_probs(current_target: str, probabilities: dict[str, float]) -> dict[str, float]:
    """Split FedWatch target-range probs into hold / +25bp / ≥+50bp / cut."""
    cur_lo, cur_hi = parse_target(current_target)
    step = 0.25
    hold = 0.0
    hike25 = 0.0
    hike50_plus = 0.0
    cut = 0.0

    for band, raw in probabilities.items():
        p = float(raw)
        lo, hi = range_bounds(band)
        # Current target band → no change
        if abs(lo - cur_lo) < 1e-9 and abs(hi - cur_hi) < 1e-9:
            hold += p
        # Next higher 25bp band
        elif abs(lo - cur_hi) < 1e-9 and abs(hi - (cur_hi + step)) < 1e-9:
            hike25 += p
        # Higher still (≥ +50bp vs current)
        elif lo >= cur_hi + step - 1e-9:
            hike50_plus += p
        # Below current target
        elif hi <= cur_lo + 1e-9:
            cut += p
        # Overlapping / unexpected band — treat by midpoint vs current
        else:
            mid = (lo + hi) / 2
            cur_mid = (cur_lo + cur_hi) / 2
            if mid > cur_mid + step / 2:
                if mid <= cur_mid + step + step / 2:
                    hike25 += p
                else:
                    hike50_plus += p
            elif mid < cur_mid - step / 2:
                cut += p
            else:
                hold += p

    any_hike = round(hike25 + hike50_plus, 1)
    return {
        "hold": round(hold, 1),
        "hike25": round(hike25, 1),
        "hike50Plus": round(hike50_plus, 1),
        "cut": round(cut, 1),
        "anyHike": any_hike,
    }


def main() -> int:
    try:
        from cme_fedwatch import get_probabilities
    except ImportError:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "cme-fedwatch not installed (pip install cme-fedwatch)",
                }
            )
        )
        return 1

    try:
        latest = get_probabilities()
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 1

    meetings = latest.get("meetings") or []
    if not meetings:
        print(json.dumps({"ok": False, "error": "no upcoming FOMC priced"}))
        return 1

    target = latest["current_target"]
    trade_date = latest["trade_date"]
    today = date.today()
    cutoff = today + timedelta(days=183)

    outlook = []
    for meeting in meetings:
        meeting_dt = date.fromisoformat(meeting["date"])
        if meeting_dt > cutoff:
            continue
        moves = move_probs(target, meeting["probabilities"])
        outlook.append(
            {
                "period": meeting["date"],
                # Align with CME/media headline: +25bp target-band probability.
                "value": moves["hike25"],
                "contract": meeting.get("contract"),
                "probabilities": meeting["probabilities"],
                "hold": moves["hold"],
                "hike25": moves["hike25"],
                "hike50Plus": moves["hike50Plus"],
                "cut": moves["cut"],
                "anyHike": moves["anyHike"],
            }
        )

    if not outlook:
        print(json.dumps({"ok": False, "error": "no FOMC meetings in next 6 months"}))
        return 1

    first = outlook[0]
    print(
        json.dumps(
            {
                "ok": True,
                "currentTarget": target,
                "effr": latest.get("effr"),
                "tradeDate": trade_date,
                "horizonMonths": 6,
                "meetingDate": first["period"],
                "hikeProbability": first["value"],
                "hold": first["hold"],
                "hike25": first["hike25"],
                "hike50Plus": first["hike50Plus"],
                "cut": first["cut"],
                "anyHike": first["anyHike"],
                "outlook": outlook,
                "sourceUrl": "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html",
            }
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
