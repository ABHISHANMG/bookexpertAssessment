"""FastAPI application entrypoint."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import auth, customers, dashboard, orders, products
from app.core.config import settings
from app.services.exceptions import BusinessError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sims")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema is managed by Alembic migrations (run from entrypoint.sh before the
    # server starts). We only register models here for completeness.
    import app.models  # noqa: F401  ensures all models are registered
    logger.info("Application startup complete.")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(BusinessError)
async def business_error_handler(_: Request, exc: BusinessError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "app": settings.APP_NAME}


@app.get(f"{settings.API_V1_PREFIX}/config", tags=["meta"])
def public_config():
    """Non-sensitive config the frontend needs (e.g. the approval threshold)."""
    return {
        "app_name": settings.APP_NAME,
        "approval_threshold": settings.APPROVAL_THRESHOLD,
    }


for r in (auth, products, customers, orders, dashboard):
    app.include_router(r.router, prefix=settings.API_V1_PREFIX)
