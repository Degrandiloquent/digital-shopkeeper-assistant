import os

# Settings are read when the app is imported, so the test environment is fixed first.
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["JWT_SECRET_KEY"] = "test-secret-key-that-is-long-enough-for-hs256"
os.environ["BCRYPT_ROUNDS"] = "4"
os.environ["APP_ENV"] = "development"

import httpx  # noqa: E402
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from sqlalchemy import delete  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.database.base import Base  # noqa: E402
from app.database.session import get_db_session  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Business, Product, User, UserRole  # noqa: E402
from app.security.password import hash_password  # noqa: E402
from app.security.rate_limit import login_throttle  # noqa: E402
from app.seed import demo_data  # noqa: E402

IS_SQLITE = TEST_DATABASE_URL.startswith("sqlite")

OWNER = ("owner@test.demo", "Owner#Test2027")
STAFF = ("staff@test.demo", "Staff#Test2027")


def pytest_collection_modifyitems(config, items):
    if IS_SQLITE:
        skip = pytest.mark.skip(reason="needs PostgreSQL: set TEST_DATABASE_URL")
        for item in items:
            if "postgres" in item.keywords:
                item.add_marker(skip)


@pytest_asyncio.fixture(scope="session")
async def engine():
    kwargs = {"poolclass": StaticPool, "connect_args": {"check_same_thread": False}} if IS_SQLITE else {}
    eng = create_async_engine(TEST_DATABASE_URL, **kwargs)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest_asyncio.fixture(scope="session")
async def maker(engine):
    return async_sessionmaker(engine, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True)
async def clean_database(engine):
    """Every test starts from empty tables."""
    login_throttle.reset_all()
    yield
    async with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(delete(table))


@pytest_asyncio.fixture
async def client(maker):
    async def override():
        async with maker() as session:
            yield session

    app.dependency_overrides[get_db_session] = override
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
        yield http
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def shop(maker):
    """One shop, an owner, a staff member and three products."""
    async with maker() as db:
        business = Business(**{**demo_data.BUSINESS, "slug": "test-shop", "name": "Test Shop"})
        db.add(business)
        await db.flush()
        for name, role, (email, password) in (("Olive Owner", UserRole.OWNER, OWNER), ("Sam Staff", UserRole.STAFF, STAFF)):
            db.add(User(business_id=business.id, name=name, email=email, password_hash=hash_password(password), role=role))
        products = {}
        for name, category, price, stock, threshold in (
            ("Bread", "Bakery", 2000, 10, 3),
            ("Milk", "Dairy", 2500, 4, 2),
            ("Oil", "Groceries", 5000, 1, 2),
        ):
            product = Product(
                business_id=business.id, name=name, category=category, price_cents=price,
                stock_qty=stock, low_stock_threshold=threshold, is_featured=True,
            )
            db.add(product)
            products[name] = product
        await db.commit()
        return {"business": business, "products": products}


async def login(client: httpx.AsyncClient, credentials: tuple[str, str]) -> dict:
    response = await client.post("/api/v1/auth/login", json={"email": credentials[0], "password": credentials[1]})
    assert response.status_code == 200, response.text
    return response.json()


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def owner_headers(client, shop):
    return bearer((await login(client, OWNER))["access_token"])


@pytest_asyncio.fixture
async def staff_headers(client, shop):
    return bearer((await login(client, STAFF))["access_token"])
