import os
import uuid
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from jose import jwt
from passlib.context import CryptContext

load_dotenv()

# ---------------------------------------------------------------------------
# Hashing — Argon2 (OWASP recommended, memory-hard, GPU-resistant)
# ---------------------------------------------------------------------------
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# ---------------------------------------------------------------------------
# JWT config
# ---------------------------------------------------------------------------
SECRET_KEY = os.getenv("SECRET_KEY", "")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

JWT_ISSUER = "pm_app"
JWT_AUDIENCE = "pm_users"

# Fail fast if the secret key is missing or still set to the dev placeholder.
_INSECURE_PLACEHOLDERS = {"", "super-secret-change-this", "change-this-secret"}
if SECRET_KEY in _INSECURE_PLACEHOLDERS:
    raise RuntimeError(
        "SECRET_KEY is missing or insecure. "
        "Set a strong SECRET_KEY in your .env file before starting the server."
    )


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# A pre-hashed dummy used to keep login response time constant even when the
# requested email does not exist (timing attack mitigation).
_DUMMY_HASH = hash_password("__dummy_password_never_valid__")


def constant_time_verify(plain_password: str, hashed_password: str | None) -> bool:
    """Always runs the full argon2 verify even when no real hash is available."""
    return verify_password(plain_password, hashed_password or _DUMMY_HASH) and (
        hashed_password is not None
    )


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------
def create_access_token(sub: str, role: str) -> str:
    now = datetime.now(tz=timezone.utc)
    expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": sub,
        "role": role,
        "iat": now,
        "exp": expire,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "type": "access",
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)