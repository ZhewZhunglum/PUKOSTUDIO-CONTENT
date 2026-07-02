from datetime import datetime

from sqlalchemy import JSON, TIMESTAMP, BigInteger, Boolean, Integer, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Template(Base):
    __tablename__ = "template"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str | None] = mapped_column(String(64))
    template_type: Mapped[int] = mapped_column(SmallInteger, default=1)  # 1=script 2=video
    platform: Mapped[str | None] = mapped_column(String(32))
    style: Mapped[str | None] = mapped_column(String(64))
    duration: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text)
    hooks: Mapped[list[str] | None] = mapped_column(JSON)
    outline: Mapped[list[str] | None] = mapped_column(JSON)
    cta: Mapped[str | None] = mapped_column(Text)
    body: Mapped[str | None] = mapped_column(Text)
    variables: Mapped[list[str] | None] = mapped_column(JSON)
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False)
    use_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[int] = mapped_column(SmallInteger, default=1)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP)
