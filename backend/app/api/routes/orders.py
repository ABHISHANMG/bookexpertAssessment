from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, require_manager
from app.core.database import get_db
from app.models.enums import OrderStatus, UserRole
from app.models.order import Order
from app.models.user import User
from app.schemas.order import OrderCreate, OrderDecision, OrderOut
from app.services import order_service
from app.services.email import send_email
from app.services.invoice import build_invoice_pdf
from app.services.order_service import EmailIntent

router = APIRouter(prefix="/orders", tags=["orders"])


def _schedule_emails(background: BackgroundTasks, intents: list[EmailIntent]) -> None:
    for intent in intents:
        background.add_task(send_email, intent.to, intent.subject, intent.body)


def _load(db: Session, order_id: int) -> Order | None:
    return db.execute(
        select(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.customer),
            selectinload(Order.created_by),
            selectinload(Order.approved_by),
        )
        .where(Order.id == order_id)
    ).scalar_one_or_none()


@router.get("", response_model=list[OrderOut])
def list_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status_filter: OrderStatus | None = Query(default=None, alias="status"),
    mine: bool = Query(default=False),
):
    stmt = select(Order).options(
        selectinload(Order.items),
        selectinload(Order.customer),
        selectinload(Order.created_by),
        selectinload(Order.approved_by),
    )
    if status_filter:
        stmt = stmt.where(Order.status == status_filter)
    # Sales users only ever see their own orders; managers/admins see everything.
    if mine or current_user.role == UserRole.SALES:
        stmt = stmt.where(Order.created_by_id == current_user.id)
    return db.execute(stmt.order_by(Order.created_at.desc())).scalars().all()


@router.get("/pending", response_model=list[OrderOut],
            dependencies=[Depends(require_manager)])
def pending_approvals(db: Session = Depends(get_db)):
    stmt = (
        select(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.customer),
            selectinload(Order.created_by),
        )
        .where(Order.status == OrderStatus.PENDING_APPROVAL)
        .order_by(Order.created_at)
    )
    return db.execute(stmt).scalars().all()


@router.post("", response_model=OrderOut, status_code=201)
def create_order(
    payload: OrderCreate,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order, emails = order_service.create_order(db, payload, current_user)
    _schedule_emails(background, emails)
    return _load(db, order.id)


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db),
              current_user: User = Depends(get_current_user)):
    order = _load(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if current_user.role == UserRole.SALES and order.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your order")
    return order


@router.get("/{order_id}/invoice")
def download_invoice(order_id: int, db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    order = _load(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if current_user.role == UserRole.SALES and order.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your order")
    pdf = build_invoice_pdf(order)
    filename = f"invoice-{order.order_number}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{order_id}/approve", response_model=OrderOut,
             dependencies=[Depends(require_manager)])
def approve(order_id: int, payload: OrderDecision, background: BackgroundTasks,
            db: Session = Depends(get_db),
            manager: User = Depends(get_current_user)):
    _, emails = order_service.approve_order(db, order_id, manager, payload.notes)
    _schedule_emails(background, emails)
    return _load(db, order_id)


@router.post("/{order_id}/reject", response_model=OrderOut,
             dependencies=[Depends(require_manager)])
def reject(order_id: int, payload: OrderDecision, background: BackgroundTasks,
           db: Session = Depends(get_db),
           manager: User = Depends(get_current_user)):
    _, emails = order_service.reject_order(db, order_id, manager, payload.notes)
    _schedule_emails(background, emails)
    return _load(db, order_id)


@router.post("/{order_id}/cancel", response_model=OrderOut)
def cancel(order_id: int, db: Session = Depends(get_db),
           current_user: User = Depends(get_current_user)):
    order_service.cancel_order(db, order_id, current_user)
    return _load(db, order_id)
