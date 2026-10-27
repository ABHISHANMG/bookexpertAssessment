"""Idempotent seed script: demo users, products and customers.

Run with:  python -m app.seed
Safe to run repeatedly — it skips rows that already exist.
"""
import logging
from decimal import Decimal

from sqlalchemy import select

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models.customer import Customer
from app.models.enums import StockMovementReason, UserRole
from app.models.order import StockMovement
from app.models.product import Product
from app.models.user import User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sims.seed")

USERS = [
    ("Admin User", "admin@sims.io", "admin123", UserRole.ADMIN),
    ("Maria Manager", "manager@sims.io", "manager123", UserRole.MANAGER),
    ("Sam Sales", "sales@sims.io", "sales123", UserRole.SALES),
]

PRODUCTS = [
    # sku, name, price, stock, reorder_level
    ("BK-001", "The Pragmatic Programmer", Decimal("45.00"), 120, 20),
    ("BK-002", "Clean Code", Decimal("38.50"), 80, 15),
    ("BK-003", "Designing Data-Intensive Applications", Decimal("62.00"), 45, 10),
    ("BK-004", "Introduction to Algorithms", Decimal("95.00"), 8, 10),
    ("BK-005", "Refactoring", Decimal("52.00"), 60, 15),
    ("BK-006", "Domain-Driven Design", Decimal("58.00"), 5, 12),
]

CUSTOMERS = [
    ("Acme Bookstore", "orders@acme-books.com", "+1-202-555-0101", "12 Market St"),
    ("City Library", "purchasing@citylibrary.org", "+1-202-555-0188", "900 Central Ave"),
    ("Readers Corner", "hello@readerscorner.com", "+1-202-555-0143", "44 Elm Road"),
]


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for name, email, password, role in USERS:
            if not db.execute(select(User).where(User.email == email)).scalar_one_or_none():
                db.add(User(name=name, email=email, role=role,
                            hashed_password=hash_password(password)))
                logger.info("Created user %s (%s)", email, role.value)

        for sku, name, price, stock, reorder in PRODUCTS:
            if not db.execute(select(Product).where(Product.sku == sku)).scalar_one_or_none():
                product = Product(sku=sku, name=name, price=price,
                                  stock_quantity=stock, reorder_level=reorder)
                db.add(product)
                db.flush()
                db.add(StockMovement(product_id=product.id, change=stock,
                                     reason=StockMovementReason.INITIAL,
                                     note="Seed stock"))
                logger.info("Created product %s", sku)

        for name, email, phone, address in CUSTOMERS:
            if not db.execute(select(Customer).where(Customer.email == email)).scalar_one_or_none():
                db.add(Customer(name=name, email=email, phone=phone, address=address))
                logger.info("Created customer %s", name)

        db.commit()
        logger.info("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
