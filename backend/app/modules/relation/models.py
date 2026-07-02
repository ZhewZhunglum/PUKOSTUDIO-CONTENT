from datetime import datetime
from typing import Any

from sqlalchemy import JSON, TIMESTAMP, BigInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AssetRelation(Base):
    __tablename__ = "asset_relation"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    source_asset_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    target_asset_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    relation_type: Mapped[str] = mapped_column(String(32), nullable=False)
    extra_data: Mapped[dict[str, Any] | None] = mapped_column(JSON, name="metadata")
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP)
