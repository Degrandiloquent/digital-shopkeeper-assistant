from app.tests.conftest import OWNER, STAFF, bearer, login


async def test_login_returns_tokens_user_and_permissions(client, shop):
    data = await login(client, OWNER)
    assert data["user"]["role"] == "owner"
    assert data["business"]["slug"] == "test-shop"
    assert "products.manage" in data["permissions"]
    assert data["access_token"] and data["refresh_token"]


async def test_staff_permissions_exclude_management(client, shop):
    data = await login(client, STAFF)
    assert "sales.create" in data["permissions"]
    assert "products.manage" not in data["permissions"]
    assert "business.manage" not in data["permissions"]


async def test_wrong_password_and_unknown_email_give_the_same_error(client, shop):
    wrong = await client.post("/api/v1/auth/login", json={"email": OWNER[0], "password": "Wrong#Pass1"})
    unknown = await client.post("/api/v1/auth/login", json={"email": "nobody@test.demo", "password": "Wrong#Pass1"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["error"]["message"] == unknown.json()["error"]["message"]
    assert wrong.json()["error"]["code"] == "invalid_credentials"


async def test_too_many_failed_logins_are_throttled(client, shop):
    for _ in range(5):
        await client.post("/api/v1/auth/login", json={"email": OWNER[0], "password": "Wrong#Pass1"})
    blocked = await client.post("/api/v1/auth/login", json={"email": OWNER[0], "password": OWNER[1]})
    assert blocked.status_code == 429
    assert "Retry-After" in blocked.headers


async def test_me_requires_a_token(client, shop):
    assert (await client.get("/api/v1/auth/me")).status_code == 401
    assert (await client.get("/api/v1/auth/me", headers=bearer("not-a-token"))).status_code == 401


async def test_refresh_rotates_and_reuse_signs_everyone_out(client, shop):
    first = await login(client, OWNER)
    rotated = await client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert rotated.status_code == 200
    second = rotated.json()
    assert second["refresh_token"] != first["refresh_token"]

    # The old token was already used: presenting it again is treated as theft.
    reused = await client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert reused.status_code == 401
    # ...and the new token no longer works either.
    after = await client.post("/api/v1/auth/refresh", json={"refresh_token": second["refresh_token"]})
    assert after.status_code == 401


async def test_logout_revokes_the_refresh_token(client, shop):
    data = await login(client, STAFF)
    await client.post("/api/v1/auth/logout", json={"refresh_token": data["refresh_token"]})
    again = await client.post("/api/v1/auth/refresh", json={"refresh_token": data["refresh_token"]})
    assert again.status_code == 401


async def test_error_shape_is_consistent(client, shop):
    response = await client.post("/api/v1/auth/login", json={"email": "not-an-email", "password": "x"})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error" and error["message"] and error["correlation_id"]
