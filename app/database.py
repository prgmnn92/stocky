"""Database connection and session management."""
from sqlmodel import create_engine, Session, SQLModel
from sqlalchemy import event
from app.config import settings

# Create engine with SQLite-specific optimizations
connect_args = {}
if "sqlite" in settings.database_url:
    connect_args = {
        "check_same_thread": False,
        "timeout": 30.0,  # Wait up to 30 seconds for locks
    }

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    echo=settings.app_env == "dev",
    pool_pre_ping=True,  # Verify connections before using
    pool_size=5,  # Connection pool size
    max_overflow=10,  # Max connections above pool_size
)


# Enable WAL mode for SQLite for better concurrency
if "sqlite" in settings.database_url:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, connection_record):
        """Set SQLite pragmas for better concurrency."""
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=30000")  # 30 seconds
        cursor.close()


def init_db() -> None:
    """Initialize database tables."""
    SQLModel.metadata.create_all(engine)


def get_session() -> Session:
    """Get database session."""
    return Session(engine)
