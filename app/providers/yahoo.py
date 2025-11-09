"""Yahoo Finance provider."""
import logging
from datetime import date
from typing import List, Optional
import pandas as pd
import yfinance as yf
from app.providers.base import MarketDataProvider

logger = logging.getLogger(__name__)


class YahooProvider(MarketDataProvider):
    """Yahoo Finance data provider."""

    def get_current_price(self, symbol: str) -> Optional[float]:
        """
        Fetch current/latest price for a symbol from Yahoo Finance.

        Returns the current price or None if unavailable.
        """
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info

            # Try to get current price from different fields
            price = info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')

            if price:
                return float(price)

            # Fallback: get most recent closing price from history
            df = ticker.history(period="1d")
            if not df.empty:
                return float(df['Close'].iloc[-1])

            logger.warning(f"No price data available for {symbol}")
            return None

        except Exception as e:
            logger.error(f"Failed to fetch current price for {symbol}: {e}")
            return None

    def eod_bars(self, symbols: List[str], start: date, end: date) -> dict[str, pd.DataFrame]:
        """Fetch EOD bars from Yahoo Finance."""
        result = {}

        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol)
                df = ticker.history(start=start, end=end, interval="1d")

                if df.empty:
                    logger.warning(f"No data returned for {symbol}")
                    continue

                # Normalize columns to match our schema
                df = df.reset_index()
                df = df.rename(
                    columns={
                        "Date": "ts",
                        "Open": "open",
                        "High": "high",
                        "Low": "low",
                        "Close": "close",
                        "Volume": "volume",
                    }
                )

                # Select only required columns
                df = df[["ts", "open", "high", "low", "close", "volume"]]

                # Convert ts to date
                df["ts"] = pd.to_datetime(df["ts"]).dt.date

                result[symbol] = df
                logger.info(f"Fetched {len(df)} bars for {symbol}")

            except Exception as e:
                logger.error(f"Failed to fetch data for {symbol}: {e}")
                continue

        return result
