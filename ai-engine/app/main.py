from fastapi import FastAPI

from app.routers import forecast, health

app = FastAPI(title="RetailOS AI Engine", version="0.1.0")

app.include_router(health.router)
app.include_router(forecast.router)
