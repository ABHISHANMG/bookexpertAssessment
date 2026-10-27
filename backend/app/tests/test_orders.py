"""End-to-end tests for the order + approval + inventory workflow."""


def _get_product(client, headers, pid):
    return client.get(f"/api/products/{pid}", headers=headers).json()


def test_login_returns_user_and_token(client):
    resp = client.post("/api/auth/login",
                       json={"email": "rep@sims.io", "password": "pw123456"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["role"] == "SALES"


def test_small_order_auto_completes_and_deducts_stock(client, sales_headers):
    before = _get_product(client, sales_headers, 1)["stock_quantity"]
    resp = client.post("/api/orders", headers=sales_headers, json={
        "customer_id": 1,
        "items": [{"product_id": 1, "quantity": 3}],  # 3 * 10 = 30, below threshold
    })
    assert resp.status_code == 201, resp.text
    order = resp.json()
    assert order["status"] == "COMPLETED"
    assert order["requires_approval"] is False
    after = _get_product(client, sales_headers, 1)["stock_quantity"]
    assert after == before - 3


def test_large_order_requires_approval_and_does_not_deduct(client, sales_headers):
    before = _get_product(client, sales_headers, 2)["stock_quantity"]
    resp = client.post("/api/orders", headers=sales_headers, json={
        "customer_id": 1,
        "items": [{"product_id": 2, "quantity": 2}],  # 2 * 600 = 1200, above 1000
    })
    assert resp.status_code == 201, resp.text
    order = resp.json()
    assert order["status"] == "PENDING_APPROVAL"
    assert order["requires_approval"] is True
    # stock untouched while pending
    assert _get_product(client, sales_headers, 2)["stock_quantity"] == before


def test_manager_approval_completes_order_and_deducts_stock(client, sales_headers,
                                                            manager_headers):
    before = _get_product(client, manager_headers, 2)["stock_quantity"]
    created = client.post("/api/orders", headers=sales_headers, json={
        "customer_id": 1,
        "items": [{"product_id": 2, "quantity": 2}],
    }).json()
    oid = created["id"]

    resp = client.post(f"/api/orders/{oid}/approve", headers=manager_headers,
                       json={"notes": "Looks good"})
    assert resp.status_code == 200, resp.text
    approved = resp.json()
    assert approved["status"] == "COMPLETED"
    assert approved["approved_by"]["email"] == "mgr@sims.io"
    assert _get_product(client, manager_headers, 2)["stock_quantity"] == before - 2


def test_sales_user_cannot_approve(client, sales_headers):
    created = client.post("/api/orders", headers=sales_headers, json={
        "customer_id": 1,
        "items": [{"product_id": 2, "quantity": 2}],
    }).json()
    resp = client.post(f"/api/orders/{created['id']}/approve",
                       headers=sales_headers, json={})
    assert resp.status_code == 403


def test_reject_keeps_stock_untouched(client, sales_headers, manager_headers):
    before = _get_product(client, manager_headers, 2)["stock_quantity"]
    created = client.post("/api/orders", headers=sales_headers, json={
        "customer_id": 1,
        "items": [{"product_id": 2, "quantity": 2}],
    }).json()
    resp = client.post(f"/api/orders/{created['id']}/reject",
                       headers=manager_headers, json={"notes": "Budget"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "REJECTED"
    assert _get_product(client, manager_headers, 2)["stock_quantity"] == before


def test_order_exceeding_stock_is_rejected(client, sales_headers):
    resp = client.post("/api/orders", headers=sales_headers, json={
        "customer_id": 1,
        "items": [{"product_id": 1, "quantity": 9999}],
    })
    assert resp.status_code == 409
    assert "Insufficient stock" in resp.json()["detail"]
