from __future__ import annotations

from datetime import date as Date

from pydantic import BaseModel, Field


class SalesHistoryPoint(BaseModel):
    """One day of exported sales history for a single product/store pair."""

    date: Date
    quantity: float


class ForecastEvent(BaseModel):
    """
    Ad-hoc event supplied by the caller, on top of the static Algeria
    calendar (app/calendars/dz_events.py) — shaped identically to Prophet's
    own `holidays` dataframe columns so the two can be concatenated as-is.
    """

    holiday: str
    ds: Date
    lower_window: int = 0
    upper_window: int = 0


class ForecastRequest(BaseModel):
    productId: str
    storeId: str
    history: list[SalesHistoryPoint]
    horizonDays: int = Field(default=30, ge=1, le=365)
    events: list[ForecastEvent] | None = None


class ForecastPoint(BaseModel):
    date: Date
    predictedQuantity: float
    predictedLower: float
    predictedUpper: float


class ForecastResponse(BaseModel):
    productId: str
    storeId: str
    modelUsed: str
    modelVersion: str
    predictions: list[ForecastPoint]
