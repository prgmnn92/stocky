"""Base strategy interface."""
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, TypedDict
import pandas as pd


class SignalDict(TypedDict):
    """Type definition for signal output."""

    ts: datetime
    action: str  # 'BUY' or 'SELL'
    confidence: float
    meta: Dict[str, Any]


class BaseStrategy(ABC):
    """Abstract base class for trading strategies."""

    key: str = ""
    name: str = ""
    default_params: Dict[str, Any] = {}

    def __init__(self, **params: Any) -> None:
        """Initialize strategy with parameters."""
        self.params = params

    @abstractmethod
    def generate_signals(self, df: pd.DataFrame, context: Dict[str, Any]) -> List[SignalDict]:
        """
        Generate trading signals from price data.

        Args:
            df: DataFrame with columns ['ts', 'open', 'high', 'low', 'close', 'volume']
            context: Additional context (e.g., {'symbol': 'AAPL'})

        Returns:
            List of signal dictionaries
        """
        pass

    def get_params(self) -> Dict[str, Any]:
        """Get strategy parameters."""
        return self.params

    def validate_dataframe(self, df: pd.DataFrame) -> None:
        """Validate input dataframe has required columns."""
        required = ["ts", "open", "high", "low", "close", "volume"]
        missing = [col for col in required if col not in df.columns]
        if missing:
            raise ValueError(f"Missing required columns: {missing}")
