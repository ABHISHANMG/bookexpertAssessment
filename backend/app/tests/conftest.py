"""Test fixtures.

Tests run against an in-memory SQLite database so they need no MySQL server.
The schema is portable (Numeric/Enum/String), and ``with_for_update`` is simply
ignored by SQLite, so the same business logic is exercised.
"""
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app
from app.models.customer import Customer
from app.models.enums import UserRole
from app.models.product import Product
from app.models.user import User


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()

    # minimal fixtures
    session.add_all([
        User(name="Boss", email="admin@sims.io", role=UserRole.ADMIN,
             hashed_password=hash_password("pw123456")),
        User(name="Mgr", email="mgr@sims.io", role=UserRole.MANAGER,
             hashed_password=hash_password("pw123456")),
        User(name="Rep", email="rep@sims.io", role=UserRole.SALES,
             hashed_password=hash_password("pw123456")),
        Product(sku="P1", name="Cheap Book", price=Decimal("10.00"),
                stock_quantity=50, reorder_level=5),
        Product(sku="P2", name="Pricey Book", price=Decimal("600.00"),
                stock_quantity=10, reorder_level=2),
        Customer(name="Cust", email="cust@sims.io"),
    ])
    session.commit()

    def override_get_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield session
    app.dependency_overrides.clear()
    session.close()


@pytest.fixture()
def client(db_session):
    return TestClient(app)


def _token(client: TestClient, email: str, password: str = "pw123456") -> str:
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.fixture()
def sales_headers(client):
    return {"Authorization": f"Bearer {_token(client, 'rep@sims.io')}"}


@pytest.fixture()
def manager_headers(client):
    return {"Authorization": f"Bearer {_token(client, 'mgr@sims.io')}"}


@pytest.fixture()
def admin_headers(client):
    return {"Authorization": f"Bearer {_token(client, 'admin@sims.io')}"}
