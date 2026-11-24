from datetime import UTC, datetime, timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

# South Africa does not use daylight saving, so a fixed +02:00 offset is an exact fallback.
_SAST = timezone(timedelta(hours=2), "SAST")

DAY_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
DAY_LABELS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")


def get_tz(name: str) -> tzinfo:
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return _SAST


def local_now(tz: tzinfo) -> datetime:
    return datetime.now(UTC).astimezone(tz)


def start_of_local_day_utc(tz: tzinfo, days_ago: int = 0) -> datetime:
    """Midnight at the shop, `days_ago` days back, expressed in UTC for database comparisons."""
    now = local_now(tz)
    midnight = datetime(now.year, now.month, now.day, tzinfo=tz) - timedelta(days=days_ago)
    return midnight.astimezone(UTC)
