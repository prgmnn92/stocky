"""Base market data provider interface."""
from abc import ABC, abstractmethod
from datetime import date
from typing import List
import pandas as pd


class MarketDataProvider(ABC):
    """Abstract interface for market data providers."""

    @abstractmethod
    def eod_bars(self, symbols: List[str], start: date, end: date) -> dict[str, pd.DataFrame]:
        """
        Fetch end-of-day bars for multiple symbols.

        Args:
            symbols: List of ticker symbols
            start: Start date
            end: End date

        Returns:
            Dictionary mapping symbol to DataFrame with columns:
            ['ts', 'open', 'high', 'low', 'close', 'volume']
        """
        pass
