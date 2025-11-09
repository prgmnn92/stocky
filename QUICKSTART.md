# Stocky - Quick Start Guide

Get your swing trading signal generator running in 5 minutes.

## Prerequisites

- Python 3.11+
- Poetry (or Docker)

## Option 1: Local Development (Fast)

### 1. Install Dependencies

```bash
poetry install
```

### 2. Set Up Environment

```bash
cp .env.example .env
```

The defaults work fine for local development.

### 3. Initialize Database

```bash
poetry run python scripts/init_db.py
```

This creates:
- SQLite database at `data/trader.db`
- 5 sample symbols (AAPL, MSFT, GOOGL, AMZN, TSLA)
- SMA crossover strategy (10/50 periods)

### 4. Start the Server

```bash
make dev
# or
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Ingest Data and Generate Signals

Open another terminal and trigger the daily job:

```bash
curl -X POST http://localhost:8000/run/daily
```

This will:
1. Fetch ~400 days of price history for all symbols
2. Calculate SMA crossovers
3. Generate BUY/SELL signals

**Note**: First run takes 1-2 minutes to download historical data.

### 6. View Results

**API Documentation**:
```
http://localhost:8000/docs
```

**Get all signals**:
```bash
curl http://localhost:8000/signals | jq
```

**Get signals for AAPL**:
```bash
curl "http://localhost:8000/signals?symbol=AAPL&limit=10" | jq
```

**View price data**:
```bash
curl "http://localhost:8000/prices/AAPL?from_date=2024-01-01" | jq
```

## Option 2: Docker (Production-Ready)

### 1. Create Environment File

```bash
cp .env.example .env
```

### 2. Build and Start

```bash
docker-compose up -d
```

### 3. Initialize Database

```bash
docker-compose exec app python scripts/init_db.py
```

### 4. Trigger Daily Job

```bash
curl -X POST http://localhost:8000/run/daily
```

### 5. View Logs

```bash
docker-compose logs -f
```

## Understanding the Output

### Signal Format

```json
{
  "id": 1,
  "symbol": "AAPL",
  "ts": "2024-01-15T00:00:00",
  "strategy_key": "sma_cross",
  "action": "BUY",
  "confidence": 0.6,
  "meta_json": "{\"fast\": 10, \"slow\": 50, \"price\": 185.50}"
}
```

**Fields**:
- `action`: BUY or SELL
- `confidence`: 0.0-1.0 signal strength
- `ts`: When the signal was generated
- `meta_json`: Strategy-specific metadata (entry price, indicator values, etc.)

### Strategy: SMA Crossover

**BUY Signal**: Fast SMA crosses above Slow SMA (bullish)
**SELL Signal**: Fast SMA crosses below Slow SMA (bearish)

Default params: Fast=10 days, Slow=50 days

## Customization

### Add More Symbols

```bash
curl -X POST http://localhost:8000/symbols \
  -H "Content-Type: application/json" \
  -d '{"symbol": "NVDA", "name": "NVIDIA Corporation"}'
```

### Modify Strategy Parameters

```bash
curl -X PATCH http://localhost:8000/strategies/sma_cross \
  -H "Content-Type: application/json" \
  -d '{"params_json": "{\"fast\": 5, \"slow\": 20}"}'
```

### Disable a Strategy

```bash
curl -X PATCH http://localhost:8000/strategies/sma_cross \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

## Automated Daily Runs

The scheduler runs automatically at 20:00 Europe/Berlin time.

To change the schedule, edit `.env`:

```bash
SCHED_HOUR=16        # 4 PM
SCHED_MINUTE=30      # :30
SCHED_TIMEZONE=US/Eastern
```

Restart the app to apply changes.

## Troubleshooting

### "No price data available"

First run fetches 400 days of history. Wait 1-2 minutes for Yahoo Finance to respond.

### "Strategy not found"

Strategies must be registered in `app/strategies/__init__.py`. Check the registry.

### "Database locked" (SQLite)

SQLite doesn't handle high concurrency. If you scale beyond MVP, migrate to Postgres.

### Docker: "Address already in use"

Port 8000 is taken. Change it in `docker-compose.yml`:

```yaml
ports:
  - "8001:8000"  # Map host 8001 to container 8000
```

## Next Steps

1. **Create Custom Strategy**: See README.md section "Strategy System"
2. **Add Position Tracking**: Implement paper trading rules in `app/services/position_service.py`
3. **Set Up Alerts**: Integrate email/Discord webhooks
4. **Backtest**: Add Backtrader/Vectorbt for historical validation

## Getting Help

- **API Docs**: http://localhost:8000/docs
- **Full README**: [README.md](README.md)
- **Sample Tests**: `tests/` directory

## Production Deployment

For production use:

1. Set `APP_ENV=prod` in `.env`
2. Use stronger database (PostgreSQL)
3. Add monitoring (logs, health checks, alerts)
4. Back up `data/trader.db` regularly
5. Review and test all strategies before real trading

---

**Disclaimer**: This is for educational purposes. Not financial advice. Trade at your own risk.
