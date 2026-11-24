"""One error shape for the whole API:

    {"error": {"code": "insufficient_stock", "message": "...", "details": [...], "correlation_id": "..."}}

The frontend reads `error.message` for people and `error.code` for logic.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

_STATUS_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    422: "validation_error",
    429: "too_many_requests",
}


class AppError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        details: Any = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        self.details = details
        self.headers = headers


class Unauthorized(AppError):
    status_code = 401
    code = "unauthorized"


class Forbidden(AppError):
    status_code = 403
    code = "forbidden"


class NotFound(AppError):
    status_code = 404
    code = "not_found"


class Conflict(AppError):
    status_code = 409
    code = "conflict"


class TooManyRequests(AppError):
    status_code = 429
    code = "too_many_requests"


class DomainValidationError(AppError):
    status_code = 422
    code = "validation_error"


def _envelope(request: Request, code: str, message: str, details: Any = None) -> dict[str, Any]:
    error: dict[str, Any] = {
        "code": code,
        "message": message,
        "correlation_id": getattr(request.state, "correlation_id", "-"),
    }
    if details is not None:
        error["details"] = details
    return {"error": error}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(request, exc.code, exc.message, exc.details),
            headers=exc.headers,
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _STATUS_CODES.get(exc.status_code, "http_error")
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(request, code, str(exc.detail)),
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        details = jsonable_encoder(exc.errors(), custom_encoder={Exception: str})
        # The first problem, in words a shop assistant can act on.
        first = details[0] if details else {}
        field = ".".join(str(part) for part in first.get("loc", []) if part not in ("body", "query", "path"))
        message = (
            f"{field}: {first['msg']}" if field and first.get("msg") else "Please check the details you entered."
        )
        return JSONResponse(status_code=422, content=_envelope(request, "validation_error", message, details))

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(
            "unhandled_exception", extra={"correlation_id": getattr(request.state, "correlation_id", "-")}
        )
        return JSONResponse(
            status_code=500,
            content=_envelope(request, "internal_error", "Something went wrong on our side. Try again shortly."),
        )
