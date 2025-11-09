"""Base model configuration."""
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class TimestampMixin(SQLModel):
    """Mixin for created_at timestamp."""

    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
