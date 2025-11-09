"""Task run model."""
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class TaskRun(SQLModel, table=True):
    """Task execution tracking."""

    __tablename__ = "task_runs"

    id: Optional[int] = Field(default=None, primary_key=True)
    task: str = Field(index=True, max_length=100)
    started_at: datetime = Field(index=True)
    finished_at: Optional[datetime] = None
    status: str = Field(max_length=20)  # RUNNING, SUCCESS, FAILED
    error: Optional[str] = None
