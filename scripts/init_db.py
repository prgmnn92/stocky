#!/usr/bin/env python
"""Initialize database with sample data."""
import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import init_db, get_session
from app.models import Symbol, Strategy


def main():
    """Initialize database with sample symbols and strategies."""
    print("Initializing database...")
    init_db()
    print("✓ Database schema created")

    session = get_session()

    # Add sample symbols
    symbols = [
        Symbol(symbol="AAPL", name="Apple Inc."),
        Symbol(symbol="MSFT", name="Microsoft Corporation"),
        Symbol(symbol="GOOGL", name="Alphabet Inc."),
        Symbol(symbol="AMZN", name="Amazon.com Inc."),
        Symbol(symbol="TSLA", name="Tesla Inc."),
    ]

    for symbol in symbols:
        existing = session.get(Symbol, symbol.symbol)
        if not existing:
            session.add(symbol)
            print(f"✓ Added symbol: {symbol.symbol}")
        else:
            print(f"  Symbol already exists: {symbol.symbol}")

    # Add default strategy
    strategy = Strategy(
        key="sma_cross",
        name="SMA Fast/Slow Crossover",
        params_json='{"fast": 10, "slow": 50}',
        enabled=True,
    )

    from sqlmodel import select

    stmt = select(Strategy).where(Strategy.key == "sma_cross")
    existing = session.exec(stmt).first()

    if not existing:
        session.add(strategy)
        print("✓ Added strategy: SMA Crossover")
    else:
        print("  Strategy already exists: SMA Crossover")

    session.commit()
    session.close()

    print("\n✅ Database initialization complete!")
    print("\nNext steps:")
    print("1. Run the application: make dev")
    print("2. Trigger data ingestion: curl -X POST http://localhost:8000/run/daily")
    print("3. View signals: curl http://localhost:8000/signals")
    print("4. API docs: http://localhost:8000/docs")


if __name__ == "__main__":
    main()
