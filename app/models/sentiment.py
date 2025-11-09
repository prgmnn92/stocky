"""Sentiment model."""
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel, UniqueConstraint


class Sentiment(SQLModel, table=True):
    """Sentiment analysis results."""

    __tablename__ = "sentiment"
    __table_args__ = (
        UniqueConstraint(
            "symbol",
            "window_start",
            "window_end",
            "method",
            name="uq_sentiment_symbol_window_method",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    symbol: str = Field(index=True, max_length=20)
    window_start: datetime = Field(index=True)
    window_end: datetime = Field(index=True)
    score: float = Field(ge=-1.0, le=1.0)
    method: str = Field(max_length=50)
    meta_json: str = Field(default="{}")
