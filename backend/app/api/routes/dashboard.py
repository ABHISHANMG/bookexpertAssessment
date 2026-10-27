from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.enums import OrderStatus
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.user import User
from app.schemas.dashboard import DashboardSummary, StatusCount, TopProduct

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def summary(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    # Revenue counts only completed orders.
    total_sales = db.execute(
        select(func.coalesce(func.sum(Order.total_amount), 0)).where(
            Order.status == OrderStatus.COMPLETED
        )
    ).scalar_one()

    total_orders = db.execute(select(func.count(Order.id))).scalar_one()

    status_rows = db.execute(
        select(Order.status, func.count(Order.id)).group_by(Order.status)
    ).all()
    orders_by_status = [
        StatusCount(status=s.value, count=c) for s, c in status_rows
    ]
    counts = {s.value: c for s, c in status_rows}

    total_products = db.execute(
        select(func.count(Product.id)).where(Product.is_active.is_(True))
    ).scalar_one()

    low_stock_products = db.execute(
        select(Product)
        .where(Product.is_active.is_(True))
        .where(Product.stock_quantity <= Product.reorder_level)
        .order_by(Product.stock_quantity)
    ).scalars().all()

    recent_orders = db.execute(
        select(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.customer),
            selectinload(Order.created_by),
            selectinload(Order.approved_by),
        )
        .order_by(Order.created_at.desc())
        .limit(5)
    ).scalars().all()

    top_rows = db.execute(
        select(
            OrderItem.product_id,
            Product.name,
            func.sum(OrderItem.quantity).label("units"),
            func.sum(OrderItem.line_total).label("revenue"),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .join(Product, Product.id == OrderItem.product_id)
        .where(Order.status == OrderStatus.COMPLETED)
        .group_by(OrderItem.product_id, Product.name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(5)
    ).all()
    top_products = [
        TopProduct(product_id=pid, name=name, units_sold=int(units),
                   revenue=Decimal(revenue))
        for pid, name, units, revenue in top_rows
    ]

    return DashboardSummary(
        total_sales=Decimal(total_sales),
        total_orders=total_orders,
        pending_approvals=counts.get(OrderStatus.PENDING_APPROVAL.value, 0),
        completed_orders=counts.get(OrderStatus.COMPLETED.value, 0),
        total_products=total_products,
        low_stock_count=len(low_stock_products),
        orders_by_status=orders_by_status,
        low_stock_products=low_stock_products,
        recent_orders=recent_orders,
        top_products=top_products,
    )
