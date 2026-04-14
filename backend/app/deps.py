from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from bson import ObjectId

from app.auth import ALGORITHM, JWT_AUDIENCE, JWT_ISSUER, SECRET_KEY
from app.db import users

# Must match the actual full route path that FastAPI exposes
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

_CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
        )
    except JWTError:
        raise _CREDENTIALS_EXCEPTION

    # Reject tokens that are not access tokens (e.g. refresh tokens)
    if payload.get("type") != "access":
        raise _CREDENTIALS_EXCEPTION

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise _CREDENTIALS_EXCEPTION

    try:
        user = await users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise _CREDENTIALS_EXCEPTION

    if user is None:
        raise _CREDENTIALS_EXCEPTION

    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "role": user["role"],
    }
