"""Import all models so SQLAlchemy's metadata is fully populated."""
from app.models.customer import Customer
from app.models.order import Order, OrderItem, StockMovement
from app.models.product import Product
from app.models.user import User

__all__ = [
    "User",
    "Product",
    "Customer",
    "Order",
    "OrderItem",
    "StockMovement",
]
