"""Wait until the database accepts connections. Used at start-up, because a free-tier database can take a
little while to be ready after a deploy."""

import asyncio
import sys
import time

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings


async def main(timeout_seconds: int = 90) -> None:
    engine = create_async_engine(get_settings().database_url)
    deadline = time.monotonic() + timeout_seconds
    attempt = 0
    while True:
        attempt += 1
        try:
            async with engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
            print(f"[wait_for_db] database ready after {attempt} attempt(s)", flush=True)
            await engine.dispose()
            return
        except Exception as exc:  # noqa: BLE001 - any failure just means "not ready yet"
            if time.monotonic() > deadline:
                print(f"[wait_for_db] gave up: {exc}", file=sys.stderr, flush=True)
                sys.exit(1)
            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(main())
