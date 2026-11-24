async def test_dashboard_summary_reflects_sales_and_low_stock(client, shop, owner_headers, staff_headers):
    bread, milk = shop["products"]["Bread"], shop["products"]["Milk"]
    await client.post("/api/v1/sales", headers=staff_headers, json={"items": [{"product_id": str(bread.id), "quantity": 2}]})
    await client.post("/api/v1/sales", headers=staff_headers, json={"items": [{"product_id": str(milk.id), "quantity": 4}]})

    data = (await client.get("/api/v1/dashboard/summary", headers=owner_headers)).json()
    kpis = data["kpis"]
    assert kpis["active_products"] == 3
    assert kpis["out_of_stock_count"] == 1  # milk sold out
    assert kpis["low_stock_count"] == 1  # oil: 1 left, threshold 2
    assert kpis["sales_today_count"] == 2 and kpis["sales_today_cents"] == 2 * 2000 + 4 * 2500
    assert {p["name"] for p in data["low_stock_items"]} == {"Milk", "Oil"}
    assert data["top_sellers_today"][0]["name"] == "Milk"
    assert len(data["sales_last_7_days"]) == 7 and data["sales_last_7_days"][-1]["is_today"]
    assert data["sales_last_7_days"][-1]["total_cents"] == kpis["sales_today_cents"]
    assert len(data["recent_sales"]) == 2
