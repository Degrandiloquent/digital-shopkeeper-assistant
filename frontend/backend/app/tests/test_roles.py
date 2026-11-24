import pytest

OWNER_ONLY = [
    ("post", "/api/v1/products", {"name": "X", "category": "Y", "price_cents": 100}),
    ("patch", "/api/v1/business/status", {"status": "closed"}),
    ("patch", "/api/v1/business/profile", {"name": "Hacked"}),
    ("post", "/api/v1/announcements", {"title": "Hi"}),
    ("get", "/api/v1/announcements", None),
    ("get", "/api/v1/dashboard/summary", None),
    ("get", "/api/v1/activity", None),
]


@pytest.mark.parametrize(("method", "path", "body"), OWNER_ONLY)
async def test_staff_cannot_call_owner_endpoints(client, staff_headers, method, path, body):
    response = await getattr(client, method)(path, headers=staff_headers, **({"json": body} if body else {}))
    assert response.status_code == 403, path
    assert response.json()["error"]["code"] == "forbidden"


@pytest.mark.parametrize(("method", "path", "body"), OWNER_ONLY)
async def test_anonymous_callers_get_401(client, shop, method, path, body):
    response = await getattr(client, method)(path, **({"json": body} if body else {}))
    assert response.status_code == 401


async def test_staff_cannot_edit_adjust_or_archive_products(client, shop, staff_headers):
    pid = str(shop["products"]["Bread"].id)
    for method, path, body in (
        ("patch", f"/api/v1/products/{pid}", {"price_cents": 1}),
        ("post", f"/api/v1/products/{pid}/archive", None),
        ("post", f"/api/v1/products/{pid}/restore", None),
        ("post", f"/api/v1/products/{pid}/stock-adjustments", {"delta": 5, "reason": "restock"}),
    ):
        response = await getattr(client, method)(path, headers=staff_headers, **({"json": body} if body else {}))
        assert response.status_code == 403, path


async def test_staff_can_read_products_and_business_but_not_archived(client, shop, owner_headers, staff_headers):
    pid = str(shop["products"]["Oil"].id)
    await client.post(f"/api/v1/products/{pid}/archive", headers=owner_headers)

    staff_list = (await client.get("/api/v1/products?include_archived=true", headers=staff_headers)).json()
    assert {p["name"] for p in staff_list} == {"Bread", "Milk"}
    owner_list = (await client.get("/api/v1/products?include_archived=true", headers=owner_headers)).json()
    assert {p["name"] for p in owner_list} == {"Bread", "Milk", "Oil"}
    assert (await client.get("/api/v1/business", headers=staff_headers)).status_code == 200


async def test_staff_sales_list_is_limited_to_their_own(client, shop, owner_headers, staff_headers):
    pid = str(shop["products"]["Bread"].id)
    await client.post("/api/v1/sales", headers=owner_headers, json={"items": [{"product_id": pid, "quantity": 1}]})
    await client.post("/api/v1/sales", headers=staff_headers, json={"items": [{"product_id": pid, "quantity": 2}]})

    staff_view = (await client.get("/api/v1/sales?period=all", headers=staff_headers)).json()
    owner_view = (await client.get("/api/v1/sales?period=all", headers=owner_headers)).json()
    assert staff_view["sale_count"] == 1 and staff_view["items"][0]["cashier_name"] == "Sam Staff"
    assert owner_view["sale_count"] == 2
