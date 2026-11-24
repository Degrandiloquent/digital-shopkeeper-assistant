import asyncio

from sqlalchemy import func, select

from app.models import Product, Sale, StockMovement
from app.seed.run import seed
from app.tests.conftest import IS_SQLITE


async def test_seed_is_idempotent_and_ledger_matches_stock(maker):
    async with maker() as db:
        await seed(db)
    async with maker() as db:
        await seed(db)  # second run must change nothing
    async with maker() as db:
        assert (await db.execute(select(func.count(Product.id)))).scalar_one() == 6
        assert (await db.execute(select(func.count(Sale.id)))).scalar_one() > 20
        products = (await db.execute(select(Product))).scalars().all()
        for product in products:
            ledger = (
                await db.execute(select(func.sum(StockMovement.delta)).where(StockMovement.product_id == product.id))
            ).scalar_one()
            assert ledger == product.stock_qty, product.name  # the ledger replays to the exact count


def test_migration_matches_models(tmp_path, monkeypatch):
    """The migration file and the models must describe the same schema."""
    import os

    from sqlalchemy import create_engine

    from alembic import command
    from alembic.autogenerate import compare_metadata
    from alembic.config import Config
    from alembic.migration import MigrationContext
    from app.core.config import get_settings
    from app.database.base import Base

    url = f"sqlite:///{tmp_path}/m.db" if IS_SQLITE else os.environ["TEST_DATABASE_URL"]
    if not IS_SQLITE:
        # Use a throw-away schema-free check on the real database: drop everything first.
        engine = create_engine(get_settings().sync_database_url)
        Base.metadata.drop_all(engine)
        engine.dispose()
    monkeypatch.setenv("DATABASE_URL", url)
    get_settings.cache_clear()
    try:
        cfg = Config("alembic.ini")
        command.upgrade(cfg, "head")
        engine = create_engine(get_settings().sync_database_url)
        with engine.connect() as connection:
            diff = compare_metadata(MigrationContext.configure(connection), Base.metadata)
        engine.dispose()
        assert diff == [], diff
        if not IS_SQLITE:
            engine = create_engine(get_settings().sync_database_url)
            with engine.begin() as connection:
                connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")
            Base.metadata.drop_all(engine)
            Base.metadata.create_all(engine)  # hand the shared test schema back to the other tests
            engine.dispose()
    finally:
        monkeypatch.undo()
        get_settings.cache_clear()


_ = asyncio
