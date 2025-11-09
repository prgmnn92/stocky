"""Authentication service with JWT."""
from datetime import datetime, timedelta
from typing import Optional
import bcrypt
from jose import JWTError, jwt
from sqlmodel import Session, select
from app.models import User, UserRole
from app.config import settings


class AuthService:
    """Service for authentication and authorization."""

    def __init__(self):
        """Initialize auth service."""
        self.secret_key = settings.secret_key
        self.algorithm = settings.algorithm
        self.access_token_expire_minutes = settings.access_token_expire_minutes

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )

    def hash_password(self, password: str) -> str:
        """Hash a password."""
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        return hashed.decode('utf-8')

    def create_access_token(self, user_id: int, username: str, role: str) -> str:
        """Create JWT access token."""
        expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        to_encode = {
            "sub": str(user_id),
            "username": username,
            "role": role,
            "exp": expire,
        }
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt

    def decode_token(self, token: str) -> Optional[dict]:
        """Decode and validate JWT token."""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except JWTError:
            return None

    def authenticate_user(self, session: Session, username: str, password: str) -> Optional[User]:
        """Authenticate user with username and password."""
        stmt = select(User).where(User.username == username)
        user = session.exec(stmt).first()

        if not user:
            return None

        if not self.verify_password(password, user.hashed_password):
            return None

        if not user.active:
            return None

        return user

    def create_user(
        self, session: Session, username: str, password: str, role: UserRole = UserRole.TEST_USER
    ) -> User:
        """Create a new user."""
        # Check if user already exists
        stmt = select(User).where(User.username == username)
        existing = session.exec(stmt).first()
        if existing:
            raise ValueError("Username already exists")

        hashed_password = self.hash_password(password)
        user = User(username=username, hashed_password=hashed_password, role=role)
        session.add(user)
        session.commit()
        session.refresh(user)

        return user

    def get_user_by_id(self, session: Session, user_id: int) -> Optional[User]:
        """Get user by ID."""
        return session.get(User, user_id)

    def update_user_role(
        self, session: Session, admin_user: User, target_user_id: int, new_role: UserRole
    ) -> User:
        """Update user role with permission checks."""
        target_user = session.get(User, target_user_id)
        if not target_user:
            raise ValueError("User not found")

        # Check permissions
        if not admin_user.can_manage_user(target_user):
            raise PermissionError("You don't have permission to manage this user")

        # Manager can only upgrade test_user to user
        if admin_user.role == UserRole.MANAGER:
            if target_user.role != UserRole.TEST_USER or new_role != UserRole.USER:
                raise PermissionError("Managers can only upgrade test users to regular users")

        target_user.role = new_role
        session.commit()
        session.refresh(target_user)

        return target_user
