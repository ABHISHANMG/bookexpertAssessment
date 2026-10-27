class BusinessError(Exception):
    """Raised for domain/validation failures; mapped to an HTTP response."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class NotFoundError(BusinessError):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, status_code=404)


class InsufficientStockError(BusinessError):
    def __init__(self, message: str):
        super().__init__(message, status_code=409)
