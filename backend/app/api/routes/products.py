from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_manager
from app.core.database import get_db
from app.models.enums import StockMovementReason
from app.models.order import StockMovement
from app.models.product import Product
from app.models.user import User
from app.schemas.product import (
    ProductCreate,
    ProductOut,
    ProductUpdate,
    StockAdjust,
    StockMovementOut,
)

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
def list_products(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    search: str | None = Query(default=None),
    low_stock: bool = Query(default=False),
    active_only: bool = Query(default=True),
):
    stmt = select(Product)
    if active_only:
        stmt = stmt.where(Product.is_active.is_(True))
    if search:
        like = f"%{search}%"
        stmt = stmt.where(or_(Product.name.like(like), Product.sku.like(like)))
    if low_stock:
        stmt = stmt.where(Product.stock_quantity <= Product.reorder_level)
    stmt = stmt.order_by(Product.name)
    return db.execute(stmt).scalars().all()


@router.post("", response_model=ProductOut, status_code=201,
             dependencies=[Depends(require_manager)])
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    if db.execute(
        select(Product).where(Product.sku == payload.sku)
    ).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="SKU already exists")
    product = Product(**payload.model_dump())
    db.add(product)
    db.flush()
    if product.stock_quantity:
        db.add(StockMovement(
            product_id=product.id,
            change=product.stock_quantity,
            reason=StockMovementReason.INITIAL,
            note="Initial stock",
        ))
    db.commit()
    db.refresh(product)
    return product


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db),
                _: User = Depends(get_current_user)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.get("/{product_id}/movements", response_model=list[StockMovementOut])
def stock_movements(product_id: int, db: Session = Depends(get_db),
                    _: User = Depends(get_current_user)):
    if not db.get(Product, product_id):
        raise HTTPException(status_code=404, detail="Product not found")
    return db.execute(
        select(StockMovement)
        .where(StockMovement.product_id == product_id)
        .order_by(StockMovement.created_at.desc(), StockMovement.id.desc())
    ).scalars().all()


@router.patch("/{product_id}", response_model=ProductOut,
              dependencies=[Depends(require_manager)])
def update_product(product_id: int, payload: ProductUpdate,
                   db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


@router.post("/{product_id}/adjust-stock", response_model=ProductOut,
             dependencies=[Depends(require_manager)])
def adjust_stock(product_id: int, payload: StockAdjust,
                 db: Session = Depends(get_db)):
    """Manually restock or correct inventory, with an audit trail."""
    product = db.execute(
        select(Product).where(Product.id == product_id).with_for_update()
    ).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    new_qty = product.stock_quantity + payload.quantity
    if new_qty < 0:
        raise HTTPException(status_code=409, detail="Resulting stock cannot be negative")
    product.stock_quantity = new_qty
    reason = (StockMovementReason.RESTOCK if payload.quantity > 0
              else StockMovementReason.MANUAL_ADJUSTMENT)
    db.add(StockMovement(
        product_id=product.id,
        change=payload.quantity,
        reason=reason,
        note=payload.note,
    ))
    db.commit()
    db.refresh(product)
    return product
