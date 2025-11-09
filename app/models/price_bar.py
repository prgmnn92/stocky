"""Price bar model."""
from datetime import date
from typing import Optional
from sqlmodel import Field, SQLModel, UniqueConstraint


class PriceBar(SQLModel, table=True):
    """OHLCV price bar."""

    __tablename__ = "price_bars"
    __table_args__ = (UniqueConstraint("symbol", "ts", name="uq_price_bars_symbol_ts"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    symbol: str = Field(index=True, max_length=20)
    ts: date = Field(index=True)
    open: float
    high: float
    low: float
    close: float
    volume: float
