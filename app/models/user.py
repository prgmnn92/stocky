"""User model with role-based access control."""
from datetime import datetime
from typing import Optional
from enum import Enum
from sqlmodel import Field, SQLModel


class UserRole(str, Enum):
    """User role definitions."""

    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    USER = "USER"
    TEST_USER = "TEST_USER"


class User(SQLModel, table=True):
    """User with role-based permissions."""

    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True, max_length=50)
    hashed_password: str = Field(max_length=255)
    role: UserRole = Field(default=UserRole.TEST_USER)
    active: bool = Field(default=True)
    balance: float = Field(default=50000.0)  # Paper trading balance in USD
    created_at: datetime = Field(default_factory=datetime.utcnow)

    def can_manage_users(self) -> bool:
        """Check if user can manage other users."""
        return self.role in [UserRole.ADMIN, UserRole.MANAGER]

    def can_manage_user(self, target_user: "User") -> bool:
        """Check if this user can manage the target user."""
        if not self.can_manage_users():
            return False

        # Admin can manage everyone
        if self.role == UserRole.ADMIN:
            return True

        # Manager can only upgrade test_user to user
        if self.role == UserRole.MANAGER:
            return target_user.role == UserRole.TEST_USER

        return False

    def can_use_chat(self) -> bool:
        """Check if user can use chat feature."""
        return self.role != UserRole.TEST_USER

    def can_run_daily_job(self) -> bool:
        """Check if user can run daily job."""
        return self.role in [UserRole.ADMIN, UserRole.MANAGER]

    def can_add_symbols(self) -> bool:
        """Check if user can add new symbols."""
        return self.role != UserRole.TEST_USER
