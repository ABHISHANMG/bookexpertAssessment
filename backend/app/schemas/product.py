from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ProductBase(BaseModel):
    sku: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    reorder_level: int = Field(default=10, ge=0)


class ProductCreate(ProductBase):
    stock_quantity: int = Field(default=0, ge=0)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = None
    price: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    reorder_level: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class StockAdjust(BaseModel):
    quantity: int = Field(description="Positive to restock, negative to reduce")
    note: str | None = None


class ProductOut(ProductBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    stock_quantity: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class StockMovementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    change: int
    reason: str
    order_id: int | None
    note: str | None
    created_at: datetime
