"""A small in-memory throttle for sign-in attempts.

It is per process, which is right for one demo instance. A multi-instance production system would keep
these counters in a shared store such as Redis instead."""

import time
from collections import defaultdict, deque

from app.core.config import get_settings
from app.core.errors import TooManyRequests


class LoginThrottle:
    def __init__(self) -> None:
        self._failures: dict[str, deque[float]] = defaultdict(deque)

    def _recent(self, key: str) -> deque[float]:
        window = get_settings().login_window_seconds
        failures = self._failures[key]
        cutoff = time.monotonic() - window
        while failures and failures[0] < cutoff:
            failures.popleft()
        return failures

    def check(self, key: str) -> None:
        settings = get_settings()
        failures = self._recent(key)
        if len(failures) >= settings.login_max_attempts:
            retry_after = max(1, int(failures[0] + settings.login_window_seconds - time.monotonic()))
            raise TooManyRequests(
                f"Too many failed sign-in attempts. Try again in {max(1, retry_after // 60)} minute(s).",
                code="too_many_attempts",
                headers={"Retry-After": str(retry_after)},
            )

    def record_failure(self, key: str) -> None:
        self._recent(key).append(time.monotonic())

    def clear(self, key: str) -> None:
        self._failures.pop(key, None)

    def reset_all(self) -> None:
        self._failures.clear()


login_throttle = LoginThrottle()
