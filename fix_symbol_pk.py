"""Fix symbols table to have composite primary key."""
import sqlite3
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DB_PATH = "data/trader.db"


def fix_symbol_primary_key():
    """Update symbols table to use composite primary key (symbol, user_id)."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check current schema
        cursor.execute("PRAGMA table_info(symbols)")
        columns = cursor.fetchall()
        logger.info(f"Current columns: {columns}")

        # Create new table with composite primary key
        logger.info("Creating new symbols table with composite primary key...")
        cursor.execute("""
            CREATE TABLE symbols_new (
                symbol VARCHAR(20) NOT NULL,
                user_id INTEGER NOT NULL,
                name VARCHAR(200),
                active BOOLEAN NOT NULL DEFAULT 1,
                added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (symbol, user_id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        # Copy data from old table
        logger.info("Copying data...")
        cursor.execute("""
            INSERT INTO symbols_new (symbol, user_id, name, active, added_at)
            SELECT symbol, user_id, name, active, added_at
            FROM symbols
        """)

        # Drop old table and rename new one
        logger.info("Replacing old table...")
        cursor.execute("DROP TABLE symbols")
        cursor.execute("ALTER TABLE symbols_new RENAME TO symbols")

        # Create index on user_id
        cursor.execute("CREATE INDEX idx_symbols_user_id ON symbols(user_id)")

        conn.commit()
        logger.info("Migration completed successfully!")

        # Verify
        cursor.execute("SELECT COUNT(*) FROM symbols")
        count = cursor.fetchone()[0]
        logger.info(f"Total symbols: {count}")

    except Exception as e:
        logger.error(f"Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    fix_symbol_primary_key()
