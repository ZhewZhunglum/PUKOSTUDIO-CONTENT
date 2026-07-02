"""Admin account bootstrap utilities."""
from loguru import logger
from sqlalchemy import text

from app.core.auth import hash_password
from app.core.config import settings
from app.core.database import engine


async def ensure_configured_admin() -> None:
    """Create or update the configured admin account when env vars are present."""
    username = settings.admin_username.strip()
    password = settings.admin_password
    if not username or not password:
        return

    async with engine.begin() as conn:
        row = await conn.execute(
            text("SELECT id FROM users WHERE lower(username) = lower(:username)"),
            {"username": username},
        )
        user_id = row.scalar_one_or_none()

        if user_id is None:
            await conn.execute(
                text("""
                    INSERT INTO users (username, password_hash, is_active, is_admin)
                    VALUES (:username, :password_hash, true, true)
                """),
                {"username": username, "password_hash": hash_password(password)},
            )
            logger.info("Configured admin account created")
            return

        await conn.execute(
            text("""
                UPDATE users
                SET password_hash = :password_hash,
                    is_active = true,
                    is_admin = true
                WHERE id = :user_id
            """),
            {"user_id": user_id, "password_hash": hash_password(password)},
        )
        logger.info("Configured admin account ensured")
