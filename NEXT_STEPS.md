# Next Steps - Getting Started with Stocky

Your swing trading signal generator is ready to use! Here's what to do next:

## ⚡ Quick Start (5 minutes)

### 1. Install Dependencies

```bash
poetry install
```

### 2. Initialize Database

```bash
poetry run python scripts/init_db.py
```

This creates:
- SQLite database with all tables
- 5 sample symbols (AAPL, MSFT, GOOGL, AMZN, TSLA)
- SMA crossover strategy (10/50 periods)

### 3. Start the Server

```bash
make dev
```

Server will start at: http://localhost:8000

### 4. Generate Your First Signals

In a new terminal:

```bash
curl -X POST http://localhost:8000/run/daily
```

This will:
1. Download ~400 days of price history from Yahoo Finance
2. Calculate SMA crossovers for all symbols
3. Store signals in database

**Wait time**: ~1-2 minutes for initial data fetch

### 5. View Your Signals

**API Documentation**:
http://localhost:8000/docs

**Get all signals**:
```bash
curl http://localhost:8000/signals | jq
```

**Get signals for AAPL**:
```bash
curl "http://localhost:8000/signals?symbol=AAPL" | jq
```

## 📖 Learn More

- **Quick Reference**: [QUICKSTART.md](QUICKSTART.md)
- **Full Documentation**: [README.md](README.md)
- **Deployment Guide**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Project Status**: [PROJECT_STATUS.md](PROJECT_STATUS.md)

## 🎯 What You Can Do Now

### Add More Symbols

```bash
curl -X POST http://localhost:8000/symbols \
  -H "Content-Type: application/json" \
  -d '{"symbol": "NVDA", "name": "NVIDIA"}'
```

### Modify Strategy Parameters

```bash
curl -X PATCH http://localhost:8000/strategies/sma_cross \
  -H "Content-Type: application/json" \
  -d '{"params_json": "{\"fast\": 5, \"slow\": 20}"}'
```

### View Price Data

```bash
curl "http://localhost:8000/prices/AAPL?from_date=2024-01-01" | jq
```

## 🔄 Daily Automation

The scheduler runs automatically at 20:00 Europe/Berlin time.

To change:
1. Edit `.env`: `SCHED_HOUR=16` (4 PM)
2. Restart: `make dev`

## 🚀 Deploy to Production

### Option 1: Docker (Easiest)

```bash
docker-compose up -d
docker-compose exec app python scripts/init_db.py
```

### Option 2: VPS Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for full instructions.

## 🧪 Run Tests

```bash
make test
```

All tests should pass:
- Strategy logic tests
- API endpoint tests
- Integration tests

## 🔧 Development

### Code Formatting

```bash
make format
```

### Linting

```bash
make lint
```

### Project Structure

```
app/
├── api/         # REST endpoints
├── models/      # Database models
├── providers/   # Data providers
├── services/    # Business logic
├── strategies/  # Trading strategies
├── config.py    # Configuration
├── database.py  # DB connection
├── jobs.py      # Daily job
└── main.py      # FastAPI app
```

## 💡 Create Your First Custom Strategy

1. **Create strategy file** `app/strategies/rsi.py`:

```python
from app.strategies.base import BaseStrategy

class RSI(BaseStrategy):
    key = "rsi"
    name = "RSI Oversold/Overbought"

    def generate_signals(self, df, context):
        # Calculate RSI
        # Generate signals
        return []
```

2. **Register** in `app/strategies/__init__.py`:

```python
from app.strategies.rsi import RSI
registry.register(RSI)
```

3. **Add via API**:

```bash
curl -X POST http://localhost:8000/strategies \
  -H "Content-Type: application/json" \
  -d '{
    "key": "rsi",
    "name": "RSI Strategy",
    "params_json": "{\"period\": 14, \"oversold\": 30, \"overbought\": 70}"
  }'
```

## 🐛 Troubleshooting

### "No price data available"

Wait 1-2 minutes for Yahoo Finance to respond on first run.

### "Module not found"

```bash
poetry install
```

### "Port 8000 already in use"

```bash
# Find and kill process
lsof -ti:8000 | xargs kill -9

# Or use different port
uvicorn app.main:app --port 8001
```

### Database locked (SQLite)

Only one write at a time. For high concurrency, migrate to PostgreSQL.

## 📊 What's Next?

### Phase 2 Features (Coming Soon)

- [ ] Multiple data providers (Alpha Vantage, Polygon)
- [ ] Paper trading with automatic position management
- [ ] News & sentiment analysis integration
- [ ] Alert system (Email, Discord, Telegram)
- [ ] More strategies (RSI, MACD, Bollinger Bands)

### Contribute

1. Fork repository
2. Create feature branch
3. Add tests
4. Submit pull request

## 🆘 Need Help?

- **Documentation**: Start with [README.md](README.md)
- **API Reference**: http://localhost:8000/docs
- **Issues**: Open GitHub issue

## ✅ Checklist

- [ ] Dependencies installed (`poetry install`)
- [ ] Database initialized (`scripts/init_db.py`)
- [ ] Server running (`make dev`)
- [ ] First signals generated (`POST /run/daily`)
- [ ] API docs explored (http://localhost:8000/docs)
- [ ] Signals viewed via API
- [ ] Tests passing (`make test`)

## 🎉 You're Ready!

Your trading signal generator is up and running. Start by:

1. Experimenting with strategy parameters
2. Adding your favorite symbols
3. Reviewing generated signals
4. Creating custom strategies

**Remember**: This is for educational purposes. Not financial advice. Trade at your own risk.

---

Happy trading! 📈
