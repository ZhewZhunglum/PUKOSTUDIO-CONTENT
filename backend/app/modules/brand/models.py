from sqlalchemy import TIMESTAMP, BigInteger, Column, Integer, String, Text

from app.core.database import Base


class Brand(Base):
    __tablename__ = "brand"

    id = Column(Integer, primary_key=True)
    name = Column(String(128), nullable=False)
    description = Column(Text)
    logo_asset_id = Column(BigInteger)
    website = Column(String(512))
    color_primary = Column(String(16))
    notes = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False)
