"""Signal model."""
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel, UniqueConstraint


class Signal(SQLModel, table=True):
    """Trading signal."""

    __tablename__ = "signals"
    __table_args__ = (
        UniqueConstraint("symbol", "ts", "strategy_key", name="uq_signals_symbol_ts_strategy"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    symbol: str = Field(index=True, max_length=20)
    ts: datetime = Field(index=True)
    strategy_key: str = Field(index=True, max_length=50)
    action: str = Field(max_length=10)  # BUY, SELL
    confidence: float = Field(ge=0.0, le=1.0)
    meta_json: str = Field(default="{}")
