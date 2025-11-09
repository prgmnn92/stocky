"""EMA Crossover strategy."""
from datetime import datetime
from typing import Any, Dict, List
import pandas as pd
from app.strategies.base import BaseStrategy, SignalDict


class EmaCross(BaseStrategy):
    """Exponential Moving Average Crossover strategy."""

    key = "ema_cross"
    name = "EMA Fast/Slow Crossover"
    default_params = {"fast": 12, "slow": 26}

    def __init__(self, fast: int = 12, slow: int = 26, **kwargs: Any) -> None:
        """
        Initialize EMA crossover strategy.

        Args:
            fast: Fast EMA period (default: 12)
            slow: Slow EMA period (default: 26)
        """
        super().__init__(fast=fast, slow=slow, **kwargs)
        self.fast = fast
        self.slow = slow

    def generate_signals(self, df: pd.DataFrame, context: Dict[str, Any]) -> List[SignalDict]:
        """Generate signals based on EMA crossover."""
        self.validate_dataframe(df)

        if len(df) < self.slow:
            return []

        d = df.copy()

        # Calculate EMAs
        d["ema_fast"] = d["close"].ewm(span=self.fast, adjust=False).mean()
        d["ema_slow"] = d["close"].ewm(span=self.slow, adjust=False).mean()

        # Detect crossovers: 1 = bullish cross, -1 = bearish cross
        d["cross"] = (d["ema_fast"] > d["ema_slow"]).astype(int).diff()

        signals: List[SignalDict] = []

        for _, row in d.dropna().iterrows():
            if row["cross"] == 1:
                # Bullish crossover
                signals.append(
                    {
                        "ts": row["ts"] if isinstance(row["ts"], datetime) else datetime.combine(row["ts"], datetime.min.time()),
                        "action": "BUY",
                        "confidence": 0.7,
                        "meta": {
                            "fast": self.fast,
                            "slow": self.slow,
                            "price": float(row["close"]),
                            "ema_fast": float(row["ema_fast"]),
                            "ema_slow": float(row["ema_slow"]),
                        },
                    }
                )
            elif row["cross"] == -1:
                # Bearish crossover
                signals.append(
                    {
                        "ts": row["ts"] if isinstance(row["ts"], datetime) else datetime.combine(row["ts"], datetime.min.time()),
                        "action": "SELL",
                        "confidence": 0.7,
                        "meta": {
                            "fast": self.fast,
                            "slow": self.slow,
                            "price": float(row["close"]),
                            "ema_fast": float(row["ema_fast"]),
                            "ema_slow": float(row["ema_slow"]),
                        },
                    }
                )

        return signals
