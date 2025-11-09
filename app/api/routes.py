"""API route handlers."""
from datetime import date, datetime
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlmodel import Session, select
from app.database import get_session
from app.models import Symbol, Signal, Position, Strategy, PriceBar, Execution, User
from app.services.chat_service import ChatService
from app.services.sentiment_service import SentimentService
from app.services.backtest_service import BacktestService
from app.api.auth import get_current_user

router = APIRouter()


# Schemas
class SymbolCreate(BaseModel):
    symbol: str
    name: Optional[str] = None


class StrategyCreate(BaseModel):
    key: str
    name: str
    params_json: str = "{}"


class StrategyUpdate(BaseModel):
    enabled: Optional[bool] = None
    params_json: Optional[str] = None


class PositionCreate(BaseModel):
    symbol: str = Field(..., description="Stock symbol (e.g., AAPL)")
    qty: float = Field(..., gt=0, description="Quantity (shares)")
    price: float = Field(..., gt=0, description="Entry price per share")
    meta_json: str = Field(default="{}", description="Optional metadata (JSON)")


class PositionClose(BaseModel):
    price: float = Field(..., gt=0, description="Exit price per share")


class ChatMessage(BaseModel):
    role: str = Field(..., description="Message role: 'user' or 'assistant'")
    content: str = Field(..., description="Message content")


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., description="Conversation history")
    model: str = Field(default="gpt-4o-mini", description="OpenAI model to use")
    web_search_enabled: bool = Field(default=False, description="Enable web search tool")


# Health check
@router.get("/health")
async def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok"}


# Symbols
@router.get("/symbols", response_model=List[Dict])
async def list_symbols(
    current_user: User = Depends(get_current_user), session: Session = Depends(get_session)
) -> List[Dict]:
    """List all active symbols for the current user with their last known price and sentiment."""
    from app.models import PriceBar, Sentiment, UserSymbol

    # Join symbols with user_symbols to get user's symbols
    stmt = (
        select(Symbol)
        .join(UserSymbol, Symbol.symbol == UserSymbol.symbol)
        .where(UserSymbol.user_id == current_user.id, Symbol.active == True)
    )
    symbols = session.exec(stmt).all()

    result = []
    for symbol in symbols:
        # Get last known price from PriceBar
        price_stmt = (
            select(PriceBar)
            .where(PriceBar.symbol == symbol.symbol)
            .order_by(PriceBar.ts.desc())
            .limit(1)
        )
        last_bar = session.exec(price_stmt).first()

        # Get latest sentiment
        sentiment_stmt = (
            select(Sentiment)
            .where(Sentiment.symbol == symbol.symbol)
            .order_by(Sentiment.window_end.desc())
            .limit(1)
        )
        latest_sentiment = session.exec(sentiment_stmt).first()

        sentiment_data = None
        if latest_sentiment:
            import json
            meta = json.loads(latest_sentiment.meta_json)
            sentiment_data = {
                "score": latest_sentiment.score,
                "classification": meta.get("classification", "UNKNOWN"),
                "analyzed_at": latest_sentiment.window_end.isoformat(),
            }

        result.append({
            "symbol": symbol.symbol,
            "name": symbol.name,
            "active": symbol.active,
            "added_at": symbol.added_at.isoformat(),
            "last_price": last_bar.close if last_bar else None,
            "last_price_date": last_bar.ts.isoformat() if last_bar else None,
            "sentiment": sentiment_data,
        })

    return result


