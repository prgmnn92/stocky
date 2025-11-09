# Positions API - Paper Trading

Complete API reference for managing trading positions (paper trading).

---

## 📊 Overview

The Positions API allows you to:
- **Track paper trades** without real money
- **Open positions** when you see BUY signals
- **Close positions** when you see SELL signals
- **Calculate P&L** automatically
- **View execution history** for each position

---

## 🔌 Endpoints

### 1. List All Positions

**`GET /positions`**

List all positions (open and closed).

**Query Parameters**:
- `status` (optional): Filter by status (`OPEN` or `CLOSED`)

**Examples**:
```bash
# All positions
curl http://localhost:8000/positions | jq

# Only open positions
curl "http://localhost:8000/positions?status=OPEN" | jq

# Only closed positions
curl "http://localhost:8000/positions?status=CLOSED" | jq
```

**Response**:
```json
[
  {
    "id": 1,
    "symbol": "AAPL",
    "opened_at": "2024-10-25T10:30:00",
    "qty": 10,
    "avg_price": 185.50,
    "status": "OPEN",
    "closed_at": null,
    "pnl": null,
    "meta_json": "{\"strategy\": \"sma_cross\"}"
  }
]
```

---

### 2. Open a Position (BUY)

**`POST /positions`**

Create a new position (paper trade entry).

**Request Body**:
```json
{
  "symbol": "AAPL",
  "qty": 10,
  "price": 185.50,
  "meta_json": "{\"strategy\": \"sma_cross\", \"signal_id\": 123}"
}
```

**Fields**:
- `symbol` (required): Stock ticker (e.g., "AAPL")
- `qty` (required): Number of shares (must be > 0)
- `price` (required): Entry price per share (must be > 0)
- `meta_json` (optional): Custom metadata as JSON string

**Example**:
```bash
curl -X POST http://localhost:8000/positions \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "qty": 10,
    "price": 185.50,
    "meta_json": "{\"strategy\": \"sma_cross\"}"
  }' | jq
```

**Response**:
```json
{
  "id": 1,
  "symbol": "AAPL",
  "opened_at": "2024-10-25T10:30:00",
  "qty": 10,
  "avg_price": 185.50,
  "status": "OPEN",
  "closed_at": null,
  "pnl": null,
  "meta_json": "{\"strategy\": \"sma_cross\"}"
}
```

**What Happens**:
1. Creates a `Position` record with status `OPEN`
2. Creates an `Execution` record (side: `BUY`)
3. Returns the new position with ID

---

### 3. Close a Position (SELL)

**`POST /positions/{position_id}/close`**

Close an existing position and calculate P&L.

**Request Body**:
```json
{
  "price": 190.00
}
```

**Fields**:
- `price` (required): Exit price per share (must be > 0)

**Example**:
```bash
# Close position #1 at $190.00
curl -X POST http://localhost:8000/positions/1/close \
  -H "Content-Type: application/json" \
  -d '{"price": 190.00}' | jq
```

**Response**:
```json
{
  "id": 1,
  "symbol": "AAPL",
  "opened_at": "2024-10-25T10:30:00",
  "qty": 10,
  "avg_price": 185.50,
  "status": "CLOSED",
  "closed_at": "2024-10-26T15:00:00",
  "pnl": 45.00,
  "meta_json": "{\"strategy\": \"sma_cross\"}"
}
```

**P&L Calculation**:
```
P&L = (exit_price - entry_price) × quantity
    = (190.00 - 185.50) × 10
    = 45.00
```

**What Happens**:
1. Validates position exists and is `OPEN`
2. Calculates P&L: `(exit_price - entry_price) × qty`
3. Updates position: status → `CLOSED`, sets `closed_at` and `pnl`
4. Creates an `Execution` record (side: `SELL`)
5. Returns updated position

**Error Cases**:
- `404`: Position not found
- `400`: Position is already closed

---

### 4. View Position Executions

**`GET /positions/{position_id}/executions`**

Get all buy/sell executions for a specific position.

**Example**:
```bash
curl http://localhost:8000/positions/1/executions | jq
```

**Response**:
```json
[
  {
    "id": 1,
    "position_id": 1,
    "ts": "2024-10-25T10:30:00",
    "side": "BUY",
    "qty": 10,
    "price": 185.50,
    "fee": 0.0,
    "meta_json": "{}"
  },
  {
    "id": 2,
    "position_id": 1,
    "ts": "2024-10-26T15:00:00",
    "side": "SELL",
    "qty": 10,
    "price": 190.00,
    "fee": 0.0,
    "meta_json": "{}"
  }
]
```

---

## 🔄 Complete Workflow Example

### Scenario: Trading AAPL based on SMA signals

#### Step 1: Get a BUY signal

```bash
curl "http://localhost:8000/signals?symbol=AAPL&limit=1" | jq
```

Response:
```json
[
  {
    "id": 123,
    "symbol": "AAPL",
    "ts": "2024-10-25T00:00:00",
    "strategy_key": "sma_cross",
    "action": "BUY",
    "confidence": 0.6,
    "meta_json": "{\"price\": 185.50}"
  }
]
```

#### Step 2: Open position based on signal

