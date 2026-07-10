"""
Pure stateless compute: pandas dataframe in, Prophet fit + predict, response
out. No I/O beyond what the caller already gave it in the request body — no
database connection of any kind (see app/config.py).
"""

from __future__ import annotations

import pandas as pd
import prophet as prophet_module
from prophet import Prophet

from app.schemas.forecast import ForecastPoint, ForecastRequest, ForecastResponse
from app.services.seasonality import build_holidays_dataframe

MODEL_NAME = "prophet"


def run_forecast(request: ForecastRequest) -> ForecastResponse:
    history_df = pd.DataFrame(
        [{"ds": point.date, "y": point.quantity} for point in request.history]
    )
    holidays = build_holidays_dataframe(request.events)

    model = Prophet(
        holidays=holidays,
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
        interval_width=0.95,
    )
    model.fit(history_df)

    future = model.make_future_dataframe(periods=request.horizonDays, include_history=False)
    forecast = model.predict(future)

    predictions = [
        ForecastPoint(
            date=row.ds.date(),
            # Demand quantities can't be negative — Prophet's linear trend
            # can still predict below zero for sparse/declining history, so
            # floor every bound at 0 rather than pass a negative "quantity"
            # downstream.
            predictedQuantity=max(0.0, float(row.yhat)),
            predictedLower=max(0.0, float(row.yhat_lower)),
            predictedUpper=max(0.0, float(row.yhat_upper)),
        )
        for row in forecast.itertuples()
    ]

    return ForecastResponse(
        productId=request.productId,
        storeId=request.storeId,
        modelUsed=MODEL_NAME,
        modelVersion=prophet_module.__version__,
        predictions=predictions,
    )
