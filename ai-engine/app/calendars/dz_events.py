"""
Algeria-specific event calendar, shaped as Prophet's own `holidays` dataframe
format (`holiday`, `ds`, `lower_window`, `upper_window`) so it can be passed
straight into `Prophet(holidays=...)`.

*** MAINTENANCE WARNING — READ BEFORE TRUSTING THESE DATES ***
Ramadan / Eid al-Fitr / Eid al-Adha are Islamic (Hijri) lunar-calendar events.
Their Gregorian dates shift ~10-11 days earlier every year and are only
*authoritatively* confirmed by moon-sighting announcements from Algeria's
Ministry of Religious Affairs a day or two before each event — they cannot be
purely computed the way a fixed civil-calendar date can. The dates below are
reasonable astronomical-calculation estimates (current year ±1), not
confirmed civil-authority announcements. **This file must be reviewed and
corrected/extended by hand every year**: verify each date against the
official Algerian calendar once announced, and add the next year's row
before the calendar runs out.

Back-to-school ("rentrée scolaire", ~September 1) is a fixed civil-calendar
event and needs no such yearly correction, only occasional confirmation of
the exact ministry-announced date.

Window semantics: `lower_window`/`upper_window` are day offsets from `ds`
(negative = before, positive = after) during which Prophet treats demand as
elevated by this event — e.g. Eid's pre-holiday buying spike is captured by a
negative lower_window.
"""

from __future__ import annotations

DZ_EVENTS: list[dict] = [
    # --- Ramadan: pre-Ramadan stocking-up spike (lower_window) plus the
    # entire fasting month's altered demand pattern (upper_window ~= 29 days). ---
    {"holiday": "ramadan", "ds": "2025-03-01", "lower_window": -3, "upper_window": 29},
    {"holiday": "ramadan", "ds": "2026-02-18", "lower_window": -3, "upper_window": 29},
    {"holiday": "ramadan", "ds": "2027-02-08", "lower_window": -3, "upper_window": 29},

    # --- Eid al-Fitr: sharp buying spike in the days immediately before. ---
    {"holiday": "eid_al_fitr", "ds": "2025-03-30", "lower_window": -5, "upper_window": 2},
    {"holiday": "eid_al_fitr", "ds": "2026-03-20", "lower_window": -5, "upper_window": 2},
    {"holiday": "eid_al_fitr", "ds": "2027-03-09", "lower_window": -5, "upper_window": 2},

    # --- Eid al-Adha: livestock/meat-heavy demand spike. ---
    {"holiday": "eid_al_adha", "ds": "2025-06-06", "lower_window": -5, "upper_window": 2},
    {"holiday": "eid_al_adha", "ds": "2026-05-27", "lower_window": -5, "upper_window": 2},
    {"holiday": "eid_al_adha", "ds": "2027-05-16", "lower_window": -5, "upper_window": 2},

    # --- Back-to-school (rentrée scolaire) — fixed civil-calendar date,
    # stable year to year, ~2 weeks of elevated stationery/clothing demand. ---
    {"holiday": "back_to_school", "ds": "2025-09-01", "lower_window": -14, "upper_window": 3},
    {"holiday": "back_to_school", "ds": "2026-09-01", "lower_window": -14, "upper_window": 3},
    {"holiday": "back_to_school", "ds": "2027-09-01", "lower_window": -14, "upper_window": 3},
]


def get_dz_holidays_dataframe():
    """Returns DZ_EVENTS as a pandas DataFrame shaped for Prophet(holidays=...)."""
    import pandas as pd

    return pd.DataFrame(DZ_EVENTS).assign(ds=lambda df: pd.to_datetime(df["ds"]))
