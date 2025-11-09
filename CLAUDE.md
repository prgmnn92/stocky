# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stocky is a full-stack swing trading signal generator with a FastAPI backend and React frontend. The system fetches daily price data from Yahoo Finance, runs configurable trading strategies, generates buy/sell signals, and provides backtesting capabilities. It includes user authentication with role-based access control (ADMIN, MANAGER, USER, TEST_USER).

## Development Commands

### Backend (Python/FastAPI)
```bash
# Development server (with auto-reload)
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# or
make dev

# Run tests with coverage
poetry run pytest tests/ -v --cov=app
# or
make test

# Run a single test file
poetry run pytest tests/test_strategies.py -v

# Run a specific test function
poetry run pytest tests/test_api.py::test_health -v

# Code formatting and linting
poetry run black app/
poetry run ruff check --fix app/
# or
make format

# Type checking
poetry run mypy app/
```

### Frontend (React/TypeScript/Vite)
```bash
# Development server (in frontend/ directory)
cd frontend && npm run dev

# Build for production
cd frontend && npm run build

# Lint TypeScript/React
cd frontend && npm run lint
```

### Docker
```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## Architecture Overview

### Backend Architecture

**FastAPI Application** (`app/main.py`):
- Lifespan management: Database initialization and APScheduler setup
- CORS middleware configured for development (allow all) and production (restricted)
- Scheduled daily job runs at configured time (default: 20:00 Europe/Berlin)
- Authentication via JWT tokens with bcrypt password hashing

**Database** (`app/database.py`):
- SQLite with WAL mode enabled for better concurrency
- Connection pooling (pool_size=5, max_overflow=10)
- 30-second timeout for lock waits to prevent database locking issues
- Session management with dependency injection pattern

**Key Service Layers**:
1. **DataService** (`app/services/data_service.py`): Fetches price data from Yahoo Finance, stores in `price_bars` table
2. **SignalService** (`app/services/signal_service.py`): Orchestrates strategy execution and stores signals with retry logic for database locks
3. **BacktestService** (`app/services/backtest_service.py`): Runs strategies on historical data and returns signals without storing them
4. **SentimentService** (`app/services/sentiment_service.py`): OpenAI-based sentiment analysis for symbols

**Strategy System** (`app/strategies/`):
- **Base Class** (`base.py`): `BaseStrategy` with abstract `generate_signals()` method
- **Registry** (`registry.py`): `StrategyRegistry` for dynamic strategy registration and instantiation
- **Built-in Strategies**: `sma_cross`, `ema_cross`, `rsi_strategy`, `macd_strategy`, `bb_strategy`, `breakout_strategy`
- Each strategy has `key`, `name`, `default_params` class variables
- Strategies return `List[SignalDict]` with `ts`, `action` (BUY/SELL), `confidence`, and `meta` fields

**Authentication** (`app/api/auth.py`):
- JWT tokens with HS256 algorithm
- Role-based permissions: `can_run_daily_job()`, `can_manage_users()`, `is_admin()`
- Dependency injection pattern: `get_current_user()`, `require_admin()`, `require_manager_or_admin()`

### Frontend Architecture

**Tech Stack**: React 18 + TypeScript + Vite + Chakra UI + React Query + Recharts

**State Management**:
- **React Query** (`@tanstack/react-query`): Server state caching and synchronization
- **AuthContext** (`src/contexts/AuthContext.tsx`): Global authentication state with JWT token storage
- **Custom Hooks** (`src/hooks/useApiQueries.ts`): Reusable query hooks for all API endpoints

**Key Components**:
- **Layout** (`src/components/Layout.tsx`): Navigation sidebar with role-based menu items
- **BacktestChart** (`src/components/BacktestChart.tsx`): Recharts ComposedChart with price line + scatter plots for BUY/SELL signals

**Pages** (`src/pages/`):
- **Login**: User authentication form with JWT token handling
- **Signup**: New user registration form
- **Dashboard**: Overview with stats, recent signals, open positions
- **Symbols**: Symbol management with sentiment analysis integration
- **SymbolDetail**: Price charts with date range filtering
- **Strategies**: Strategy CRUD with default parameters auto-population and backtesting UI
- **Signals**: Signal list with filtering by symbol/strategy
- **Positions**: Position tracking with open/closed tabs
- **Users**: Admin-only user management with role and balance updates
- **Chat**: Chat interface for user interactions

**API Integration** (`src/services/api.ts`):
- Axios instance with `/api` base URL
- All backend endpoints wrapped in typed functions
- Authentication token automatically included via interceptors (set in AuthContext)

**Import Aliases** (`vite.config.ts`):
- `@/` alias maps to `src/` directory for cleaner imports
- Example: `import { Button } from '@/components/Button'`

### Data Flow

1. **Daily Job** (`app/jobs.py`):
   - Triggered by APScheduler at configured time
   - Fetches price data for all active symbols → `DataService.fetch_and_store()`
   - For each enabled strategy, generates signals → `SignalService.generate_signals_for_strategy()`
   - Stores results in `task_runs` table for audit trail

2. **Strategy Execution**:
   - `StrategyRegistry.create_instance(key, **params)` instantiates strategy
   - Strategy receives DataFrame with columns: `['ts', 'open', 'high', 'low', 'close', 'volume']`
   - Returns signals with timestamp, action, confidence, and metadata
   - Signals stored in `signals` table linked to strategy and symbol

3. **Backtesting Flow**:
   - Frontend: User selects strategy + symbol + date range
   - Backend: `BacktestService.backtest_strategy()` fetches historical prices
   - Strategy generates signals on historical data without storing
   - Frontend: Displays signals on interactive chart with BUY (green triangle up) / SELL (red triangle down) markers

## Database Schema

**Core Tables**:
- `users`: Authentication, roles (ADMIN/MANAGER/USER/TEST_USER), balance for paper trading
- `symbols`: Trading symbols (ticker, name, active flag, last_price, sentiment)
- `price_bars`: OHLCV data (symbol, ts, open, high, low, close, volume)
- `strategies`: User's strategy configurations (key, name, params_json, enabled, user_id)
- `signals`: Generated trading signals (symbol, ts, strategy_key, action, confidence, meta_json, user_id)
- `positions`: Paper trading positions (symbol, qty, avg_price, status, pnl, user_id)
- `executions`: Trade executions linked to positions
- `sentiment_analyses`: AI-generated sentiment data (symbol, score, classification, reasoning, key_factors)
- `task_runs`: Job execution audit trail

**Important Relationships**:
- Strategies, signals, and positions are scoped per user
- Symbols and price_bars are shared across all users
- Sentiment analyses are linked to symbols

## Adding a New Strategy

1. **Create strategy file** in `app/strategies/`:
```python
from app.strategies.base import BaseStrategy, SignalDict

