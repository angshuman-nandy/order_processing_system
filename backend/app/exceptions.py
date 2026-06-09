from __future__ import annotations


class AppError(Exception):
    """Base class for domain errors raised by the service layer.

    Routers never see these directly — a single FastAPI exception handler
    in main.py translates them into HTTP responses using `status_code`.
    """

    status_code = 500

    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class NotFoundError(AppError):
    status_code = 404


class ForbiddenError(AppError):
    status_code = 403


class BadRequestError(AppError):
    status_code = 400


class AuthError(AppError):
    status_code = 401
