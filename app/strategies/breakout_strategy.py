"""Breakout Strategy."""
from datetime import datetime
from typing import Any, Dict, List
import pandas as pd
from app.strategies.base import BaseStrategy, SignalDict


class BreakoutStrategy(BaseStrategy):
    """Volume and price breakout strategy."""

    key = "breakout_strategy"
    name = "Volume Breakout"
    default_params = {"period": 20, "volume_multiplier": 1.5}

    def __init__(self, period: int = 20, volume_multiplier: float = 1.5, **kwargs: Any) -> None:
        """
        Initialize Breakout strategy.

        Args:
            period: Lookback period for highs/lows (default: 20)
            volume_multiplier: Volume must be this times average (default: 1.5)
        """
        super().__init__(period=period, volume_multiplier=volume_multiplier, **kwargs)
        self.period = period
        self.volume_multiplier = volume_multiplier

    def generate_signals(self, df: pd.DataFrame, context: Dict[str, Any]) -> List[SignalDict]:
        """Generate signals based on price and volume breakouts."""
        self.validate_dataframe(df)

        if len(df) < self.period:
            return []

        d = df.copy()

        # Calculate rolling highs, lows, and average volume
        d["high_period"] = d["high"].rolling(window=self.period).max()
        d["low_period"] = d["low"].rolling(window=self.period).min()
        d["avg_volume"] = d["volume"].rolling(window=self.period).mean()

        # Shift to use previous period's values
        d["high_prev_period"] = d["high_period"].shift(1)
        d["low_prev_period"] = d["low_period"].shift(1)

        signals: List[SignalDict] = []

        for _, row in d.dropna().iterrows():
            # Buy signal: Price breaks above previous high with strong volume
            if (
                row["close"] > row["high_prev_period"]
                and row["volume"] > row["avg_volume"] * self.volume_multiplier
            ):
                volume_ratio = row["volume"] / row["avg_volume"]
                signals.append(
                    {
                        "ts": row["ts"] if isinstance(row["ts"], datetime) else datetime.combine(row["ts"], datetime.min.time()),
                        "action": "BUY",
                        "confidence": min(0.8, 0.5 + (volume_ratio - self.volume_multiplier) * 0.1),
                        "meta": {
                            "period": self.period,
                            "volume_multiplier": self.volume_multiplier,
                            "price": float(row["close"]),
                            "breakout_level": float(row["high_prev_period"]),
                            "volume": int(row["volume"]),
                            "avg_volume": float(row["avg_volume"]),
                            "volume_ratio": float(volume_ratio),
                        },
                    }
                )
            # Sell signal: Price breaks below previous low with strong volume
            elif (
                row["close"] < row["low_prev_period"]
                and row["volume"] > row["avg_volume"] * self.volume_multiplier
            ):
                volume_ratio = row["volume"] / row["avg_volume"]
                signals.append(
                    {
                        "ts": row["ts"] if isinstance(row["ts"], datetime) else datetime.combine(row["ts"], datetime.min.time()),
                        "action": "SELL",
                        "confidence": min(0.8, 0.5 + (volume_ratio - self.volume_multiplier) * 0.1),
                        "meta": {
                            "period": self.period,
                            "volume_multiplier": self.volume_multiplier,
                            "price": float(row["close"]),
                            "breakdown_level": float(row["low_prev_period"]),
                            "volume": int(row["volume"]),
                            "avg_volume": float(row["avg_volume"]),
                            "volume_ratio": float(volume_ratio),
                        },
                    }
                )

        return signals