class MyStrategy(BaseStrategy):
    key = "my_strategy"
    name = "My Strategy Name"
    default_params = {"param1": 10, "param2": 20}  # Must include default_params

    def __init__(self, param1: int = 10, param2: int = 20, **kwargs):
        super().__init__(param1=param1, param2=param2, **kwargs)
        self.param1 = param1
        self.param2 = param2

    def generate_signals(self, df: pd.DataFrame, context: dict) -> List[SignalDict]:
        self.validate_dataframe(df)  # Validates required columns
        signals = []
        # Your strategy logic here using df['close'], df['volume'], etc.
        return signals
```

2. **Register in** `app/strategies/__init__.py`:
```python
from app.strategies.my_strategy import MyStrategy

registry.register(MyStrategy)
```

3. **Frontend will automatically**:
   - Show new strategy in dropdown when creating strategies
   - Auto-populate default parameters when selected
   - Enable backtesting for the new strategy

## SQLite Concurrency Handling

The application uses SQLite in WAL (Write-Ahead Logging) mode with specific optimizations:
- **WAL mode**: Allows concurrent reads while writing
- **Connection pooling**: Prevents connection exhaustion
- **Retry logic**: `SentimentService` has exponential backoff for database lock retries
- **30-second timeout**: Prevents indefinite waits on locks

**If you encounter database lock errors**:
1. Ensure WAL mode is enabled (check `app/database.py`)
2. Add retry logic with exponential backoff for write operations
3. Use session management properly with context managers

## Environment Variables

**Backend** (`.env`):
```bash
# Application
APP_ENV=dev|prod                  # Affects CORS, logging, echo (default: dev)
TZ=Europe/Berlin                  # System timezone

