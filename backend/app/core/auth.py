"""JWT authentication utilities for ContentForge."""
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

# ── Password hashing (bcrypt directly — avoids passlib/bcrypt 4.x conflict) ──

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ── JWT ───────────────────────────────────────────────────────────────────────

_ALGORITHM = "HS256"
_EXPIRE_DAYS = 30

bearer_scheme = HTTPBearer(auto_error=False)


def create_access_token(username: str) -> str:
    expire = datetime.now(UTC) + timedelta(days=_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": username, "exp": expire},
        settings.secret_key,
        algorithm=_ALGORITHM,
    )


def verify_token(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    """FastAPI dependency — returns the username or raises 401."""
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(creds.credentials, settings.secret_key, algorithms=[_ALGORITHM])
        username: str | None = payload.get("sub")
        if not username:
            raise ValueError("missing sub")
        return username
    except jwt.ExpiredSignatureError:
        # `from None`: the JWT error chain is internal detail, not client-facing.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except (jwt.InvalidTokenError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
