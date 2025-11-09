"""SMA Crossover strategy."""
from datetime import datetime
from typing import Any, Dict, List
import pandas as pd
from app.strategies.base import BaseStrategy, SignalDict


class SmaCross(BaseStrategy):
    """Simple Moving Average Crossover strategy."""

    key = "sma_cross"
    name = "SMA Fast/Slow Crossover"
    default_params = {"fast": 10, "slow": 50}

    def __init__(self, fast: int = 10, slow: int = 50, **kwargs: Any) -> None:
        """
        Initialize SMA crossover strategy.

        Args:
            fast: Fast SMA period (default: 10)
            slow: Slow SMA period (default: 50)
        """
        super().__init__(fast=fast, slow=slow, **kwargs)
        self.fast = fast
        self.slow = slow

    def generate_signals(self, df: pd.DataFrame, context: Dict[str, Any]) -> List[SignalDict]:
        """Generate signals based on SMA crossover."""
        self.validate_dataframe(df)

        if len(df) < self.slow:
            return []

        d = df.copy()

        # Calculate SMAs
        d["sma_fast"] = d["close"].rolling(window=self.fast).mean()
        d["sma_slow"] = d["close"].rolling(window=self.slow).mean()

        # Detect crossovers: 1 = bullish cross, -1 = bearish cross
        d["cross"] = (d["sma_fast"] > d["sma_slow"]).astype(int).diff()

        signals: List[SignalDict] = []

        for _, row in d.dropna().iterrows():
            if row["cross"] == 1:
                # Bullish crossover
                signals.append(
                    {
                        "ts": row["ts"] if isinstance(row["ts"], datetime) else datetime.combine(row["ts"], datetime.min.time()),
                        "action": "BUY",
                        "confidence": 0.6,
                        "meta": {
                            "fast": self.fast,
                            "slow": self.slow,
                            "price": float(row["close"]),
                            "sma_fast": float(row["sma_fast"]),
                            "sma_slow": float(row["sma_slow"]),
                        },
                    }
                )
            elif row["cross"] == -1:
                # Bearish crossover
                signals.append(
                    {
                        "ts": row["ts"] if isinstance(row["ts"], datetime) else datetime.combine(row["ts"], datetime.min.time()),
                        "action": "SELL",
                        "confidence": 0.6,
                        "meta": {
                            "fast": self.fast,
                            "slow": self.slow,
                            "price": float(row["close"]),
                            "sma_fast": float(row["sma_fast"]),
                            "sma_slow": float(row["sma_slow"]),
                        },
                    }
                )

        return signals
