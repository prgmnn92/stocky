"""RSI Strategy."""
from datetime import datetime
from typing import Any, Dict, List
import pandas as pd
from app.strategies.base import BaseStrategy, SignalDict


class RsiStrategy(BaseStrategy):
    """Relative Strength Index (RSI) strategy."""

    key = "rsi_strategy"
    name = "RSI Overbought/Oversold"
    default_params = {"period": 14, "oversold": 30, "overbought": 70}

    def __init__(self, period: int = 14, oversold: int = 30, overbought: int = 70, **kwargs: Any) -> None:
        """
        Initialize RSI strategy.

        Args:
            period: RSI calculation period (default: 14)
            oversold: Oversold threshold (default: 30)
            overbought: Overbought threshold (default: 70)
        """
        super().__init__(period=period, oversold=oversold, overbought=overbought, **kwargs)
        self.period = period
        self.oversold = oversold
        self.overbought = overbought

    def calculate_rsi(self, prices: pd.Series) -> pd.Series:
        """Calculate RSI indicator."""
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=self.period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=self.period).mean()

        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        return rsi

    def generate_signals(self, df: pd.DataFrame, context: Dict[str, Any]) -> List[SignalDict]:
        """Generate signals based on RSI levels."""
        self.validate_dataframe(df)

        if len(df) < self.period + 1:
            return []

        d = df.copy()
        d["rsi"] = self.calculate_rsi(d["close"])

        # Track previous RSI to detect crossovers
        d["rsi_prev"] = d["rsi"].shift(1)

        signals: List[SignalDict] = []

        for _, row in d.dropna().iterrows():
            # Buy signal: RSI crosses above oversold threshold
            if row["rsi_prev"] <= self.oversold < row["rsi"]:
                signals.append(
                    {
                        "ts": row["ts"] if isinstance(row["ts"], datetime) else datetime.combine(row["ts"], datetime.min.time()),
                        "action": "BUY",
                        "confidence": 0.7,
                        "meta": {
                            "period": self.period,
                            "rsi": float(row["rsi"]),
                            "oversold": self.oversold,
                            "price": float(row["close"]),
                        },
                    }
                )
            # Sell signal: RSI crosses below overbought threshold
            elif row["rsi_prev"] >= self.overbought > row["rsi"]:
                signals.append(
                    {
                        "ts": row["ts"] if isinstance(row["ts"], datetime) else datetime.combine(row["ts"], datetime.min.time()),
                        "action": "SELL",
                        "confidence": 0.7,
                        "meta": {
                            "period": self.period,
                            "rsi": float(row["rsi"]),
                            "overbought": self.overbought,
                            "price": float(row["close"]),
                        },
                    }
                )

        return signals
