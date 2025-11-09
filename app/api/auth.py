"""Authentication API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlmodel import Session, select
from app.database import get_session
from app.models import User, UserRole
from app.services.auth_service import AuthService

router = APIRouter()
security = HTTPBearer(auto_error=False)
auth_service = AuthService()


# Schemas
class LoginRequest(BaseModel):
    username: str
    password: str


class SignupRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    active: bool
    balance: float
    created_at: str


class UpdateRoleRequest(BaseModel):
    role: str


class UpdateBalanceRequest(BaseModel):
    balance: float


# Dependency to get current user from token
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(get_session),
) -> User:
    """Get current user from JWT token."""
    import logging
    logger = logging.getLogger(__name__)

    if not credentials:
        logger.error("[AUTH] No credentials provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token = credentials.credentials
    logger.info(f"[AUTH] Decoding token: {token[:20]}...")
    payload = auth_service.decode_token(token)

    if not payload:
        logger.error("[AUTH] Token decode failed - invalid token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    logger.info(f"[AUTH] Token payload: {payload}")
    user_id = int(payload.get("sub"))
    user = auth_service.get_user_by_id(session, user_id)

    if not user:
        logger.error(f"[AUTH] User not found: user_id={user_id}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive"
        )

    if not user.active:
        logger.error(f"[AUTH] User inactive: user_id={user_id}, username={user.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive"
        )

    logger.info(f"[AUTH] User authenticated: user_id={user.id}, username={user.username}, role={user.role}")
    return user


# Optional authentication (for endpoints that work with or without auth)
async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    ),
    session: Session = Depends(get_session),
) -> Optional[User]:
    """Get current user from JWT token, or None if not authenticated."""
    if not credentials:
        return None

    try:
        return await get_current_user(credentials, session)
    except HTTPException:
        return None


@router.post("/auth/signup", response_model=TokenResponse)
async def signup(request: SignupRequest, session: Session = Depends(get_session)) -> dict:
    """Sign up a new user."""
    try:
        # Create user with TEST_USER role
        user = auth_service.create_user(
            session=session, username=request.username, password=request.password
        )

        # Create default symbols for the new user
        from app.seed import seed_default_symbols

        seed_default_symbols(session, user)

        # Generate token
        token = auth_service.create_access_token(
            user_id=user.id, username=user.username, role=user.role.value
        )

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "username": user.username,
                "role": user.role.value,
                "active": user.active,
                "balance": user.balance,
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/auth/login", response_model=TokenResponse)
async def login(request: LoginRequest, session: Session = Depends(get_session)) -> dict:
    """Login with username and password."""
    user = auth_service.authenticate_user(session, request.username, request.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    # Generate token
    token = auth_service.create_access_token(
        user_id=user.id, username=user.username, role=user.role.value
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role.value,
            "active": user.active,
            "balance": user.balance,
        },
    }


@router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> dict:
    """Get current user information."""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "role": current_user.role.value,
        "active": current_user.active,
        "balance": current_user.balance,
        "created_at": current_user.created_at.isoformat(),
    }


@router.get("/users", response_model=List[UserResponse])
async def list_users(
    current_user: User = Depends(get_current_user), session: Session = Depends(get_session)
) -> List[dict]:
    """List all users (admin/manager only)."""
    if not current_user.can_manage_users():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view users"
        )

    stmt = select(User).order_by(User.created_at.desc())
    users = session.exec(stmt).all()

    # Managers can only see test users
    if current_user.role == UserRole.MANAGER:
        users = [u for u in users if u.role == UserRole.TEST_USER or u.id == current_user.id]

    return [
        {
            "id": u.id,
            "username": u.username,
            "role": u.role.value,
            "active": u.active,
            "balance": u.balance,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


@router.patch("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: int,
    request: UpdateRoleRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    """Update user role (admin/manager only)."""
    if not current_user.can_manage_users():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to manage users"
        )

    try:
        new_role = UserRole(request.role)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    try:
        updated_user = auth_service.update_user_role(
            session=session, admin_user=current_user, target_user_id=user_id, new_role=new_role
        )

        return {
            "id": updated_user.id,
            "username": updated_user.username,
            "role": updated_user.role.value,
            "active": updated_user.active,
            "balance": updated_user.balance,
            "created_at": updated_user.created_at.isoformat(),
        }
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    """Delete a user (admin only)."""
    # Only admins can delete users
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can delete users"
        )

    # Can't delete yourself
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account"
        )

    # Get the user to delete
    target_user = session.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Delete the user
    session.delete(target_user)
    session.commit()

    return {"ok": True, "message": f"User {target_user.username} deleted successfully"}


@router.patch("/users/{user_id}/balance")
async def update_user_balance(
    user_id: int,
    request: UpdateBalanceRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    """Update user balance (admin/manager only)."""
    if not current_user.can_manage_users():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to manage user balances"
        )

    # Get the target user
    target_user = session.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Managers can only update test user balances
    if current_user.role == UserRole.MANAGER and target_user.role != UserRole.TEST_USER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Managers can only update test user balances"
        )

    # Validate balance
    if request.balance < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Balance cannot be negative")

    # Update balance
    target_user.balance = request.balance
    session.add(target_user)
    session.commit()
    session.refresh(target_user)

    return {
        "ok": True,
        "user_id": target_user.id,
        "username": target_user.username,
        "balance": target_user.balance,
    }
