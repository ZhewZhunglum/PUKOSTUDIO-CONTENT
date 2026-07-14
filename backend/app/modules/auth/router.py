"""Auth endpoints: status, register (multi-user), login, me."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import create_access_token, hash_password, verify_password, verify_token
from app.core.database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class AuthStatusResponse(BaseModel):
    registered: bool
    admin_configured: bool


class RegisterRequest(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def username_length(cls, v: str) -> str:
        if len(v.strip()) < 2:
            raise ValueError("用户名至少 2 个字符")
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("密码至少 6 位")
        return v


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"  # noqa: S105 — OAuth2 token scheme name, not a secret
    is_admin: bool = False


class MeResponse(BaseModel):
    username: str
    is_admin: bool


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/status", response_model=AuthStatusResponse)
async def auth_status(db: AsyncSession = Depends(get_db)) -> AuthStatusResponse:
    """Return whether *any* user account exists (used by the login page for first-run UX)."""
    row = await db.execute(text("SELECT 1 FROM users WHERE is_active = true LIMIT 1"))
    admin = await db.execute(text("SELECT 1 FROM users WHERE is_active = true AND is_admin = true LIMIT 1"))
    return AuthStatusResponse(
        registered=row.scalar_one_or_none() is not None,
        admin_configured=admin.scalar_one_or_none() is not None,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Register a new user account. Username must be unique."""
    # Check for duplicate username (case-insensitive)
    existing = await db.execute(
        text("SELECT 1 FROM users WHERE lower(username) = lower(:u)"),
        {"u": req.username},
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该用户名已被注册，请换一个",
        )

    active_user = await db.execute(text("SELECT 1 FROM users WHERE is_active = true LIMIT 1"))
    is_admin = active_user.scalar_one_or_none() is None

    await db.execute(
        text("""
            INSERT INTO users (username, password_hash, is_admin)
            VALUES (:username, :password_hash, :is_admin)
        """),
        {
            "username": req.username,
            "password_hash": hash_password(req.password),
            "is_admin": is_admin,
        },
    )
    await db.commit()

    return TokenResponse(access_token=create_access_token(req.username), is_admin=is_admin)


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Authenticate with username + password and return a JWT."""
    row = await db.execute(
        text("""
            SELECT password_hash, is_admin
            FROM users
            WHERE lower(username) = lower(:u) AND is_active = true
        """),
        {"u": req.username},
    )
    user = row.mappings().first()

    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )

    return TokenResponse(access_token=create_access_token(req.username), is_admin=bool(user["is_admin"]))


@router.get("/me", response_model=MeResponse)
async def me(username: str = Depends(verify_token), db: AsyncSession = Depends(get_db)) -> MeResponse:
    """Return the currently authenticated user's info."""
    row = await db.execute(
        text("SELECT username, is_admin FROM users WHERE lower(username) = lower(:u) AND is_active = true"),
        {"u": username},
    )
    user = row.mappings().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
        )
    return MeResponse(username=user["username"], is_admin=bool(user["is_admin"]))
