from typing import Optional

from fastapi import Request
from jose import JWTError, jwt

from app.auth import ALGORITHM, JWT_AUDIENCE, JWT_ISSUER, SECRET_KEY


async def attach_auth_context(request: Request, call_next):
    request.state.auth_context = None

    auth_header: Optional[str] = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        if token:
            try:
                payload = jwt.decode(
                    token,
                    SECRET_KEY,
                    algorithms=[ALGORITHM],
                    audience=JWT_AUDIENCE,
                    issuer=JWT_ISSUER,
                )
                # Only accept access tokens — never refresh or other token types
                if payload.get("type") == "access":
                    request.state.auth_context = {
                        "sub": payload.get("sub"),
                        "role": payload.get("role"),
                    }
            except JWTError:
                request.state.auth_context = None

    response = await call_next(request)
    return response
