"""MACD Strategy."""
from datetime import datetime
from typing import Any, Dict, List
import pandas as pd
from app.strategies.base import BaseStrategy, SignalDict


class MacdStrategy(BaseStrategy):
    """Moving Average Convergence Divergence (MACD) strategy."""

    key = "macd_strategy"
    name = "MACD Crossover"
    default_params = {"fast": 12, "slow": 26, "signal": 9}

    def __init__(self, fast: int = 12, slow: int = 26, signal: int = 9, **kwargs: Any) -> None:
        """
        Initialize MACD strategy.

        Args:
            fast: Fast EMA period (default: 12)
            slow: Slow EMA period (default: 26)
            signal: Signal line EMA period (default: 9)
        """
        super().__init__(fast=fast, slow=slow, signal=signal, **kwargs)
        self.fast = fast
        self.slow = slow
        self.signal = signal

    def calculate_macd(self, prices: pd.Series) -> tuple:
        """Calculate MACD, signal line, and histogram."""
        ema_fast = prices.ewm(span=self.fast, adjust=False).mean()
        ema_slow = prices.ewm(span=self.slow, adjust=False).mean()

        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=self.signal, adjust=False).mean()
        histogram = macd_line - signal_line

        return macd_line, signal_line, histogram

    def generate_signals(self, df: pd.DataFrame, context: Dict[str, Any]) -> List[SignalDict]:
        """Generate signals based on MACD crossover."""
        self.validate_dataframe(df)

        if len(df) < self.slow + self.signal:
            return []

        d = df.copy()
        d["macd"], d["signal_line"], d["histogram"] = self.calculate_macd(d["close"])

        # Detect crossovers
        d["cross"] = (d["macd"] > d["signal_line"]).astype(int).diff()

        signals: List[SignalDict] = []

        for _, row in d.dropna().iterrows():
            if row["cross"] == 1:
                # Bullish crossover: MACD crosses above signal line
                signals.append(
                    {
                        "ts": row["ts"] if isinstance(row["ts"], datetime) else datetime.combine(row["ts"], datetime.min.time()),
                        "action": "BUY",
                        "confidence": 0.75,
                        "meta": {
                            "fast": self.fast,
                            "slow": self.slow,
                            "signal": self.signal,
                            "macd": float(row["macd"]),
                            "signal_line": float(row["signal_line"]),
                            "price": float(row["close"]),
                        },
                    }
                )
            elif row["cross"] == -1:
                # Bearish crossover: MACD crosses below signal line
                signals.append(
                    {
                        "ts": row["ts"] if isinstance(row["ts"], datetime) else datetime.combine(row["ts"], datetime.min.time()),
                        "action": "SELL",
                        "confidence": 0.75,
                        "meta": {
                            "fast": self.fast,
                            "slow": self.slow,
                            "signal": self.signal,
                            "macd": float(row["macd"]),
                            "signal_line": float(row["signal_line"]),
                            "price": float(row["close"]),
                        },
                    }
                )

        return signals
