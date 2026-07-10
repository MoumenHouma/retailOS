"""Merges the static Algeria event calendar with any per-request ad-hoc events
into the single `holidays` dataframe Prophet's constructor expects.
"""

from __future__ import annotations

import pandas as pd

from app.calendars.dz_events import get_dz_holidays_dataframe
from app.schemas.forecast import ForecastEvent


def build_holidays_dataframe(events: list[ForecastEvent] | None) -> pd.DataFrame:
    base = get_dz_holidays_dataframe()
    if not events:
        return base

    extra = pd.DataFrame(
        [
            {
                "holiday": event.holiday,
                "ds": pd.to_datetime(event.ds),
                "lower_window": event.lower_window,
                "upper_window": event.upper_window,
            }
            for event in events
        ]
    )
    return pd.concat([base, extra], ignore_index=True)
