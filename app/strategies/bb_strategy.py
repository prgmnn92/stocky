"""Bollinger Bands Strategy."""
from datetime import datetime
from typing import Any, Dict, List
import pandas as pd
from app.strategies.base import BaseStrategy, SignalDict


class BollingerBandsStrategy(BaseStrategy):
    """Bollinger Bands mean reversion strategy."""

    key = "bb_strategy"
    name = "Bollinger Bands"
    default_params = {"period": 20, "std_dev": 2.0}

    def __init__(self, period: int = 20, std_dev: float = 2.0, **kwargs: Any) -> None:
        """
        Initialize Bollinger Bands strategy.

        Args:
            period: Moving average period (default: 20)
            std_dev: Number of standard deviations (default: 2.0)
        """
        super().__init__(period=period, std_dev=std_dev, **kwargs)
        self.period = period
        self.std_dev = std_dev

    def calculate_bollinger_bands(self, prices: pd.Series) -> tuple:
        """Calculate Bollinger Bands."""
        sma = prices.rolling(window=self.period).mean()
        std = prices.rolling(window=self.period).std()

        upper_band = sma + (std * self.std_dev)
        lower_band = sma - (std * self.std_dev)

        return sma, upper_band, lower_band

    def generate_signals(self, df: pd.DataFrame, context: Dict[str, Any]) -> List[SignalDict]:
        """Generate signals based on Bollinger Bands."""
        self.validate_dataframe(df)

        if len(df) < self.period:
            return []

        d = df.copy()
        d["sma"], d["upper_band"], d["lower_band"] = self.calculate_bollinger_bands(d["close"])

        # Track previous positions relative to bands
        d["price_prev"] = d["close"].shift(1)

        signals: List[SignalDict] = []

        for _, row in d.dropna().iterrows():
            # Buy signal: Price touches or crosses below lower band
            if row["price_prev"] > row["lower_band"] and row["close"] <= row["lower_band"]:
                band_width = (row["upper_band"] - row["lower_band"]) / row["sma"]
                signals.append(
                    {
                        "ts": row["ts"] if isinstance(row["ts"], datetime) else datetime.combine(row["ts"], datetime.min.time()),
                        "action": "BUY",
                        "confidence": 0.65,
                        "meta": {
                            "period": self.period,
                            "std_dev": self.std_dev,
                            "price": float(row["close"]),
                            "sma": float(row["sma"]),
                            "lower_band": float(row["lower_band"]),
                            "band_width": float(band_width),
                        },
                    }
                )
            # Sell signal: Price touches or crosses above upper band
            elif row["price_prev"] < row["upper_band"] and row["close"] >= row["upper_band"]:
                band_width = (row["upper_band"] - row["lower_band"]) / row["sma"]
                signals.append(
                    {
                        "ts": row["ts"] if isinstance(row["ts"], datetime) else datetime.combine(row["ts"], datetime.min.time()),
                        "action": "SELL",
                        "confidence": 0.65,
                        "meta": {
                            "period": self.period,
                            "std_dev": self.std_dev,
                            "price": float(row["close"]),
                            "sma": float(row["sma"]),
                            "upper_band": float(row["upper_band"]),
                            "band_width": float(band_width),
                        },
                    }
                )

        return signals
