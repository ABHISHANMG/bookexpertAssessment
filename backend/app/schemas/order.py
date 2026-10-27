from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import OrderStatus
from app.schemas.customer import CustomerOut
from app.schemas.user import UserOut


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class OrderCreate(BaseModel):
    customer_id: int
    items: list[OrderItemCreate] = Field(min_length=1)


class OrderDecision(BaseModel):
    """Manager approve/reject payload."""
    notes: str | None = None


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    line_total: Decimal
    product: "ProductBrief"


class ProductBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    sku: str
    name: str


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    order_number: str
    status: OrderStatus
    total_amount: Decimal
    requires_approval: bool
    decision_notes: str | None
    decided_at: datetime | None
    created_at: datetime
    customer: CustomerOut
    created_by: UserOut
    approved_by: UserOut | None
    items: list[OrderItemOut]


OrderItemOut.model_rebuild()
