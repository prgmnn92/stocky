"""Migration script to add user system."""
import sqlite3
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DB_PATH = Path("data/trader.db")


def run_migration():
    """Run migration to add users table and update symbols."""
    if not DB_PATH.exists():
        logger.info("Database doesn't exist yet, will be created on first run")
        return

    logger.info(f"Backing up database to {DB_PATH}.backup")
    import shutil

    shutil.copy(DB_PATH, f"{DB_PATH}.backup_before_users")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if users table exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
        )
        users_table_exists = cursor.fetchone() is not None

        if not users_table_exists:
            # Create users table
            logger.info("Creating users table...")
            cursor.execute(
                """
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    hashed_password VARCHAR(255) NOT NULL,
                    role VARCHAR(20) NOT NULL DEFAULT 'test_user',
                    active BOOLEAN NOT NULL DEFAULT 1,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """
            )
            logger.info("Users table created")
        else:
            logger.info("Users table already exists")

        # Get admin user ID
        cursor.execute("SELECT id FROM users WHERE username = 'admin'")
        result = cursor.fetchone()
        if result:
            admin_id = result[0]
            logger.info(f"Found admin user with ID: {admin_id}")
        else:
            logger.warning("Admin user not found, please create it manually")
            admin_id = 1  # fallback

        # Check if symbols table needs migration
        cursor.execute("PRAGMA table_info(symbols)")
        columns = {row[1] for row in cursor.fetchall()}

        if "user_id" not in columns:
            logger.info("Adding user_id to symbols table...")

            # Create new symbols table with user_id
            cursor.execute(
                """
                CREATE TABLE symbols_new (
                    symbol VARCHAR(20) PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    name VARCHAR(200),
                    active BOOLEAN NOT NULL DEFAULT 1,
                    added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            """
            )

            # Copy existing symbols to admin user
            cursor.execute(
                f"""
                INSERT INTO symbols_new (symbol, user_id, name, active, added_at)
                SELECT symbol, {admin_id}, name, active, added_at
                FROM symbols
            """
            )

            # Drop old table and rename new one
            cursor.execute("DROP TABLE symbols")
            cursor.execute("ALTER TABLE symbols_new RENAME TO symbols")

            # Create index on user_id
            cursor.execute("CREATE INDEX idx_symbols_user_id ON symbols(user_id)")

        conn.commit()
        logger.info("Migration completed successfully!")

    except Exception as e:
        logger.error(f"Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    run_migration()