# Database
DATABASE_URL=sqlite:///data/trader.db  # SQLite database file location

# Market Data Provider
DATA_PROVIDER=yahoo               # Currently only yahoo supported
LOOKBACK_DAYS=400                 # Historical data fetch period (optional, default: 400)

# Scheduler
SCHED_HOUR=20                     # Daily job hour (24h format)
SCHED_MINUTE=0                    # Daily job minute
SCHED_TIMEZONE=Europe/Berlin      # Scheduler timezone

# Logging
LOG_LEVEL=INFO                    # DEBUG, INFO, WARNING, ERROR
LOG_FORMAT=json                   # Log output format

# Authentication (Optional - required for user features)
JWT_SECRET_KEY=<generate-secure-key>  # Secret key for JWT token signing

# AI Features (Optional - required for sentiment analysis)
OPENAI_API_KEY=<your-key>         # OpenAI API key for sentiment analysis
```

**Frontend** (`frontend/.env`):
```bash
VITE_API_URL=/api                 # Proxied to backend via vite.config.ts
```

## Frontend-Backend Integration

**Development setup**:
- Backend runs on port 8000
- Frontend runs on port 3000 (or 3001 if 3000 is taken)
- Vite proxy configuration (`frontend/vite.config.ts`) forwards `/api/*` to `http://localhost:8000`
  - Proxy rewrites paths by stripping `/api` prefix before forwarding
  - Example: Frontend request to `/api/symbols` → Backend receives request at `/symbols`
- API base URL is `/api` in development, allowing hot reload without CORS issues

**Authentication flow**:
1. Login/Signup → JWT token returned in response
2. Token stored in localStorage via AuthContext
3. Axios interceptor adds `Authorization: Bearer <token>` to all requests
4. Backend validates token and injects `current_user` via dependency injection

## Testing Strategy

**Backend tests** (`tests/`):
- Unit tests for services with mocked dependencies
- Strategy tests with sample DataFrames
- API integration tests with test client
- Use `conftest.py` for shared fixtures

**Test Organization**:
- `test_api.py`: API endpoint integration tests
- `test_strategies.py`: Strategy generation logic tests
- `test_positions.py`: Position management tests

**No frontend tests currently** - add with Vitest when needed

## Development Patterns

### Database Session Management
Always use dependency injection for database sessions:
```python
from app.database import get_session
from sqlmodel import Session

def my_function(session: Session = Depends(get_session)):
    # Use session here
    pass
```

### Strategy Development Workflow
1. Create strategy class inheriting from `BaseStrategy`
2. Implement `generate_signals()` method
3. Add `default_params` class variable (required for frontend)
4. Register in `app/strategies/__init__.py`
5. Test with sample DataFrame before deployment

### Frontend API Calls
Use React Query hooks from `useApiQueries.ts`:
```typescript
const { data: symbols } = useSymbols();
const { data: signals } = useSignals({ symbol: 'AAPL' });
```

### Debugging Tips
- **Backend**: Check logs with `docker-compose logs -f` or console output in dev mode
- **Database**: Query SQLite directly: `sqlite3 data/trader.db "SELECT * FROM symbols;"`
- **API**: Use Swagger UI at http://localhost:8000/docs for interactive testing
- **Frontend**: Check network tab for API calls, verify proxy is working
- **Scheduler**: Check if daily job is scheduled: logs show "Scheduler started: daily job at..."
- **Vite Proxy**: Console shows `[PROXY]` logs for each forwarded request during development

## Common Pitfalls

1. **Database locks**: Always use WAL mode for SQLite, add retry logic for writes
2. **Strategy registration**: Must call `registry.register()` in `__init__.py` or strategy won't be available
3. **Default params**: New strategies MUST include `default_params` class variable for frontend integration
4. **User scoping**: Strategies, signals, and positions are per-user - always filter by `user_id`
5. **Date handling**: Backend uses Python `date` objects, frontend uses ISO strings - conversion happens in API layer
6. **TypeScript types**: Keep `frontend/src/types/api.ts` in sync with backend Pydantic models

## Project Structure

```
stocky/
├── app/
│   ├── api/                  # API routes and endpoints
│   │   ├── auth.py          # Authentication routes and dependencies
│   │   └── routes.py        # Main API routes (symbols, strategies, signals, etc.)
│   ├── models/              # SQLModel database models
│   │   ├── user.py          # User model with roles and permissions
│   │   ├── symbol.py        # Symbol and UserSymbol models
│   │   ├── strategy.py      # Strategy configuration model
│   │   ├── signal.py        # Trading signal model
│   │   ├── position.py      # Position tracking model
│   │   └── ...              # Other models
│   ├── providers/           # Market data provider adapters
│   │   └── yahoo.py         # Yahoo Finance integration
│   ├── services/            # Business logic services
│   │   ├── data_service.py  # Price data fetching and storage
│   │   ├── signal_service.py # Signal generation orchestration
│   │   ├── backtest_service.py # Backtesting logic
│   │   └── sentiment_service.py # AI sentiment analysis
│   ├── strategies/          # Trading strategy plugins
│   │   ├── base.py          # BaseStrategy abstract class
│   │   ├── registry.py      # StrategyRegistry for dynamic loading
│   │   ├── sma_cross.py     # Simple Moving Average crossover
│   │   ├── ema_cross.py     # Exponential Moving Average crossover
│   │   ├── rsi_strategy.py  # RSI-based strategy
│   │   ├── macd_strategy.py # MACD-based strategy
│   │   ├── bb_strategy.py   # Bollinger Bands strategy
│   │   └── breakout_strategy.py # Price breakout strategy
│   ├── config.py            # Application configuration (env vars)
│   ├── database.py          # Database connection and session management
│   ├── jobs.py              # Background job orchestration (daily job)
│   └── main.py              # FastAPI app entry point
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable React components
│   │   │   ├── Layout.tsx   # Main layout with navigation
│   │   │   └── BacktestChart.tsx # Recharts visualization
│   │   ├── contexts/        # React contexts
│   │   │   └── AuthContext.tsx # Authentication state
│   │   ├── hooks/           # Custom React hooks
│   │   │   └── useApiQueries.ts # React Query hooks
│   │   ├── pages/           # Page components
│   │   │   ├── Login.tsx
│   │   │   ├── Signup.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Symbols.tsx
│   │   │   ├── SymbolDetail.tsx
│   │   │   ├── Strategies.tsx
│   │   │   ├── Signals.tsx
│   │   │   ├── Positions.tsx
│   │   │   ├── Users.tsx
│   │   │   └── Chat.tsx
│   │   ├── services/        # API integration
│   │   │   └── api.ts       # Axios client and API functions
│   │   ├── types/           # TypeScript type definitions
│   │   │   └── api.ts       # API response types
│   │   └── main.tsx         # React app entry point
│   └── vite.config.ts       # Vite configuration (proxy, aliases)
├── tests/                   # Backend test suite
│   ├── conftest.py          # Pytest fixtures
│   ├── test_api.py          # API endpoint tests
│   ├── test_strategies.py   # Strategy logic tests
│   └── test_positions.py    # Position management tests
├── data/                    # SQLite database directory (gitignored)
├── scripts/                 # Utility scripts
├── .env                     # Environment variables (gitignored)
├── .env.example             # Example environment configuration
├── docker-compose.yml       # Docker Compose configuration
├── Dockerfile               # Container build instructions
├── Makefile                 # Development shortcuts
├── pyproject.toml           # Poetry dependencies and config
└── README.md                # Project documentation
```

## API Documentation

When backend is running, access interactive API docs:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
