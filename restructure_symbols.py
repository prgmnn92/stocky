"""Restructure symbols table to use many-to-many relationship with users."""
import sqlite3
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DB_PATH = "data/trader.db"


def restructure_symbols_tables():
    """
    Restructure database to have:
    - symbols: shared symbol information (symbol as PK)
    - user_symbols: junction table (user_id, symbol, composite PK)
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        logger.info("Starting database restructure...")

        # 1. Create new symbols table (without user_id)
        logger.info("Creating new symbols table...")
        cursor.execute("""
            CREATE TABLE symbols_new (
                symbol VARCHAR(20) NOT NULL PRIMARY KEY,
                name VARCHAR(200),
                active BOOLEAN NOT NULL DEFAULT 1,
                added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 2. Create user_symbols junction table
        logger.info("Creating user_symbols junction table...")
        cursor.execute("""
            CREATE TABLE user_symbols (
                user_id INTEGER NOT NULL,
                symbol VARCHAR(20) NOT NULL,
                added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, symbol),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (symbol) REFERENCES symbols_new(symbol) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE INDEX idx_user_symbols_user_id ON user_symbols(user_id)")
        cursor.execute("CREATE INDEX idx_user_symbols_symbol ON user_symbols(symbol)")

        # 3. Migrate unique symbols to new symbols table
        logger.info("Migrating unique symbols...")
        cursor.execute("""
            INSERT INTO symbols_new (symbol, name, active, added_at)
            SELECT DISTINCT symbol, name, active, MIN(added_at) as added_at
            FROM symbols
            GROUP BY symbol
        """)

        # 4. Migrate user-symbol relationships to junction table
        logger.info("Migrating user-symbol relationships...")
        cursor.execute("""
            INSERT INTO user_symbols (user_id, symbol, added_at)
            SELECT DISTINCT user_id, symbol, added_at
            FROM symbols
        """)

        # 5. Drop old symbols table and rename new one
        logger.info("Replacing old symbols table...")
        cursor.execute("DROP TABLE symbols")
        cursor.execute("ALTER TABLE symbols_new RENAME TO symbols")

        conn.commit()
        logger.info("Database restructure completed successfully!")

        # 6. Verify the migration
        cursor.execute("SELECT COUNT(*) FROM symbols")
        symbol_count = cursor.fetchone()[0]
        logger.info(f"Total unique symbols: {symbol_count}")

        cursor.execute("SELECT COUNT(*) FROM user_symbols")
        user_symbol_count = cursor.fetchone()[0]
        logger.info(f"Total user-symbol relationships: {user_symbol_count}")

        # Show some examples
        cursor.execute("""
            SELECT u.username, COUNT(us.symbol) as symbol_count
            FROM users u
            LEFT JOIN user_symbols us ON u.id = us.user_id
            GROUP BY u.id, u.username
        """)
        logger.info("\nSymbols per user:")
        for username, count in cursor.fetchall():
            logger.info(f"  {username}: {count} symbols")

    except Exception as e:
        logger.error(f"Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    restructure_symbols_tables()
