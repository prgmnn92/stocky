"""Data service for price ingestion and retrieval."""
import logging
from datetime import date, timedelta
from typing import List
import pandas as pd
from sqlmodel import Session, select
from app.models import Symbol, PriceBar
from app.providers import MarketDataProvider
from app.config import settings

logger = logging.getLogger(__name__)


class DataService:
    """Service for managing market data."""

    def __init__(self, session: Session, provider: MarketDataProvider) -> None:
        """Initialize data service."""
        self.session = session
        self.provider = provider

    def get_active_symbols(self) -> List[str]:
        """Get list of active symbols."""
        stmt = select(Symbol).where(Symbol.active == True)
        symbols = self.session.exec(stmt).all()
        return [s.symbol for s in symbols]

    def ingest_eod_bars(self, symbols: List[str], lookback_days: int = None) -> None:
        """
        Ingest end-of-day price bars for symbols.

        Args:
            symbols: List of ticker symbols
            lookback_days: Number of days to fetch (default from settings)
        """
        if not symbols:
            logger.info("No symbols to ingest")
            return

        if lookback_days is None:
            lookback_days = settings.lookback_days

        end_date = date.today()
        start_date = end_date - timedelta(days=lookback_days)

        logger.info(f"Ingesting data for {len(symbols)} symbols from {start_date} to {end_date}")

        # Fetch data
        bars_map = self.provider.eod_bars(symbols, start_date, end_date)

        # Upsert to database
        for symbol, df in bars_map.items():
            self._upsert_bars(symbol, df)

    def _upsert_bars(self, symbol: str, df: pd.DataFrame) -> None:
        """Upsert price bars for a symbol."""
        if df.empty:
            return

        for _, row in df.iterrows():
            # Check if bar exists
            stmt = select(PriceBar).where(
                PriceBar.symbol == symbol, PriceBar.ts == row["ts"]
            )
            existing = self.session.exec(stmt).first()

            if existing:
                # Update
                existing.open = float(row["open"])
                existing.high = float(row["high"])
                existing.low = float(row["low"])
                existing.close = float(row["close"])
                existing.volume = float(row["volume"])
            else:
                # Insert
                bar = PriceBar(
                    symbol=symbol,
                    ts=row["ts"],
                    open=float(row["open"]),
                    high=float(row["high"]),
                    low=float(row["low"]),
                    close=float(row["close"]),
                    volume=float(row["volume"]),
                )
                self.session.add(bar)

        self.session.commit()
        logger.info(f"Upserted {len(df)} bars for {symbol}")

    def get_price_data(self, symbol: str, limit: int = 400) -> pd.DataFrame:
        """
        Get price data for a symbol.

        Args:
            symbol: Ticker symbol
            limit: Maximum number of bars to return

        Returns:
            DataFrame with price data
        """
        stmt = (
            select(PriceBar)
            .where(PriceBar.symbol == symbol)
            .order_by(PriceBar.ts.desc())
            .limit(limit)
        )
        bars = self.session.exec(stmt).all()

        if not bars:
            return pd.DataFrame()

        df = pd.DataFrame([b.model_dump() for b in bars])
        df = df.sort_values("ts").reset_index(drop=True)
        return df[["ts", "open", "high", "low", "close", "volume"]]
