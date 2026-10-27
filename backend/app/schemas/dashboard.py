from decimal import Decimal

from pydantic import BaseModel

from app.schemas.order import OrderOut
from app.schemas.product import ProductOut


class StatusCount(BaseModel):
    status: str
    count: int


class TopProduct(BaseModel):
    product_id: int
    name: str
    units_sold: int
    revenue: Decimal


class DashboardSummary(BaseModel):
    total_sales: Decimal          # revenue from COMPLETED orders
    total_orders: int
    pending_approvals: int
    completed_orders: int
    total_products: int
    low_stock_count: int
    orders_by_status: list[StatusCount]
    low_stock_products: list[ProductOut]
    recent_orders: list[OrderOut]
    top_products: list[TopProduct]
