"""Trading strategies."""
from app.strategies.base import BaseStrategy, SignalDict
from app.strategies.sma_cross import SmaCross
from app.strategies.rsi_strategy import RsiStrategy
from app.strategies.macd_strategy import MacdStrategy
from app.strategies.bb_strategy import BollingerBandsStrategy
from app.strategies.ema_cross import EmaCross
from app.strategies.breakout_strategy import BreakoutStrategy
from app.strategies.registry import StrategyRegistry

# Initialize registry and register strategies
registry = StrategyRegistry()
registry.register(SmaCross)
registry.register(RsiStrategy)
registry.register(MacdStrategy)
registry.register(BollingerBandsStrategy)
registry.register(EmaCross)
registry.register(BreakoutStrategy)

__all__ = [
    "BaseStrategy",
    "SignalDict",
    "SmaCross",
    "RsiStrategy",
    "MacdStrategy",
    "BollingerBandsStrategy",
    "EmaCross",
    "BreakoutStrategy",
    "registry",
]
