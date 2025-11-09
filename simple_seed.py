"""Simple seed script that creates admin user directly."""
import sqlite3
import bcrypt

DB_PATH = "data/trader.db"

# Default symbols
DEFAULT_SYMBOLS = [
    ("AAPL", "Apple Inc."),
    ("MSFT", "Microsoft Corporation"),
    ("GOOGL", "Alphabet Inc."),
    ("AMZN", "Amazon.com Inc."),
    ("TSLA", "Tesla Inc."),
]


def seed_admin():
    """Create admin user and default symbols."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if admin exists
        cursor.execute("SELECT id FROM users WHERE username = 'admin'")
        existing = cursor.fetchone()

        if existing:
            print("Admin user already exists")
            admin_id = existing[0]
        else:
            # Create admin user (password: admin123)
            password = "admin123"
            hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

            cursor.execute(
                """
                INSERT INTO users (username, hashed_password, role, active, created_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
                ("admin", hashed.decode('utf-8'), "ADMIN", True),
            )
            admin_id = cursor.lastrowid
            print(f"Created admin user (id: {admin_id})")

        # Add default symbols for admin
        for symbol, name in DEFAULT_SYMBOLS:
            # First ensure symbol exists in symbols table
            cursor.execute("SELECT symbol FROM symbols WHERE symbol = ?", (symbol,))
            if not cursor.fetchone():
                cursor.execute(
                    """
                    INSERT INTO symbols (symbol, name, active, added_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                """,
                    (symbol, name, True),
                )
                print(f"Created shared symbol {symbol}")

            # Then create user-symbol relationship
            cursor.execute(
                "SELECT user_id FROM user_symbols WHERE user_id = ? AND symbol = ?",
                (admin_id, symbol),
            )
            if not cursor.fetchone():
                cursor.execute(
                    """
                    INSERT INTO user_symbols (user_id, symbol, added_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                """,
                    (admin_id, symbol),
                )
                print(f"Added symbol {symbol} to admin's watchlist")

        conn.commit()
        print("Seeding completed successfully!")

    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    seed_admin()
