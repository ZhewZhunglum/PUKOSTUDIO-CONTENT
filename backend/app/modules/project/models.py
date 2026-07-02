from sqlalchemy import TIMESTAMP, BigInteger, Column, ForeignKey, Integer, SmallInteger, String, Text

from app.core.database import Base


class Project(Base):
    __tablename__ = "project"

    id = Column(Integer, primary_key=True)
    name = Column(String(256), nullable=False)
    description = Column(Text)
    status = Column(SmallInteger, nullable=False, default=0)  # 0=draft 1=active 2=done 3=archived
    cover_asset_id = Column(BigInteger)
    sku_id = Column(Integer, ForeignKey("sku.id", ondelete="SET NULL"))
    brand_id = Column(Integer, ForeignKey("brand.id", ondelete="SET NULL"))
    deadline = Column(TIMESTAMP(timezone=True))
    notes = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False)
