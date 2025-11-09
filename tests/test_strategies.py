"""Test trading strategies."""
from datetime import date, datetime, timedelta
import pandas as pd
import pytest
from app.strategies.sma_cross import SmaCross


@pytest.fixture
def sample_price_data() -> pd.DataFrame:
    """Create sample price data for testing."""
    dates = [date.today() - timedelta(days=i) for i in range(60, 0, -1)]
    data = {
        "ts": dates,
        "open": [100 + i * 0.5 for i in range(60)],
        "high": [102 + i * 0.5 for i in range(60)],
        "low": [98 + i * 0.5 for i in range(60)],
        "close": [100 + i * 0.5 for i in range(60)],  # Uptrend
        "volume": [1000000] * 60,
    }
    return pd.DataFrame(data)


def test_sma_cross_initialization() -> None:
    """Test SMA crossover strategy initialization."""
    strategy = SmaCross(fast=10, slow=50)
    assert strategy.key == "sma_cross"
    assert strategy.name == "SMA Fast/Slow Crossover"
    assert strategy.fast == 10
    assert strategy.slow == 50


def test_sma_cross_signals(sample_price_data: pd.DataFrame) -> None:
    """Test SMA crossover signal generation."""
    strategy = SmaCross(fast=10, slow=20)
    context = {"symbol": "TEST"}

    signals = strategy.generate_signals(sample_price_data, context)

    # Should generate signals on crossovers
    assert isinstance(signals, list)

    # Each signal should have required fields
    for signal in signals:
        assert "ts" in signal
        assert "action" in signal
        assert signal["action"] in ["BUY", "SELL"]
        assert "confidence" in signal
        assert 0 <= signal["confidence"] <= 1
        assert "meta" in signal


def test_sma_cross_insufficient_data() -> None:
    """Test strategy with insufficient data."""
    strategy = SmaCross(fast=10, slow=50)

    # Create very small dataset
    small_df = pd.DataFrame({
        "ts": [date.today()],
        "open": [100],
        "high": [102],
        "low": [98],
        "close": [101],
        "volume": [1000000],
    })

    signals = strategy.generate_signals(small_df, {"symbol": "TEST"})

    # Should return empty list when not enough data
    assert signals == []


def test_sma_cross_validate_dataframe() -> None:
    """Test dataframe validation."""
    strategy = SmaCross()

    # Missing required column
    invalid_df = pd.DataFrame({"ts": [date.today()], "close": [100]})

    with pytest.raises(ValueError, match="Missing required columns"):
        strategy.validate_dataframe(invalid_df)


def test_strategy_params() -> None:
    """Test strategy parameter handling."""
    strategy = SmaCross(fast=5, slow=20)
    params = strategy.get_params()

    assert params["fast"] == 5
    assert params["slow"] == 20
