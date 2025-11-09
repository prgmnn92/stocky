"""Signal generation service."""
import json
import logging
from datetime import datetime
from typing import List
from sqlmodel import Session, select
from app.models import Strategy, Signal
from app.strategies import registry
from app.services.data_service import DataService

logger = logging.getLogger(__name__)


class SignalService:
    """Service for generating trading signals."""

    def __init__(self, session: Session, data_service: DataService) -> None:
        """Initialize signal service."""
        self.session = session
        self.data_service = data_service

    def get_enabled_strategies(self) -> List[Strategy]:
        """Get all enabled strategies from database."""
        stmt = select(Strategy).where(Strategy.enabled == True)
        return list(self.session.exec(stmt).all())

    def generate_signals_for_all(self) -> None:
        """Generate signals for all symbols and enabled strategies."""
        symbols = self.data_service.get_active_symbols()
        strategies = self.get_enabled_strategies()

        logger.info(
            f"Generating signals for {len(symbols)} symbols with {len(strategies)} strategies"
        )

        for symbol in symbols:
            # Get price data
            df = self.data_service.get_price_data(symbol)
            if df.empty:
                logger.warning(f"No price data for {symbol}, skipping")
                continue

            # Generate signals for each strategy
            for strat_model in strategies:
                try:
                    self._generate_signals_for_strategy(symbol, df, strat_model)
                except Exception as e:
                    logger.error(f"Failed to generate signals for {symbol}/{strat_model.key}: {e}")

    def _generate_signals_for_strategy(
        self, symbol: str, df: any, strat_model: Strategy
    ) -> None:
        """Generate signals for a symbol using a specific strategy."""
        # Parse strategy parameters
        params = json.loads(strat_model.params_json) if strat_model.params_json else {}

        # Create strategy instance
        strategy = registry.create_instance(strat_model.key, **params)

        # Generate signals
        context = {"symbol": symbol}
        signals = strategy.generate_signals(df, context)

        logger.info(f"Generated {len(signals)} signals for {symbol}/{strat_model.key}")

        # Save signals to database
        for sig in signals:
            self._save_signal(symbol, strat_model.key, sig)

    def _save_signal(self, symbol: str, strategy_key: str, signal_data: dict) -> None:
        """Save a signal to database (idempotent)."""
        # Check if signal already exists
        stmt = select(Signal).where(
            Signal.symbol == symbol,
            Signal.ts == signal_data["ts"],
            Signal.strategy_key == strategy_key,
        )
        existing = self.session.exec(stmt).first()

        if existing:
            # Update
            existing.action = signal_data["action"]
            existing.confidence = signal_data["confidence"]
            existing.meta_json = json.dumps(signal_data["meta"])
        else:
            # Insert
            signal = Signal(
                symbol=symbol,
                ts=signal_data["ts"],
                strategy_key=strategy_key,
                action=signal_data["action"],
                confidence=signal_data["confidence"],
                meta_json=json.dumps(signal_data["meta"]),
            )
            self.session.add(signal)

        self.session.commit()