@router.post("/symbols", response_model=Symbol)
async def create_symbol(
    symbol_data: SymbolCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Symbol:
    """Add a new symbol (not available for test users)."""
    from app.models import UserSymbol
    from app.providers.yahoo import YahooProvider

    # Check permission
    if not current_user.can_add_symbols():
        raise HTTPException(
            status_code=403, detail="Test users cannot add symbols. Please upgrade your account."
        )

    symbol_str = symbol_data.symbol.upper()

    # Check if user already has this symbol
    stmt = (
        select(UserSymbol)
        .where(UserSymbol.user_id == current_user.id, UserSymbol.symbol == symbol_str)
    )
    existing_user_symbol = session.exec(stmt).first()
    if existing_user_symbol:
        raise HTTPException(status_code=400, detail="Symbol already exists in your watchlist")

    # Validate symbol exists in Yahoo Finance
    provider = YahooProvider()
    current_price = provider.get_current_price(symbol_str)
    if current_price is None:
        raise HTTPException(
            status_code=404,
            detail=f"Symbol '{symbol_str}' not found. Please verify the ticker symbol is correct."
        )

    # Check if symbol exists in symbols table, if not create it
    symbol = session.get(Symbol, symbol_str)
    if not symbol:
        symbol = Symbol(
            symbol=symbol_str,
            name=symbol_data.name,
            active=True,
        )
        session.add(symbol)
        session.flush()  # Ensure symbol is created before creating relationship

    # Create user-symbol relationship
    user_symbol = UserSymbol(
        user_id=current_user.id,
        symbol=symbol_str,
    )
    session.add(user_symbol)
    session.commit()
    session.refresh(symbol)
    return symbol


@router.delete("/symbols/{symbol}")
async def delete_symbol(
    symbol: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    """Remove a symbol from user's watchlist."""
    from app.models import UserSymbol

    # Find user-symbol relationship
    stmt = select(UserSymbol).where(
        UserSymbol.user_id == current_user.id, UserSymbol.symbol == symbol
    )
    user_symbol = session.exec(stmt).first()

    if not user_symbol:
        raise HTTPException(status_code=404, detail="Symbol not found in your watchlist")

    # Delete the relationship (not the symbol itself)
    session.delete(user_symbol)
    session.commit()
    return {"ok": True}


@router.get("/symbols/{symbol}/price")
async def get_current_price(symbol: str) -> dict:
    """
    Get current price for a symbol from Yahoo Finance.

    Returns the current/latest available price.
    """
    from app.providers.yahoo import YahooProvider

    provider = YahooProvider()
    price = provider.get_current_price(symbol)

    if price is None:
        raise HTTPException(status_code=404, detail=f"Could not fetch price for {symbol}")

    return {"symbol": symbol, "price": price}


# Signals
@router.get("/signals", response_model=List[Signal])
async def list_signals(
    symbol: Optional[str] = None,
    strategy_key: Optional[str] = None,
    limit: int = 50,
    session: Session = Depends(get_session),
) -> List[Signal]:
    """List signals with optional filters."""
    stmt = select(Signal).order_by(Signal.ts.desc()).limit(limit)

    if symbol:
        stmt = stmt.where(Signal.symbol == symbol)
    if strategy_key:
        stmt = stmt.where(Signal.strategy_key == strategy_key)

    return list(session.exec(stmt).all())


# Positions
@router.get("/positions")
async def list_positions(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> List[Dict]:
    """List positions with optional status filter and current prices for open positions."""
    from app.providers.yahoo import YahooProvider
    from datetime import datetime

    stmt = select(Position).where(Position.user_id == current_user.id).order_by(Position.opened_at.desc())

    if status:
        stmt = stmt.where(Position.status == status.upper())

    positions = session.exec(stmt).all()
    provider = YahooProvider()

    result = []
    for position in positions:
        pos_dict = position.model_dump()

        # For open positions, fetch current price and calculate metrics
        if position.status == "OPEN":
            current_price = provider.get_current_price(position.symbol)
            if current_price:
                pos_dict["current_price"] = current_price
                pos_dict["current_value"] = position.qty * current_price
                pos_dict["unrealized_pnl"] = (current_price - position.avg_price) * position.qty
                pos_dict["pnl_percentage"] = ((current_price - position.avg_price) / position.avg_price) * 100
            else:
                pos_dict["current_price"] = None
                pos_dict["current_value"] = position.qty * position.avg_price
                pos_dict["unrealized_pnl"] = 0
                pos_dict["pnl_percentage"] = 0

            # Calculate days since opened
            days_open = (datetime.utcnow() - position.opened_at).days
            pos_dict["days_open"] = days_open
        else:
            # For closed positions, use existing data
            pos_dict["current_price"] = None
            pos_dict["current_value"] = None
            pos_dict["unrealized_pnl"] = None
            pos_dict["pnl_percentage"] = None
            pos_dict["days_open"] = None

        result.append(pos_dict)

    return result


@router.post("/positions", response_model=Position)
async def create_position(
    position_data: PositionCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Position:
    """
    Open a new position (paper trading).

    Creates a position and an initial execution record.
    Deducts the cost from the user's balance.
    """
    now = datetime.utcnow()

    # Calculate position cost
    position_cost = position_data.qty * position_data.price

    # Check if user has enough balance
    if current_user.balance < position_cost:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient funds. Required: ${position_cost:,.2f}, Available: ${current_user.balance:,.2f}",
        )

    # Deduct cost from user balance
    current_user.balance -= position_cost
    session.add(current_user)

    # Create position
    position = Position(
        user_id=current_user.id,
        symbol=position_data.symbol,
        opened_at=now,
        qty=position_data.qty,
        avg_price=position_data.price,
        status="OPEN",
        meta_json=position_data.meta_json,
    )
    session.add(position)
    session.flush()  # Get position ID

    # Create execution record
    execution = Execution(
        position_id=position.id,
        ts=now,
        side="BUY",
        qty=position_data.qty,
        price=position_data.price,
        fee=0.0,
        meta_json="{}",
    )
    session.add(execution)

    session.commit()
    session.refresh(position)
    return position


@router.post("/positions/{position_id}/close", response_model=Position)
async def close_position(
    position_id: int,
    close_data: PositionClose,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Position:
    """
    Close an existing position (paper trading).

    Marks position as CLOSED, calculates P&L, creates exit execution record,
    and returns funds to user's balance.
    """
    # Get position
    position = session.get(Position, position_id)
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")

    # Verify ownership
    if position.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only close your own positions")

    if position.status != "OPEN":
        raise HTTPException(status_code=400, detail="Position is not open")

    now = datetime.utcnow()

    # Calculate P&L
    pnl = (close_data.price - position.avg_price) * position.qty

    # Calculate total return (proceeds from sale)
    position_value = position.qty * close_data.price

    # Add funds back to user balance
    user = session.get(User, position.user_id)
    if user:
        user.balance += position_value
        session.add(user)

    # Update position
    position.status = "CLOSED"
    position.closed_at = now
    position.pnl = pnl

    # Create exit execution
    execution = Execution(
        position_id=position_id,
        ts=now,
        side="SELL",
        qty=position.qty,
        price=close_data.price,
        fee=0.0,
        meta_json="{}",
    )
    session.add(execution)

    session.commit()
    session.refresh(position)
    return position


@router.get("/positions/{position_id}/executions", response_model=List[Execution])
async def get_position_executions(
    position_id: int, session: Session = Depends(get_session)
) -> List[Execution]:
    """Get all executions for a specific position."""
    stmt = select(Execution).where(Execution.position_id == position_id).order_by(Execution.ts)
    return list(session.exec(stmt).all())


@router.get("/transactions", response_model=List[dict])
async def get_user_transactions(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> List[dict]:
    """
    Get all transactions (executions) for the current user.
    
    Returns executions with enriched position data including symbol, P&L, etc.
    Ordered by timestamp descending (most recent first).
    """
    # Get all positions for the user
    stmt = (
        select(Execution, Position)
        .join(Position, Execution.position_id == Position.id)
        .where(Position.user_id == current_user.id)
        .order_by(Execution.ts.desc())
    )
    
    results = session.exec(stmt).all()
    
    transactions = []
    for execution, position in results:
        transactions.append({
            "id": execution.id,
            "position_id": execution.position_id,
            "symbol": position.symbol,
            "ts": execution.ts,
            "side": execution.side,
            "qty": execution.qty,
            "price": execution.price,
            "fee": execution.fee,
            "total": execution.qty * execution.price,
            "position_status": position.status,
            "position_pnl": position.pnl,
            "meta_json": execution.meta_json,
        })
    
    return transactions


# Strategies
@router.get("/strategies/available")
async def list_available_strategies() -> List[Dict]:
    """List all available strategy types from the registry."""
    from app.strategies import registry
    return registry.list_available()


@router.get("/strategies", response_model=List[Strategy])
async def list_strategies(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
) -> List[Strategy]:
    """List strategies for the current user."""
    stmt = select(Strategy).where(Strategy.user_id == current_user.id)
    return list(session.exec(stmt).all())


@router.post("/strategies", response_model=Strategy)
async def create_strategy(
    strategy_data: StrategyCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
) -> Strategy:
    """Create a new strategy for the current user."""
    # Check if user already has a strategy with this key
    stmt = select(Strategy).where(
        Strategy.user_id == current_user.id,
        Strategy.key == strategy_data.key
    )
    existing = session.exec(stmt).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="You already have a strategy with this key"
        )

    strategy = Strategy(
        user_id=current_user.id,
        **strategy_data.model_dump()
    )
    session.add(strategy)
    session.commit()
    session.refresh(strategy)
    return strategy


@router.patch("/strategies/{strategy_id}", response_model=Strategy)
async def update_strategy(
    strategy_id: int,
    updates: StrategyUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
) -> Strategy:
    """Update strategy configuration."""
    stmt = select(Strategy).where(
        Strategy.id == strategy_id,
        Strategy.user_id == current_user.id
    )
    strategy = session.exec(stmt).first()
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")

    if updates.enabled is not None:
        strategy.enabled = updates.enabled
    if updates.params_json is not None:
        strategy.params_json = updates.params_json

    session.commit()
    session.refresh(strategy)
    return strategy


@router.delete("/strategies/{strategy_id}")
async def delete_strategy(
    strategy_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
) -> dict:
    """Delete a strategy."""
    stmt = select(Strategy).where(
        Strategy.id == strategy_id,
        Strategy.user_id == current_user.id
    )
    strategy = session.exec(stmt).first()
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")

    session.delete(strategy)
    session.commit()

    return {"ok": True, "message": f"Strategy '{strategy.name}' deleted successfully"}


@router.post("/strategies/{strategy_id}/backtest")
async def backtest_strategy(
    strategy_id: int,
    symbol: str,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
) -> Dict:
    """
    Backtest a strategy on historical data for a symbol.

    Returns historical signals that would have been generated by the strategy.
    """
    # Verify strategy belongs to current user
    stmt = select(Strategy).where(
        Strategy.id == strategy_id,
        Strategy.user_id == current_user.id
    )
    strategy = session.exec(stmt).first()
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")

    # Run backtest
    backtest_service = BacktestService()
    result = backtest_service.backtest_strategy(
        session=session,
        strategy_id=strategy_id,
        symbol=symbol,
        from_date=from_date,
        to_date=to_date
    )

    return result


# Prices
@router.get("/prices/{symbol}")
async def get_prices(
    symbol: str,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    session: Session = Depends(get_session),
) -> List[dict]:
    """
    Get price data for a symbol.

    If no data exists in the database, automatically fetches historical data
    from Yahoo Finance and stores it before returning.
    """
    from app.services.data_service import DataService
    from app.providers.yahoo import YahooProvider
    from datetime import timedelta

    # First, try to get existing data
    stmt = select(PriceBar).where(PriceBar.symbol == symbol).order_by(PriceBar.ts)

    if from_date:
        stmt = stmt.where(PriceBar.ts >= from_date)
    if to_date:
        stmt = stmt.where(PriceBar.ts <= to_date)

    bars = session.exec(stmt).all()

    # If no data exists, fetch it on demand
    if not bars:
        # Verify symbol exists before fetching
        provider = YahooProvider()
        current_price = provider.get_current_price(symbol)
        if current_price is None:
            raise HTTPException(
                status_code=404,
                detail=f"Symbol '{symbol}' not found. Please verify the ticker symbol is correct."
            )

        # Calculate lookback period
        lookback_days = 400  # Default lookback
        if from_date:
            # If user specified from_date, calculate days from that date to today
            days_diff = (date.today() - from_date).days
            lookback_days = max(days_diff + 30, 400)  # Add buffer, minimum 400 days

        # Fetch and store data
        data_service = DataService(session=session, provider=provider)
        data_service.ingest_eod_bars(symbols=[symbol], lookback_days=lookback_days)

        # Query again after fetching
        stmt = select(PriceBar).where(PriceBar.symbol == symbol).order_by(PriceBar.ts)

        if from_date:
            stmt = stmt.where(PriceBar.ts >= from_date)
        if to_date:
            stmt = stmt.where(PriceBar.ts <= to_date)

        bars = session.exec(stmt).all()

    return [b.model_dump() for b in bars]


# Chat
@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> StreamingResponse:
    """
    Stream AI chat responses with tool calling for stock analysis.

    Accepts conversation history and streams back responses in Server-Sent Events format.
    The assistant can call tools to access user's portfolio data, signals, and positions.
    Test users cannot use chat.
    """
    # Check permission
    if not current_user.can_use_chat():
        raise HTTPException(
            status_code=403, detail="Test users cannot use chat. Please upgrade your account."
        )

    chat_service = ChatService()

    # Convert Pydantic models to dicts
    messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]

    async def event_generator():
        """Generate SSE events from chat stream."""
        try:
            async for chunk in chat_service.stream_chat(
                session, messages, model=request.model, web_search_enabled=request.web_search_enabled
            ):
                # SSE format: "data: {json}\n\n"
                yield f"data: {chunk}\n\n"
        except Exception as e:
            error_data = {"type": "error", "data": str(e)}
            yield f"data: {error_data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable proxy buffering
        },
    )


# Sentiment Analysis
@router.post("/symbols/{symbol}/sentiment")
async def analyze_symbol_sentiment(
    symbol: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
) -> dict:
    """
    Run sentiment analysis for a specific symbol.

    Analyzes market sentiment based on recent news and returns
    a sentiment score from -1.0 (very bearish) to 1.0 (very bullish).
    """
    from app.models import UserSymbol

    # Check if user has access to this symbol
    stmt = select(UserSymbol).where(
        UserSymbol.user_id == current_user.id, UserSymbol.symbol == symbol
    )
    user_symbol = session.exec(stmt).first()
    if not user_symbol:
        raise HTTPException(status_code=404, detail="Symbol not found in your watchlist")

    sentiment_service = SentimentService()
    try:
        result = sentiment_service.analyze_symbol_sentiment(session, symbol)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sentiment analysis failed: {str(e)}")


@router.get("/symbols/{symbol}/sentiment/latest")
async def get_latest_sentiment(
    symbol: str, session: Session = Depends(get_session)
) -> dict:
    """Get the most recent sentiment analysis for a symbol."""
    sentiment_service = SentimentService()
    result = sentiment_service.get_latest_sentiment(session, symbol)

    if not result:
        raise HTTPException(status_code=404, detail="No sentiment analysis found for this symbol")

    return result
