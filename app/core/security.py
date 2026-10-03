import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

# Argon2id is the recommended variant — memory-hard, resistant to GPU attacks.
# PasswordHasher() defaults: time_cost=3, memory_cost=65536, parallelism=4, type=Argon2id
ph = PasswordHasher()

# Session token expiry — 7 days (in hours)
SESSION_EXPIRE_HOURS: int = 7 * 24


def hash_password(plain: str) -> str:
    """Hash a plain-text password using Argon2id."""
    return ph.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verify plain password against its Argon2id hash.
    Returns True if match, False if wrong password.
    """
    try:
        ph.verify(hashed, plain)
        return True
    except VerifyMismatchError:
        return False


def generate_session_token() -> str:
    """
    Generate a cryptographically secure random token.
    secrets.token_urlsafe(32) → 32 random bytes → 43-char URL-safe base64 string.
    Practically impossible to guess (2^256 possibilities).
    """
    return secrets.token_urlsafe(32)