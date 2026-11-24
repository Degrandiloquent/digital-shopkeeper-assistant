import logging
import sys
import uuid
from collections.abc import Awaitable, Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


class CorrelationIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "correlation_id"):
            record.correlation_id = "-"
        return True


def configure_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(CorrelationIdFilter())
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s correlation_id=%(correlation_id)s %(message)s")
    )
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Tags every request with an id that appears in the logs and in every error response."""

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))[:64]
        request.state.correlation_id = correlation_id
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = correlation_id
        return response
