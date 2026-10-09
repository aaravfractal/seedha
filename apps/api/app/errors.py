"""Typed API errors with a stable JSON shape: {"error": {"code", "message"}}."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ApiError(Exception):
    """An error the client should see, with an HTTP status and a short code."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def _body(code: str, message: str, details: object = None) -> dict[str, object]:
    error: dict[str, object] = {"code": code, "message": message}
    if details is not None:
        error["details"] = details
    return {"error": error}


def install_error_handlers(app: FastAPI) -> None:
    """Map ApiError and validation errors to the shared JSON shape."""

    async def api_error(_request: Request, exc: Exception) -> JSONResponse:
        assert isinstance(exc, ApiError)  # noqa: S101  (registered for ApiError only)
        return JSONResponse(status_code=exc.status, content=_body(exc.code, exc.message))

    async def validation_error(_request: Request, exc: Exception) -> JSONResponse:
        assert isinstance(exc, RequestValidationError)  # noqa: S101
        details = [
            {"field": ".".join(str(p) for p in err["loc"][1:]), "problem": err["msg"]}
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=422, content=_body("invalid_input", "Some fields are not valid", details)
        )

    app.add_exception_handler(ApiError, api_error)
    app.add_exception_handler(RequestValidationError, validation_error)
