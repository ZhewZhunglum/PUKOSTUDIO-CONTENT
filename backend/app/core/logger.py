import sys

from loguru import logger

from app.core.config import settings


def setup_logger() -> None:
    logger.remove()
    logger.add(
        sys.stdout,
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{line}</cyan> — "
            "<level>{message}</level>"
        ),
        level=settings.log_level,
        colorize=True,
    )
    logger.add(
        "logs/contentforge.log",
        rotation="100 MB",
        retention="30 days",
        level="INFO",
        compression="gz",
    )
