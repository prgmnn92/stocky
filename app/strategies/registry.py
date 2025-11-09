"""Strategy registry."""
import logging
from typing import Dict, Type
from app.strategies.base import BaseStrategy

logger = logging.getLogger(__name__)


class StrategyRegistry:
    """Registry for trading strategies."""

    def __init__(self) -> None:
        """Initialize empty registry."""
        self._strategies: Dict[str, Type[BaseStrategy]] = {}

    def register(self, strategy_class: Type[BaseStrategy]) -> None:
        """Register a strategy class."""
        if not strategy_class.key:
            raise ValueError(f"Strategy {strategy_class.__name__} must have a 'key' attribute")

        self._strategies[strategy_class.key] = strategy_class
        logger.info(f"Registered strategy: {strategy_class.key}")

    def get(self, key: str) -> Type[BaseStrategy]:
        """Get strategy class by key."""
        if key not in self._strategies:
            raise KeyError(f"Strategy '{key}' not found in registry")
        return self._strategies[key]

    def list_keys(self) -> list[str]:
        """List all registered strategy keys."""
        return list(self._strategies.keys())

    def list_available(self) -> list[dict]:
        """List all available strategies with metadata."""
        strategies = []
        for key, strategy_class in self._strategies.items():
            strategies.append({
                "key": strategy_class.key,
                "name": strategy_class.name,
                "default_params": strategy_class.default_params,
            })
        return strategies

    def create_instance(self, key: str, **params: any) -> BaseStrategy:
        """Create strategy instance with parameters."""
        strategy_class = self.get(key)
        return strategy_class(**params)
