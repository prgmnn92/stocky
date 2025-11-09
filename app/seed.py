"""Database seeding script for initial data."""
import logging
from sqlmodel import Session, select
from app.database import engine
from app.models import User, UserRole, Symbol, UserSymbol
from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)

# Default symbols for all users
DEFAULT_SYMBOLS = [
    {"symbol": "AAPL", "name": "Apple Inc."},
    {"symbol": "MSFT", "name": "Microsoft Corporation"},
    {"symbol": "GOOGL", "name": "Alphabet Inc."},
    {"symbol": "AMZN", "name": "Amazon.com Inc."},
    {"symbol": "TSLA", "name": "Tesla Inc."},
]


def seed_admin_user(session: Session) -> User:
    """Create admin user if not exists."""
    auth_service = AuthService()

    # Check if admin already exists
    stmt = select(User).where(User.username == "admin")
    admin = session.exec(stmt).first()

    if admin:
        logger.info("Admin user already exists")
        return admin

    # Create admin user
    admin = auth_service.create_user(
        session=session, username="admin", password="admin123", role=UserRole.ADMIN
    )

    logger.info(f"Created admin user: {admin.username}")
    return admin


def seed_default_symbols(session: Session, user: User) -> None:
    """Create default symbols for a user."""
    for symbol_data in DEFAULT_SYMBOLS:
        symbol_str = symbol_data["symbol"]

        # First ensure symbol exists in symbols table
        symbol = session.get(Symbol, symbol_str)
        if not symbol:
            symbol = Symbol(
                symbol=symbol_str,
                name=symbol_data["name"],
                active=True,
            )
            session.add(symbol)
            session.flush()  # Ensure symbol is created before creating relationship
            logger.info(f"Created shared symbol {symbol_str}")

        # Check if user-symbol relationship already exists
        stmt = select(UserSymbol).where(
            UserSymbol.user_id == user.id, UserSymbol.symbol == symbol_str
        )
        existing = session.exec(stmt).first()

        if not existing:
            user_symbol = UserSymbol(user_id=user.id, symbol=symbol_str)
            session.add(user_symbol)
            logger.info(f"Added symbol {symbol_str} to {user.username}'s watchlist")

    session.commit()


def seed_database():
    """Seed database with initial data."""
    logger.info("Starting database seeding...")

    with Session(engine) as session:
        # Create admin user
        admin = seed_admin_user(session)

        # Add default symbols for admin
        seed_default_symbols(session, admin)

    logger.info("Database seeding completed")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seed_database()
