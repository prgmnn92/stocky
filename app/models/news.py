"""News cache model."""
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel, UniqueConstraint


class NewsCache(SQLModel, table=True):
    """Cached news articles."""

    __tablename__ = "news_cache"
    __table_args__ = (UniqueConstraint("symbol", "url", name="uq_news_cache_symbol_url"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    symbol: str = Field(index=True, max_length=20)
    published_at: datetime = Field(index=True)
    source: str = Field(max_length=100)
    title: str = Field(max_length=500)
    url: str = Field(max_length=1000)
    summary: Optional[str] = None
