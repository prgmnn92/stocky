"""Position model."""
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class Position(SQLModel, table=True):
    """Trading position (paper trading)."""

    __tablename__ = "positions"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    symbol: str = Field(index=True, max_length=20)
    opened_at: datetime = Field(index=True)
    qty: float
    avg_price: float
    status: str = Field(max_length=10)  # OPEN, CLOSED
    closed_at: Optional[datetime] = None
    pnl: Optional[float] = None
    meta_json: str = Field(default="{}")
