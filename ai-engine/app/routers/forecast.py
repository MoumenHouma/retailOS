from fastapi import APIRouter, Depends, Header, HTTPException

from app.config import settings
from app.schemas.forecast import ForecastRequest, ForecastResponse
from app.services.prophet_forecast import run_forecast

router = APIRouter()


def verify_internal_token(authorization: str | None = Header(default=None)) -> None:
    """
    This service is only reachable inside the Docker network (never exposed
    publicly), so a single shared bearer token is enough — no per-tenant
    auth, no user identity, since Python never sees tenant data beyond what
    a single request body already contains.
    """
    expected = f"Bearer {settings.internal_token}"
    if not authorization or authorization != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing internal token")


@router.post("/forecast", response_model=ForecastResponse)
def forecast(
    request: ForecastRequest,
    _: None = Depends(verify_internal_token),
) -> ForecastResponse:
    if len(request.history) < 2:
        raise HTTPException(
            status_code=422,
            detail="At least 2 history points are required to fit a forecast.",
        )
    try:
        return run_forecast(request)
    except HTTPException:
        raise
    except Exception as exc:
        # Prophet/pandas errors here mean the input shape was unfittable
        # (e.g. all-zero history, single unique date) — a client-input
        # problem, not a server bug, hence 422 rather than 500.
        raise HTTPException(status_code=422, detail=f"Forecast failed: {exc}") from exc
