# Stocky - Swing Trading Signal Generator

MVP-focused swing trading system that provides daily analysis and signal generation based on configurable strategies.

## Features

- **Daily Price Ingestion**: Automatically fetch EOD (end-of-day) price data from Yahoo Finance
- **Strategy System**: Pluggable strategy architecture with built-in SMA crossover
- **Signal Generation**: Automated BUY/SELL signal generation for all active symbols
- **REST API**: Complete API for managing symbols, strategies, and viewing signals
- **Scheduler**: Configurable daily job execution via APScheduler
- **SQLite Database**: Simple, file-based persistence (upgrade path to Postgres)
- **Docker**: Single-container deployment with health checks

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     FastAPI App                         │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │ API Routes   │  │ Scheduler   │  │ Daily Job    │  │
│  └──────────────┘  └─────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
      ┌─────────────────────┼─────────────────────┐
      ↓                     ↓                     ↓
┌──────────┐         ┌──────────┐         ┌──────────┐
│ Data     │         │ Signal   │         │ Strategy │
│ Service  │         │ Service  │         │ Registry │
└──────────┘         └──────────┘         └──────────┘
      │                     │                     │
      ↓                     ↓                     ↓
┌──────────┐         ┌──────────┐         ┌──────────┐
│ Provider │         │ Database │         │ Plugins  │
│ (Yahoo)  │         │ (SQLite) │         │ (SMA etc)│
└──────────┘         └──────────┘         └──────────┘
```

## Quick Start

### Local Development

1. **Install dependencies**:
```bash
poetry install
```

2. **Set up environment**:
```bash
cp .env.example .env
# Edit .env with your settings
```

3. **Run development server**:
```bash
make dev
# or
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

4. **Access API documentation**:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Docker Deployment

1. **Build and start**:
```bash
docker-compose up -d
```

2. **Check logs**:
```bash
docker-compose logs -f
```

3. **Stop**:
```bash
docker-compose down
```

## Usage

### 1. Add Symbols

```bash
curl -X POST http://localhost:8000/symbols \
  -H "Content-Type: application/json" \
  -d '{"symbol": "AAPL", "name": "Apple Inc."}'
```

### 2. Create a Strategy

```bash
curl -X POST http://localhost:8000/strategies \
  -H "Content-Type: application/json" \
  -d '{
    "key": "sma_cross",
    "name": "SMA Fast/Slow Crossover",
    "params_json": "{\"fast\": 10, \"slow\": 50}",
    "enabled": true
  }'
```

### 3. Trigger Daily Job (Manual)

```bash
curl -X POST http://localhost:8000/run/daily
```

This will:
1. Fetch latest price data for all active symbols
2. Generate signals using all enabled strategies
3. Store results in database

### 4. View Signals

```bash
# All signals
curl http://localhost:8000/signals

# Signals for specific symbol
curl http://localhost:8000/signals?symbol=AAPL&limit=10

# Signals for specific strategy
curl http://localhost:8000/signals?strategy_key=sma_cross
```

### 5. View Price Data

```bash
curl http://localhost:8000/prices/AAPL?from_date=2024-01-01
```

## API Endpoints

### Read Operations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/symbols` | GET | List active symbols |
| `/signals` | GET | List signals (filters: symbol, strategy_key, limit) |
| `/positions` | GET | List positions (filter: status) |
| `/strategies` | GET | List all strategies |
| `/prices/{symbol}` | GET | Get price data (filters: from_date, to_date) |

### Write Operations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/symbols` | POST | Add new symbol |
| `/symbols/{symbol}` | DELETE | Deactivate symbol |
| `/strategies` | POST | Create strategy |
| `/strategies/{key}` | PATCH | Update strategy (enable/disable, params) |
| `/run/daily` | POST | Manually trigger daily job |

## Configuration

Environment variables (see `.env.example`):

```bash
# Application
APP_ENV=prod                    # dev or prod
TZ=Europe/Berlin                # Timezone

# Database
DATABASE_URL=sqlite:///data/trader.db

# Market Data Provider
DATA_PROVIDER=yahoo             # Currently only yahoo supported
LOOKBACK_DAYS=400               # Days of historical data to fetch

# Scheduler
SCHED_HOUR=20                   # Daily job hour (24h format)
SCHED_MINUTE=0                  # Daily job minute
SCHED_TIMEZONE=Europe/Berlin    # Scheduler timezone

# Logging
LOG_LEVEL=INFO                  # DEBUG, INFO, WARNING, ERROR
```

## Database Schema

### Core Tables

