"""Add balance to users and user_id to positions."""
import sqlite3
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DB_PATH = "data/trader.db"


def migrate_database():
    """Add balance column to users and user_id to positions."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        logger.info("Starting database migration...")

        # 1. Add balance column to users table
        logger.info("Adding balance column to users table...")
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN balance REAL DEFAULT 50000.0")
            logger.info("✓ Added balance column to users")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                logger.info("✓ Balance column already exists in users")
            else:
                raise

        # 2. Update existing users to have default balance if NULL
        cursor.execute("UPDATE users SET balance = 50000.0 WHERE balance IS NULL")
        logger.info("✓ Set default balance for existing users")

        # 3. Check if positions table has user_id column
        cursor.execute("PRAGMA table_info(positions)")
        columns = [col[1] for col in cursor.fetchall()]

        if "user_id" not in columns:
            logger.info("Adding user_id column to positions table...")

            # Get admin user ID (default to 1)
            cursor.execute("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1")
            admin_row = cursor.fetchone()
            admin_id = admin_row[0] if admin_row else 1

            # Add user_id column with default admin_id for existing positions
            cursor.execute(f"ALTER TABLE positions ADD COLUMN user_id INTEGER DEFAULT {admin_id}")
            logger.info(f"✓ Added user_id column to positions (defaulting to user_id={admin_id})")

            # Update the column to be NOT NULL and add index
            cursor.execute("CREATE INDEX idx_positions_user_id ON positions(user_id)")
            logger.info("✓ Created index on positions.user_id")
        else:
            logger.info("✓ user_id column already exists in positions")

        conn.commit()
        logger.info("✅ Database migration completed successfully!")

        # Verify the migration
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        logger.info(f"Total users: {user_count}")

        cursor.execute("SELECT username, balance FROM users")
        logger.info("\\nUser balances:")
        for username, balance in cursor.fetchall():
            logger.info(f"  {username}: ${balance:,.2f}")

        cursor.execute("SELECT COUNT(*) FROM positions")
        position_count = cursor.fetchone()[0]
        logger.info(f"\\nTotal positions: {position_count}")

        if position_count > 0:
            cursor.execute("""
                SELECT p.id, p.symbol, p.status, u.username
                FROM positions p
                JOIN users u ON p.user_id = u.id
            """)
            logger.info("\\nPositions:")
            for pos_id, symbol, status, username in cursor.fetchall():
                logger.info(f"  Position #{pos_id}: {symbol} ({status}) - owned by {username}")

    except Exception as e:
        logger.error(f"Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    migrate_database()
