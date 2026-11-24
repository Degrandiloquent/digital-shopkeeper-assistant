from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models import StockMovement


async def test_owner_creates_edits_archives_and_restores_a_product(client, shop, owner_headers):
    created = await client.post(
        "/api/v1/products",
        headers=owner_headers,
        json={"name": "  Sugar (2kg) ", "category": "Groceries", "price_cents": 3999, "stock_qty": 12, "low_stock_threshold": 4},
    )
    assert created.status_code == 201
    product = created.json()
    assert product["name"] == "Sugar (2kg)" and product["stock_state"] == "in_stock"

    edited = await client.patch(
        f"/api/v1/products/{product['id']}", headers=owner_headers, json={"price_cents": 4199, "low_stock_threshold": 12}
    )
    assert edited.json()["price_cents"] == 4199 and edited.json()["stock_state"] == "low_stock"

    archived = (await client.post(f"/api/v1/products/{product['id']}/archive", headers=owner_headers)).json()
    assert archived["is_active"] is False
    restored = (await client.post(f"/api/v1/products/{product['id']}/restore", headers=owner_headers)).json()
    assert restored["is_active"] is True


async def test_product_validation(client, shop, owner_headers):
    base = {"name": "Thing", "category": "Misc", "price_cents": 100}
    for bad in ({**base, "price_cents": -1}, {**base, "stock_qty": -5}, {**base, "name": "   "}, {**base, "price_cents": 1.5}):
        assert (await client.post("/api/v1/products", headers=owner_headers, json=bad)).status_code == 422
    duplicate = await client.post("/api/v1/products", headers=owner_headers, json={**base, "name": "bread"})
    assert duplicate.status_code == 409 and duplicate.json()["error"]["code"] == "duplicate_name"


async def test_stock_cannot_be_edited_through_patch(client, shop, owner_headers):
    pid = shop["products"]["Bread"].id
    response = await client.patch(f"/api/v1/products/{pid}", headers=owner_headers, json={"stock_qty": 999})
    assert response.status_code == 422


async def test_stock_adjustment_is_recorded_and_cannot_go_below_zero(client, shop, owner_headers, maker):
    pid = shop["products"]["Oil"].id
    ok = await client.post(
        f"/api/v1/products/{pid}/stock-adjustments", headers=owner_headers, json={"delta": 24, "reason": "restock", "note": "Supplier drop"}
    )
    assert ok.status_code == 200 and ok.json()["stock_qty"] == 25 and ok.json()["stock_state"] == "in_stock"

    too_much = await client.post(
        f"/api/v1/products/{pid}/stock-adjustments", headers=owner_headers, json={"delta": -26, "reason": "damaged"}
    )
    assert too_much.status_code == 409 and too_much.json()["error"]["code"] == "stock_below_zero"

    async with maker() as db:
        rows = (await db.execute(select(StockMovement).where(StockMovement.product_id == pid))).scalars().all()
    assert [(m.delta, m.quantity_after) for m in rows] == [(24, 25)]


async def test_status_and_hours_validation(client, shop, owner_headers):
    ok = await client.patch(
        "/api/v1/business/status", headers=owner_headers, json={"status": "temporarily_unavailable", "status_message": "Power cut"}
    )
    assert ok.status_code == 200 and ok.json()["status"] == "temporarily_unavailable"
    assert (await client.patch("/api/v1/business/status", headers=owner_headers, json={"status": "banana"})).status_code == 422

    hours = ok.json()["hours"]
    hours["mon"] = {"closed": False, "open": "20:00", "close": "07:00"}
    bad = await client.patch("/api/v1/business/profile", headers=owner_headers, json={"hours": hours})
    assert bad.status_code == 422


async def test_announcement_lifecycle_and_public_visibility(client, shop, owner_headers):
    past = (datetime.now(UTC) - timedelta(hours=1)).isoformat()
    assert (await client.post("/api/v1/announcements", headers=owner_headers, json={"title": "Old", "expires_at": past})).status_code == 422

    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    created = (
        await client.post(
            "/api/v1/announcements",
            headers=owner_headers,
            json={"title": "Delayed opening", "body": "Open at 9 today.", "tone": "warning", "expires_at": future},
        )
    ).json()
    assert created["state"] == "live"
    assert (await client.get("/api/v1/public/business/test-shop")).json()["announcement"]["title"] == "Delayed opening"

    ended = (await client.post(f"/api/v1/announcements/{created['id']}/end", headers=owner_headers)).json()
    assert ended["state"] == "ended"
    assert (await client.get("/api/v1/public/business/test-shop")).json()["announcement"] is None


async def test_owner_actions_appear_in_the_activity_log(client, shop, owner_headers):
    await client.patch("/api/v1/business/status", headers=owner_headers, json={"status": "closed"})
    items = (await client.get("/api/v1/activity", headers=owner_headers)).json()["items"]
    assert any(i["action"] == "business.status_changed" and i["actor_name"] == "Olive Owner" for i in items)
