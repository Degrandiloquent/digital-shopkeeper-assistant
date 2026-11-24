import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as api_router
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.logging import CorrelationIdMiddleware, configure_logging

settings = get_settings()
configure_logging()
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description=(
        "Backend for the Digital Shopkeeper's Assistant prototype. All data is fictional demo data. "
        "Sign in with POST /auth/login, then pass the access token as a Bearer token."
    ),
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url="/redoc" if settings.docs_enabled else None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
)

app.add_middleware(CorrelationIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,  # Tokens travel in the Authorization header, not in cookies.
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Correlation-ID"],
    expose_headers=["Retry-After", "X-Correlation-ID"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("X-Frame-Options", "DENY")
    # Private data is never cached by the browser or a proxy. The public shop endpoint sets its own value.
    if "cache-control" not in response.headers and not request.url.path.startswith(("/docs", "/redoc")):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.middleware("http")
async def request_logging(request: Request, call_next):
    response = await call_next(request)
    correlation_id = getattr(request.state, "correlation_id", "-")
    logger.info(
        "%s %s -> %s",
        request.method,
        request.url.path,
        response.status_code,
        extra={"correlation_id": correlation_id},
    )
    return response


register_error_handlers(app)
app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/", include_in_schema=False)
async def root() -> dict:
    return {"name": settings.app_name, "docs": "/docs" if settings.docs_enabled else None, "health": f"{settings.api_prefix}/health"}
