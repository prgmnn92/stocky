"""Execution model."""
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class Execution(SQLModel, table=True):
    """Trade execution (paper trading)."""

    __tablename__ = "executions"

    id: Optional[int] = Field(default=None, primary_key=True)
    position_id: int = Field(foreign_key="positions.id", index=True)
    ts: datetime = Field(index=True)
    side: str = Field(max_length=10)  # BUY, SELL
    qty: float
    price: float
    fee: float = Field(default=0.0)
    meta_json: str = Field(default="{}")
