"""Sales-order business logic: validation, approval workflow, inventory.

The functions here own all the rules so routes stay thin. Inventory is only ever
deducted inside :func:`_fulfill_order`, which locks product rows
(``SELECT ... FOR UPDATE``) and commits atomically so two concurrent orders can
never oversell the same stock.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.customer import Customer
from app.models.enums import OrderStatus, StockMovementReason, UserRole
from app.models.order import Order, OrderItem, StockMovement
from app.models.product import Product
from app.models.user import User
from app.schemas.order import OrderCreate
from app.services.exceptions import (
    BusinessError,
    InsufficientStockError,
    NotFoundError,
)


@dataclass
class EmailIntent:
    """A pending email the route should schedule after the request succeeds."""
    to: list[str]
    subject: str
    body: str


def _next_order_number(db: Session) -> str:
    seq = db.execute(select(func.coalesce(func.max(Order.id), 0))).scalar_one()
    return f"SO-{seq + 1:06d}"


def _manager_emails(db: Session) -> list[str]:
    rows = db.execute(
        select(User.email).where(
            User.role.in_([UserRole.MANAGER, UserRole.ADMIN]),
            User.is_active.is_(True),
        )
    ).scalars().all()
    return list(rows) or [settings.MANAGER_FALLBACK_EMAIL]


def create_order(
    db: Session, payload: OrderCreate, current_user: User
) -> tuple[Order, list[EmailIntent]]:
    """Validate an order, persist it, and either auto-complete it or route it
    for manager approval. Returns the order plus any emails to send."""
    customer = db.get(Customer, payload.customer_id)
    if customer is None:
        raise NotFoundError("Customer not found")

    # Collapse duplicate product lines and validate quantities.
    merged: dict[int, int] = {}
    for item in payload.items:
        if item.quantity <= 0:
            raise BusinessError("Quantity must be a positive integer")
        merged[item.product_id] = merged.get(item.product_id, 0) + item.quantity

    order = Order(
        order_number=_next_order_number(db),
        customer_id=customer.id,
        created_by_id=current_user.id,
        status=OrderStatus.PENDING_APPROVAL,
        total_amount=Decimal("0.00"),
    )

    total = Decimal("0.00")
    for product_id, quantity in merged.items():
        product = db.get(Product, product_id)
        if product is None or not product.is_active:
            raise NotFoundError(f"Product {product_id} not found or inactive")
        if product.stock_quantity < quantity:
            raise InsufficientStockError(
                f"Insufficient stock for '{product.name}': "
                f"requested {quantity}, available {product.stock_quantity}"
            )
        unit_price = Decimal(product.price)
        line_total = unit_price * quantity
        total += line_total
        order.items.append(
            OrderItem(
                product_id=product.id,
                quantity=quantity,
                unit_price=unit_price,
                line_total=line_total,
            )
        )

    order.total_amount = total
    order.requires_approval = total > Decimal(str(settings.APPROVAL_THRESHOLD))

    emails: list[EmailIntent] = []
    if order.requires_approval:
        # Hold for approval; stock is validated now and re-checked at approval.
        order.status = OrderStatus.PENDING_APPROVAL
        db.add(order)
        db.commit()
        db.refresh(order)
        emails.append(
            EmailIntent(
                to=_manager_emails(db),
                subject=f"[Approval needed] Order {order.order_number} "
                        f"— {total:.2f}",
                body=(
                    f"Order {order.order_number} created by {current_user.name} "
                    f"for customer {customer.name} totals {total:.2f}, which is "
                    f"above the approval threshold of "
                    f"{settings.APPROVAL_THRESHOLD:.2f}.\n\n"
                    f"Please review and approve or reject it in the dashboard."
                ),
            )
        )
    else:
        # Below threshold: fulfill immediately in one transaction.
        db.add(order)
        db.flush()
        _fulfill_order(db, order)
        order.status = OrderStatus.COMPLETED
        db.commit()
        db.refresh(order)

    return order, emails


def approve_order(
    db: Session, order_id: int, manager: User, notes: str | None
) -> tuple[Order, list[EmailIntent]]:
    order = _get_pending(db, order_id)
    _fulfill_order(db, order)  # re-validates stock and deducts atomically
    order.status = OrderStatus.COMPLETED
    order.approved_by_id = manager.id
    order.decision_notes = notes
    order.decided_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)

    emails = [
        EmailIntent(
            to=[order.created_by.email],
            subject=f"Order {order.order_number} approved",
            body=(
                f"Good news — your order {order.order_number} "
                f"({order.total_amount:.2f}) was approved by {manager.name} "
                f"and has been completed. Inventory has been updated."
                + (f"\n\nManager notes: {notes}" if notes else "")
            ),
        )
    ]
    return order, emails


def reject_order(
    db: Session, order_id: int, manager: User, notes: str | None
) -> tuple[Order, list[EmailIntent]]:
    order = _get_pending(db, order_id)
    order.status = OrderStatus.REJECTED
    order.approved_by_id = manager.id
    order.decision_notes = notes
    order.decided_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)

    emails = [
        EmailIntent(
            to=[order.created_by.email],
            subject=f"Order {order.order_number} rejected",
            body=(
                f"Your order {order.order_number} ({order.total_amount:.2f}) "
                f"was rejected by {manager.name}. No inventory was changed."
                + (f"\n\nReason: {notes}" if notes else "")
            ),
        )
    ]
    return order, emails


def cancel_order(db: Session, order_id: int, user: User) -> Order:
    order = db.get(Order, order_id)
    if order is None:
        raise NotFoundError("Order not found")
    if order.status != OrderStatus.PENDING_APPROVAL:
        raise BusinessError(
            f"Only pending orders can be cancelled (status is {order.status.value})"
        )
    if user.role == UserRole.SALES and order.created_by_id != user.id:
        raise BusinessError("You can only cancel your own orders", status_code=403)
    order.status = OrderStatus.CANCELLED
    db.commit()
    db.refresh(order)
    return order


def _get_pending(db: Session, order_id: int) -> Order:
    order = db.get(Order, order_id)
    if order is None:
        raise NotFoundError("Order not found")
    if order.status != OrderStatus.PENDING_APPROVAL:
        raise BusinessError(
            f"Order {order.order_number} is not awaiting approval "
            f"(status is {order.status.value})"
        )
    return order


def _fulfill_order(db: Session, order: Order) -> None:
    """Deduct stock for every line atomically with row-level locks.

    Raises :class:`InsufficientStockError` (rolling back) if anything is short,
    so an order is never partially fulfilled.
    """
    for item in order.items:
        # Lock the product row for the duration of the transaction.
        product = db.execute(
            select(Product).where(Product.id == item.product_id).with_for_update()
        ).scalar_one_or_none()
        if product is None:
            db.rollback()
            raise NotFoundError(f"Product {item.product_id} no longer exists")
        if product.stock_quantity < item.quantity:
            db.rollback()
            raise InsufficientStockError(
                f"Insufficient stock for '{product.name}': "
                f"requested {item.quantity}, available {product.stock_quantity}"
            )
        product.stock_quantity -= item.quantity
        db.add(
            StockMovement(
                product_id=product.id,
                change=-item.quantity,
                reason=StockMovementReason.ORDER_FULFILLMENT,
                order_id=order.id,
                note=f"Order {order.order_number}",
            )
        )