- **symbols**: Trading symbols (ticker, name, active status)
- **price_bars**: OHLCV data (symbol, date, prices, volume)
- **strategies**: Strategy configurations (key, name, params, enabled)
- **signals**: Generated signals (symbol, timestamp, action, confidence)
- **positions**: Paper trading positions (optional, for tracking)
- **executions**: Trade executions (optional, for paper trading)
- **task_runs**: Job execution tracking (task, status, timestamps, errors)

### Optional Tables (Future)

- **news_cache**: Cached news articles
- **sentiment**: Sentiment analysis results

## Strategy System

### Creating a Custom Strategy

```python
# app/strategies/my_strategy.py
from typing import Dict, List, Any
import pandas as pd
from app.strategies.base import BaseStrategy, SignalDict

class MyStrategy(BaseStrategy):
    key = "my_strategy"
    name = "My Custom Strategy"

    def __init__(self, param1: int = 10, **kwargs: Any) -> None:
        super().__init__(param1=param1, **kwargs)
        self.param1 = param1

    def generate_signals(
        self, df: pd.DataFrame, context: Dict[str, Any]
    ) -> List[SignalDict]:
        self.validate_dataframe(df)

        signals = []
        # Your strategy logic here
        # df has columns: ['ts', 'open', 'high', 'low', 'close', 'volume']

        # Example: Generate a BUY signal
        signals.append({
            "ts": df.iloc[-1]["ts"],
            "action": "BUY",
            "confidence": 0.75,
            "meta": {"param1": self.param1, "price": float(df.iloc[-1]["close"])}
        })

        return signals
```

### Registering Your Strategy

```python
# app/strategies/__init__.py
from app.strategies.my_strategy import MyStrategy

registry = StrategyRegistry()
registry.register(SmaCross)
registry.register(MyStrategy)  # Add this line
```

## Development

### Run Tests

```bash
make test
# or
poetry run pytest tests/ -v --cov=app
```

### Code Quality

```bash
# Format code
make format

# Lint
make lint

# Type checking
poetry run mypy app/
```

### Project Structure

```
stocky/
├── app/
│   ├── api/               # API routes and endpoints
│   ├── models/            # SQLModel database models
│   ├── providers/         # Market data provider adapters
│   ├── services/          # Business logic services
│   ├── strategies/        # Trading strategy plugins
│   ├── config.py          # Application configuration
│   ├── database.py        # Database connection
│   ├── jobs.py            # Background job orchestration
│   └── main.py            # FastAPI app entry point
├── data/                  # SQLite database (mounted volume)
├── tests/                 # Test suite
├── docker-compose.yml     # Docker Compose configuration
├── Dockerfile             # Container build instructions
├── Makefile               # Development shortcuts
├── pyproject.toml         # Poetry dependencies
└── README.md              # This file
```

## Deployment

### Single Container

The provided Docker setup runs as a single container with:
- FastAPI app on port 8000
- APScheduler for daily job execution
- SQLite database in mounted volume `/app/data`

### Data Persistence

Database file: `./data/trader.db`

**Backup Strategy**:
```bash
# Simple file copy
cp data/trader.db data/backup_$(date +%Y%m%d).db

# Or use SQLite backup command
sqlite3 data/trader.db ".backup data/backup.db"
```

### Health Monitoring

Health check endpoint: `GET /health`

Docker health check runs every 30 seconds.

### Logs

```bash
# Docker logs
docker-compose logs -f

# Application logs (JSON format)
docker-compose exec app cat /app/logs/app.log
```

## Roadmap (Post-MVP)

### Phase 2 - Enhanced Features
- [ ] Multiple data providers (Alpha Vantage, Polygon, Tiingo)
- [ ] Paper trading position tracking with automatic execution
- [ ] News cache and sentiment analysis integration
- [ ] Alert system (Email, Discord, Telegram)
- [ ] More strategy examples (RSI, MACD, Bollinger Bands)

### Phase 3 - Advanced
- [ ] Backtesting framework (Backtrader/Vectorbt)
- [ ] Walk-forward analysis
- [ ] Multi-timeframe strategies
- [ ] Risk management (ATR stops, position sizing)
- [ ] Web UI (Next.js admin panel)

### Phase 4 - Production
- [ ] PostgreSQL migration
- [ ] Celery for distributed task processing
- [ ] Redis caching layer
- [ ] Grafana dashboards
- [ ] Kubernetes deployment

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/yourusername/stocky/issues)
- Documentation: [API Docs](http://localhost:8000/docs)

---

**Disclaimer**: This software is for educational purposes only. Not financial advice. Trade at your own risk.
# stocky
