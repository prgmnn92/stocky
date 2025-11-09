"""Strategy model."""
from typing import Optional
from sqlmodel import Field, SQLModel, ForeignKey


class Strategy(SQLModel, table=True):
    """Trading strategy configuration."""

    __tablename__ = "strategies"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    key: str = Field(max_length=50, index=True)
    name: str = Field(max_length=200)
    params_json: str = Field(default="{}")
    enabled: bool = Field(default=True)
