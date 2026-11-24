import bcrypt

from app.core.config import get_settings

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_BYTES = 72  # bcrypt ignores everything past 72 bytes, so refuse longer passwords outright.


def validate_password_strength(password: str) -> str:
    """Complexity rules for any password the system creates. Returns the password when it passes."""
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters long")
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError(f"Password must not exceed {MAX_PASSWORD_BYTES} UTF-8 bytes")
    if not any(c.islower() for c in password):
        raise ValueError("Password must contain a lowercase letter")
    if not any(c.isupper() for c in password):
        raise ValueError("Password must contain an uppercase letter")
    if not any(c.isdigit() for c in password):
        raise ValueError("Password must contain a digit")
    return password


def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > MAX_PASSWORD_BYTES:
        raise ValueError("Password exceeds the 72 byte limit")
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt(rounds=get_settings().bcrypt_rounds)).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > MAX_PASSWORD_BYTES:
        return False
    try:
        return bcrypt.checkpw(password_bytes, hashed_password.encode("utf-8"))
    except ValueError:
        return False
