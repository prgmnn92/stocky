"""Symbol model."""
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class Symbol(SQLModel, table=True):
    """Trading symbol - shared across all users."""

    __tablename__ = "symbols"

    symbol: str = Field(primary_key=True, max_length=20)
    name: Optional[str] = Field(default=None, max_length=200)
    active: bool = Field(default=True)
    added_at: datetime = Field(default_factory=datetime.utcnow)


class UserSymbol(SQLModel, table=True):
    """Junction table for user-symbol relationships."""

    __tablename__ = "user_symbols"

    user_id: int = Field(primary_key=True, foreign_key="users.id", index=True)
    symbol: str = Field(primary_key=True, foreign_key="symbols.symbol", max_length=20, index=True)
    added_at: datetime = Field(default_factory=datetime.utcnow)
