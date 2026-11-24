async def test_public_page_needs_no_login_and_shows_availability_states(client, shop):
    response = await client.get("/api/v1/public/business/test-shop")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Shop" and data["status"] == "open"
    states = {p["name"]: p["availability"] for p in data["products"]}
    assert states == {"Bread": "in_stock", "Milk": "in_stock", "Oil": "low_stock"}
    assert "max-age" in response.headers["cache-control"]


async def test_public_page_never_exposes_private_data(client, shop, staff_headers):
    oil = shop["products"]["Oil"]
    await client.post("/api/v1/sales", headers=staff_headers, json={"items": [{"product_id": str(oil.id), "quantity": 1}]})
    raw = (await client.get("/api/v1/public/business/test-shop")).text
    for forbidden in ("stock_qty", "low_stock_threshold", "product_id", "total_cents", "sale", "email", "password", "Sam Staff", "Olive Owner"):
        assert forbidden not in raw, forbidden
    # And the product itself is now reported as out of stock, not with a number.
    products = (await client.get("/api/v1/public/business/test-shop")).json()["products"]
    assert {p["name"]: p["availability"] for p in products}["Oil"] == "out_of_stock"


async def test_public_page_reflects_status_changes_immediately(client, shop, owner_headers):
    await client.patch(
        "/api/v1/business/status", headers=owner_headers, json={"status": "temporarily_unavailable", "status_message": "Back at 14:00"}
    )
    data = (await client.get("/api/v1/public/business/test-shop")).json()
    assert data["status"] == "temporarily_unavailable" and data["status_message"] == "Back at 14:00"


async def test_archived_and_unfeatured_products_are_hidden(client, shop, owner_headers):
    await client.post(f"/api/v1/products/{shop['products']['Oil'].id}/archive", headers=owner_headers)
    await client.patch(f"/api/v1/products/{shop['products']['Milk'].id}", headers=owner_headers, json={"is_featured": False})
    names = {p["name"] for p in (await client.get("/api/v1/public/business/test-shop")).json()["products"]}
    assert names == {"Bread"}


async def test_unknown_or_malformed_slug(client, shop):
    assert (await client.get("/api/v1/public/business/nope")).status_code == 404
    assert (await client.get("/api/v1/public/business/bad slug!")).status_code in (404, 422)


async def test_health_endpoints(client):
    assert (await client.get("/api/v1/health")).json()["status"] == "ok"
    assert (await client.get("/api/v1/ready")).json()["database"] == "reachable"
