from sqlalchemy import ARRAY, TIMESTAMP, BigInteger, Column, ForeignKey, Integer, Numeric, SmallInteger, String, Text

from app.core.database import Base


class Sku(Base):
    __tablename__ = "sku"

    id = Column(Integer, primary_key=True)
    name = Column(String(256), nullable=False)
    brand_id = Column(Integer, ForeignKey("brand.id", ondelete="SET NULL"))
    description = Column(Text)
    category = Column(String(128))
    price_cny = Column(Numeric(12, 2))
    cover_asset_id = Column(BigInteger)
    tags = Column(ARRAY(Text), default=list)
    status = Column(SmallInteger, nullable=False, default=1)
    notes = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False)
