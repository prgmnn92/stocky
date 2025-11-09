"""Migration script to add user_id to strategies table."""
import sqlite3
import sys

def migrate():
    """Add user_id column to strategies table."""
    conn = sqlite3.connect('data/trader.db')
    cursor = conn.cursor()

    try:
        # Check if user_id column already exists
        cursor.execute("PRAGMA table_info(strategies)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'user_id' in columns:
            print("✓ user_id column already exists in strategies table")
            return

        # Get admin user ID (first user)
        cursor.execute("SELECT id FROM users ORDER BY id LIMIT 1")
        admin_user = cursor.fetchone()

        if not admin_user:
            print("✗ No users found in database. Cannot migrate.")
            sys.exit(1)

        admin_id = admin_user[0]
        print(f"Using user ID {admin_id} as default owner for existing strategies")

        # Add user_id column with default value
        cursor.execute(f"ALTER TABLE strategies ADD COLUMN user_id INTEGER NOT NULL DEFAULT {admin_id}")

        # Create index on user_id
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_strategies_user_id ON strategies (user_id)")

        # Remove unique constraint from key and add composite index
        # SQLite doesn't support modifying constraints directly, so we need to recreate the table
        cursor.execute("""
            CREATE TABLE strategies_new (
                id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                "key" VARCHAR NOT NULL,
                name VARCHAR NOT NULL,
                params_json VARCHAR NOT NULL,
                enabled BOOLEAN NOT NULL,
                PRIMARY KEY (id),
                FOREIGN KEY(user_id) REFERENCES users (id)
            )
        """)

        # Copy data
        cursor.execute("""
            INSERT INTO strategies_new (id, user_id, "key", name, params_json, enabled)
            SELECT id, user_id, "key", name, params_json, enabled FROM strategies
        """)

        # Drop old table and rename new one
        cursor.execute("DROP TABLE strategies")
        cursor.execute("ALTER TABLE strategies_new RENAME TO strategies")

        # Create indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_strategies_user_id ON strategies (user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_strategies_key ON strategies (\"key\")")

        conn.commit()
        print("✓ Successfully added user_id column to strategies table")
        print("✓ Removed unique constraint from key (strategies can now have same key for different users)")

    except Exception as e:
        conn.rollback()
        print(f"✗ Migration failed: {e}")
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