```bash
curl -X POST http://localhost:8000/positions \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "qty": 10,
    "price": 185.50,
    "meta_json": "{\"signal_id\": 123, \"strategy\": \"sma_cross\"}"
  }' | jq
```

Response:
```json
{
  "id": 1,
  "symbol": "AAPL",
  "opened_at": "2024-10-25T10:30:00",
  "qty": 10,
  "avg_price": 185.50,
  "status": "OPEN",
  "pnl": null
}
```

#### Step 3: Wait for SELL signal

Later, you get a SELL signal:
```bash
curl "http://localhost:8000/signals?symbol=AAPL&limit=1" | jq
```

Response:
```json
[
  {
    "id": 456,
    "symbol": "AAPL",
    "action": "SELL",
    "meta_json": "{\"price\": 190.00}"
  }
]
```

#### Step 4: Close position

```bash
curl -X POST http://localhost:8000/positions/1/close \
  -H "Content-Type: application/json" \
  -d '{"price": 190.00}' | jq
```

Response:
```json
{
  "id": 1,
  "symbol": "AAPL",
  "status": "CLOSED",
  "pnl": 45.00,
  "closed_at": "2024-10-26T15:00:00"
}
```

**Result**: Made $45 profit on paper! 📈

#### Step 5: View execution history

```bash
curl http://localhost:8000/positions/1/executions | jq
```

See both BUY and SELL executions.

---

## 📈 Portfolio Tracking

### Check all open positions

```bash
curl "http://localhost:8000/positions?status=OPEN" | jq
```

### Calculate total P&L

Get all closed positions and sum P&L:
```bash
curl "http://localhost:8000/positions?status=CLOSED" | jq '.[] | .pnl' | jq -s 'add'
```

### Position summary

```bash
# Count open positions
curl "http://localhost:8000/positions?status=OPEN" | jq 'length'

# Count closed positions
curl "http://localhost:8000/positions?status=CLOSED" | jq 'length'

# Total invested (open positions)
curl "http://localhost:8000/positions?status=OPEN" | \
  jq '.[] | .qty * .avg_price' | jq -s 'add'
```

---

## 💡 Best Practices

### 1. Track signal metadata
Store signal ID and strategy in `meta_json`:
```json
{
  "meta_json": "{\"signal_id\": 123, \"strategy\": \"sma_cross\", \"confidence\": 0.6}"
}
```

### 2. Use realistic quantities
Start small for paper trading:
- Tech stocks: 5-20 shares
- High-price stocks: 1-5 shares
- Lower-price stocks: 50-100 shares

### 3. Record stop losses
Add stop loss in metadata:
```json
{
  "meta_json": "{\"stop_loss\": 180.00, \"target\": 195.00}"
}
```

### 4. Close positions systematically
- Close on SELL signals from strategy
- Or manually set price targets/stops
- Track which strategy performs best

---

## 🔧 Integration with Signals

### Automatic position management (future feature)

You can build automation:
```python
# Pseudo-code for auto-trading
signals = get_signals(status="OPEN", symbol="AAPL")
for signal in signals:
    if signal.action == "BUY":
        # Check if no open position exists
        if not has_open_position(signal.symbol):
            create_position(
                symbol=signal.symbol,
                qty=calculate_position_size(),
                price=get_current_price(signal.symbol)
            )
    elif signal.action == "SELL":
        # Close open position if exists
        position = get_open_position(signal.symbol)
        if position:
            close_position(
                position_id=position.id,
                price=get_current_price(signal.symbol)
            )
```

---

## 🚨 Limitations (Paper Trading)

1. **No fees included**: Set to 0.0 (add manually if needed)
2. **No slippage**: Uses exact prices
3. **No partial fills**: Full quantity executed
4. **No real broker integration**: Manual tracking only
5. **No market hours validation**: Can "trade" 24/7

---

## 📊 Database Schema

### `positions` table
```sql
id              INT PRIMARY KEY
symbol          VARCHAR(20)
opened_at       DATETIME
qty             FLOAT
avg_price       FLOAT
status          VARCHAR(10)  -- 'OPEN' or 'CLOSED'
closed_at       DATETIME
pnl             FLOAT
meta_json       TEXT
```

### `executions` table
```sql
id              INT PRIMARY KEY
position_id     INT (FK → positions.id)
ts              DATETIME
side            VARCHAR(10)  -- 'BUY' or 'SELL'
qty             FLOAT
price           FLOAT
fee             FLOAT
meta_json       TEXT
```

---

## 🎯 Next Steps

1. **Manual tracking**: Use these endpoints to track your paper trades
2. **Build automation**: Create scripts to auto-open/close based on signals
3. **Add analytics**: Calculate win rate, average P&L, best strategy
4. **Risk management**: Add stop loss logic, position sizing rules
5. **Reporting**: Generate daily/weekly performance reports

---

## 📖 Related Documentation

- **Signals API**: See [README.md](README.md) for signal generation
- **Full API Docs**: http://localhost:8000/docs
- **Quick Start**: [QUICKSTART.md](QUICKSTART.md)

---

**Remember**: This is paper trading only. No real money is involved! 💰
