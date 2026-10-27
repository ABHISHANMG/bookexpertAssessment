"""Tests for user management, stock-movement history and invoice PDF."""


def _make_completed_order(client, sales_headers):
    return client.post("/api/orders", headers=sales_headers, json={
        "customer_id": 1,
        "items": [{"product_id": 1, "quantity": 2}],  # below threshold -> completed
    }).json()


# ---- User management ----

def test_admin_can_list_users(client, admin_headers):
    resp = client.get("/api/auth/users", headers=admin_headers)
    assert resp.status_code == 200
    emails = {u["email"] for u in resp.json()}
    assert {"admin@sims.io", "mgr@sims.io", "rep@sims.io"} <= emails


def test_non_admin_cannot_list_users(client, manager_headers):
    assert client.get("/api/auth/users", headers=manager_headers).status_code == 403


def test_admin_can_create_and_update_user(client, admin_headers):
    created = client.post("/api/auth/register", headers=admin_headers, json={
        "name": "New Rep", "email": "new@sims.io", "password": "secret1", "role": "SALES",
    })
    assert created.status_code == 201, created.text
    uid = created.json()["id"]

    updated = client.patch(f"/api/auth/users/{uid}", headers=admin_headers,
                           json={"role": "MANAGER", "is_active": False})
    assert updated.status_code == 200
    assert updated.json()["role"] == "MANAGER"
    assert updated.json()["is_active"] is False


def test_admin_cannot_deactivate_self(client, admin_headers):
    me = client.get("/api/auth/me", headers=admin_headers).json()
    resp = client.patch(f"/api/auth/users/{me['id']}", headers=admin_headers,
                        json={"is_active": False})
    assert resp.status_code == 400


# ---- Stock movement history ----

def test_stock_movements_recorded_on_fulfilment(client, sales_headers):
    _make_completed_order(client, sales_headers)
    resp = client.get("/api/products/1/movements", headers=sales_headers)
    assert resp.status_code == 200
    reasons = [m["reason"] for m in resp.json()]
    assert "ORDER_FULFILLMENT" in reasons
    fulfil = next(m for m in resp.json() if m["reason"] == "ORDER_FULFILLMENT")
    assert fulfil["change"] == -2


# ---- Invoice PDF ----

def test_invoice_returns_pdf(client, sales_headers):
    order = _make_completed_order(client, sales_headers)
    resp = client.get(f"/api/orders/{order['id']}/invoice", headers=sales_headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content[:4] == b"%PDF"
