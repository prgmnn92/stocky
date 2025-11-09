"""Backtesting service for running strategies on historical data."""
import logging
from datetime import datetime, date
from typing import Dict, Any, List
import pandas as pd
from sqlmodel import Session, select
from app.models import PriceBar, Strategy
from app.strategies import registry

logger = logging.getLogger(__name__)


class BacktestService:
    """Service for backtesting trading strategies on historical data."""

    def backtest_strategy(
        self,
        session: Session,
        strategy_id: int,
        symbol: str,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> Dict[str, Any]:
        """
        Run a strategy on historical data and return the signals that would have been generated.

        Args:
            session: Database session
            strategy_id: ID of the strategy to backtest
            symbol: Stock symbol to backtest on
            from_date: Start date for backtest (optional)
            to_date: End date for backtest (optional)

        Returns:
            Dictionary with backtest results including signals and performance metrics
        """
        # Get strategy
        strategy = session.get(Strategy, strategy_id)
        if not strategy:
            raise ValueError(f"Strategy with ID {strategy_id} not found")

        # Get historical price data
        stmt = select(PriceBar).where(PriceBar.symbol == symbol).order_by(PriceBar.ts)

        if from_date:
            stmt = stmt.where(PriceBar.ts >= from_date)
        if to_date:
            stmt = stmt.where(PriceBar.ts <= to_date)

        price_bars = session.exec(stmt).all()

        if not price_bars:
            return {
                "strategy_id": strategy_id,
                "strategy_name": strategy.name,
                "strategy_key": strategy.key,
                "symbol": symbol,
                "from_date": from_date.isoformat() if from_date else None,
                "to_date": to_date.isoformat() if to_date else None,
                "signals": [],
                "metrics": {
                    "total_signals": 0,
                    "buy_signals": 0,
                    "sell_signals": 0,
                },
                "error": "No price data available for the specified period",
            }

        # Convert to DataFrame
        df = pd.DataFrame([
            {
                "ts": bar.ts,
                "open": bar.open,
                "high": bar.high,
                "low": bar.low,
                "close": bar.close,
                "volume": bar.volume,
            }
            for bar in price_bars
        ])

        # Parse strategy parameters
        import json
        params = json.loads(strategy.params_json or "{}")

        # Create strategy instance
        try:
            strategy_instance = registry.create_instance(strategy.key, **params)
        except Exception as e:
            logger.error(f"Failed to create strategy instance: {e}")
            return {
                "strategy_id": strategy_id,
                "strategy_name": strategy.name,
                "strategy_key": strategy.key,
                "symbol": symbol,
                "from_date": from_date.isoformat() if from_date else None,
                "to_date": to_date.isoformat() if to_date else None,
                "signals": [],
                "metrics": {
                    "total_signals": 0,
                    "buy_signals": 0,
                    "sell_signals": 0,
                },
                "error": f"Failed to create strategy instance: {str(e)}",
            }

        # Generate signals
        try:
            signals = strategy_instance.generate_signals(df, {"symbol": symbol})
        except Exception as e:
            logger.error(f"Failed to generate signals: {e}")
            return {
                "strategy_id": strategy_id,
                "strategy_name": strategy.name,
                "strategy_key": strategy.key,
                "symbol": symbol,
                "from_date": from_date.isoformat() if from_date else None,
                "to_date": to_date.isoformat() if to_date else None,
                "signals": [],
                "metrics": {
                    "total_signals": 0,
                    "buy_signals": 0,
                    "sell_signals": 0,
                },
                "error": f"Failed to generate signals: {str(e)}",
            }

        # Convert signals to serializable format
        serialized_signals = []
        buy_count = 0
        sell_count = 0

        for signal in signals:
            action = signal["action"]
            if action == "BUY":
                buy_count += 1
            elif action == "SELL":
                sell_count += 1

            serialized_signals.append({
                "ts": signal["ts"].isoformat(),
                "action": action,
                "confidence": signal["confidence"],
                "meta": signal["meta"],
            })

        # Calculate simple performance metrics
        metrics = {
            "total_signals": len(signals),
            "buy_signals": buy_count,
            "sell_signals": sell_count,
        }

        return {
            "strategy_id": strategy_id,
            "strategy_name": strategy.name,
            "strategy_key": strategy.key,
            "symbol": symbol,
            "from_date": from_date.isoformat() if from_date else None,
            "to_date": to_date.isoformat() if to_date else None,
            "signals": serialized_signals,
            "metrics": metrics,
        }
