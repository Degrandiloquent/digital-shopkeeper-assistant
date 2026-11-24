import asyncio

import pytest
from sqlalchemy import func, select

from app.models import Product, Sale, StockMovement
from app.tests.conftest import STAFF, bearer, login


def line(product, quantity):
    return {"product_id": str(product.id), "quantity": quantity}


async def stock_of(maker, product):
    async with maker() as db:
        return (await db.execute(select(Product.stock_qty).where(Product.id == product.id))).scalar_one()


async def test_sale_decrements_stock_and_returns_receipt(client, shop, staff_headers, maker):
    bread, milk = shop["products"]["Bread"], shop["products"]["Milk"]
    response = await client.post("/api/v1/sales", headers=staff_headers, json={"items": [line(bread, 2), line(milk, 3)]})
    assert response.status_code == 201
    sale = response.json()
    assert sale["total_cents"] == 2 * 2000 + 3 * 2500
    assert sale["unit_count"] == 5 and sale["cashier_name"] == "Sam Staff"
    by_name = {i["product_name"]: i for i in sale["items"]}
    assert by_name["Bread"]["stock_after"] == 8 and by_name["Bread"]["stock_state"] == "in_stock"
    assert by_name["Milk"]["stock_after"] == 1 and by_name["Milk"]["stock_state"] == "low_stock"
    assert await stock_of(maker, bread) == 8 and await stock_of(maker, milk) == 1

    async with maker() as db:
        movements = (await db.execute(select(StockMovement).where(StockMovement.sale_id.is_not(None)))).scalars().all()
    assert sorted(m.delta for m in movements) == [-3, -2]


async def test_selling_more_than_stock_is_rejected_with_409_and_changes_nothing(client, shop, staff_headers, maker):
    oil = shop["products"]["Oil"]
    response = await client.post("/api/v1/sales", headers=staff_headers, json={"items": [line(oil, 2)]})
    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "insufficient_stock"
    assert error["details"][0]["available"] == 1 and error["details"][0]["requested"] == 2
    assert await stock_of(maker, oil) == 1
    async with maker() as db:
        assert (await db.execute(select(func.count(Sale.id)))).scalar_one() == 0


async def test_one_short_line_refuses_the_whole_sale(client, shop, staff_headers, maker):
    bread, oil = shop["products"]["Bread"], shop["products"]["Oil"]
    response = await client.post("/api/v1/sales", headers=staff_headers, json={"items": [line(bread, 1), line(oil, 5)]})
    assert response.status_code == 409
    assert await stock_of(maker, bread) == 10  # the bread line must not have gone through
    assert await stock_of(maker, oil) == 1


async def test_duplicate_lines_are_merged_before_checking_stock(client, shop, staff_headers, maker):
    milk = shop["products"]["Milk"]  # 4 in stock
    response = await client.post("/api/v1/sales", headers=staff_headers, json={"items": [line(milk, 3), line(milk, 3)]})
    assert response.status_code == 409
    assert await stock_of(maker, milk) == 4


async def test_selling_the_last_unit_reaches_out_of_stock(client, shop, staff_headers):
    oil = shop["products"]["Oil"]
    sale = (await client.post("/api/v1/sales", headers=staff_headers, json={"items": [line(oil, 1)]})).json()
    assert sale["items"][0]["stock_after"] == 0 and sale["items"][0]["stock_state"] == "out_of_stock"
    again = await client.post("/api/v1/sales", headers=staff_headers, json={"items": [line(oil, 1)]})
    assert again.status_code == 409


async def test_invalid_quantities_are_rejected(client, shop, staff_headers):
    bread = shop["products"]["Bread"]
    for quantity in (0, -1, 1000):
        response = await client.post("/api/v1/sales", headers=staff_headers, json={"items": [line(bread, quantity)]})
        assert response.status_code == 422
    assert (await client.post("/api/v1/sales", headers=staff_headers, json={"items": []})).status_code == 422


async def test_archived_and_unknown_products_cannot_be_sold(client, shop, owner_headers, staff_headers):
    bread = shop["products"]["Bread"]
    await client.post(f"/api/v1/products/{bread.id}/archive", headers=owner_headers)
    archived = await client.post("/api/v1/sales", headers=staff_headers, json={"items": [line(bread, 1)]})
    assert archived.status_code == 409 and archived.json()["error"]["code"] == "product_unavailable"
    unknown = await client.post(
        "/api/v1/sales",
        headers=staff_headers,
        json={"items": [{"product_id": "00000000-0000-0000-0000-000000000001", "quantity": 1}]},
    )
    assert unknown.status_code == 404


async def test_same_client_ref_never_records_a_second_sale(client, shop, staff_headers, maker):
    bread = shop["products"]["Bread"]
    body = {"items": [line(bread, 2)], "client_ref": "retry-abc-12345"}
    first = await client.post("/api/v1/sales", headers=staff_headers, json=body)
    second = await client.post("/api/v1/sales", headers=staff_headers, json=body)
    assert first.status_code == 201 and second.status_code == 200
    assert second.json()["replayed"] is True and second.json()["id"] == first.json()["id"]
    assert await stock_of(maker, bread) == 8  # decremented once, not twice


async def test_historic_price_is_preserved_when_product_price_changes(client, shop, owner_headers, staff_headers):
    bread = shop["products"]["Bread"]
    sale = (await client.post("/api/v1/sales", headers=staff_headers, json={"items": [line(bread, 1)]})).json()
    await client.patch(f"/api/v1/products/{bread.id}", headers=owner_headers, json={"price_cents": 9900})
    history = (await client.get("/api/v1/sales?period=all", headers=owner_headers)).json()
    assert history["items"][0]["items"][0]["unit_price_cents"] == 2000
    assert history["total_cents"] == sale["total_cents"] == 2000


@pytest.mark.postgres
async def test_two_people_selling_the_last_unit_at_once_only_one_succeeds(client, shop, maker):
    """Needs real row locks, so it runs on PostgreSQL only."""
    oil = shop["products"]["Oil"]  # exactly 1 in stock
    tokens = [(await login(client, STAFF))["access_token"] for _ in range(6)]

    async def attempt(token):
        return await client.post("/api/v1/sales", headers=bearer(token), json={"items": [line(oil, 1)]})

    results = await asyncio.gather(*(attempt(t) for t in tokens))
    codes = sorted(r.status_code for r in results)
    assert codes == [201] + [409] * 5
    assert await stock_of(maker, oil) == 0
