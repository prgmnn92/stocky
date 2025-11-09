"""Chat service with OpenAI integration for stock analysis."""
import json
import logging
from typing import AsyncGenerator, Dict, List, Any, Optional
from datetime import datetime
import requests
from openai import AsyncOpenAI
from sqlmodel import Session, select
from app.config import settings
from app.models import Symbol, Signal, Position

logger = logging.getLogger(__name__)


# Tool function implementations
def get_user_symbols(session: Session) -> List[Dict[str, Any]]:
    """Get list of user's tracked symbols."""
    stmt = select(Symbol).where(Symbol.active == True)
    symbols = session.exec(stmt).all()
    return [
        {"symbol": s.symbol, "name": s.name or "", "added_at": str(s.added_at)}
        for s in symbols
    ]


def get_recent_signals(
    session: Session, symbol: Optional[str] = None, limit: int = 10
) -> List[Dict[str, Any]]:
    """Get recent trading signals."""
    stmt = select(Signal).order_by(Signal.ts.desc()).limit(limit)
    if symbol:
        stmt = stmt.where(Signal.symbol == symbol)

    signals = session.exec(stmt).all()
    return [
        {
            "symbol": s.symbol,
            "action": s.action,
            "strategy": s.strategy_key,
            "confidence": s.confidence,
            "date": str(s.ts),
            "price": json.loads(s.meta_json or "{}").get("price", "N/A"),
        }
        for s in signals
    ]


def get_open_positions(session: Session) -> List[Dict[str, Any]]:
    """Get all open positions with current P&L."""
    stmt = select(Position).where(Position.status == "OPEN").order_by(Position.opened_at.desc())
    positions = session.exec(stmt).all()

    return [
        {
            "symbol": p.symbol,
            "qty": p.qty,
            "avg_price": p.avg_price,
            "opened_at": str(p.opened_at),
            "current_value": p.qty * p.avg_price,
        }
        for p in positions
    ]


def get_closed_positions_summary(session: Session, limit: int = 10) -> Dict[str, Any]:
    """Get summary of recent closed positions."""
    stmt = (
        select(Position)
        .where(Position.status == "CLOSED")
        .order_by(Position.closed_at.desc())
        .limit(limit)
    )
    positions = session.exec(stmt).all()

    total_pnl = sum(p.pnl or 0.0 for p in positions)
    winning_trades = sum(1 for p in positions if (p.pnl or 0) > 0)

    return {
        "total_pnl": total_pnl,
        "total_trades": len(positions),
        "winning_trades": winning_trades,
        "win_rate": f"{(winning_trades / len(positions) * 100):.1f}%" if positions else "N/A",
        "recent_trades": [
            {
                "symbol": p.symbol,
                "pnl": p.pnl,
                "opened": str(p.opened_at),
                "closed": str(p.closed_at),
            }
            for p in positions[:5]
        ],
    }


def web_search(query: str) -> Dict[str, Any]:
    """
    Perform web search for stock market information, news, and analysis.

    Uses DuckDuckGo HTML search (no API key required).
    """
    try:
        # Use DuckDuckGo HTML search (simple, no API key needed)
        url = "https://html.duckduckgo.com/html/"
        params = {"q": query}
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }

        response = requests.post(url, data=params, headers=headers, timeout=10)
        response.raise_for_status()

        # Simple HTML parsing to extract snippets
        html = response.text
        results = []

        # Basic extraction (very simplified - just for MVP)
        # In production, consider using BeautifulSoup or a proper search API
        from html.parser import HTMLParser

        class ResultParser(HTMLParser):
            def __init__(self):
                super().__init__()
                self.results = []
                self.in_result = False
                self.current_text = []

            def handle_starttag(self, tag, attrs):
                if tag == 'a' and any(k == 'class' and 'result__a' in v for k, v in attrs):
                    self.in_result = True

            def handle_endtag(self, tag):
                if tag == 'a' and self.in_result:
                    if self.current_text:
                        text = ''.join(self.current_text).strip()
                        if text and len(self.results) < 5:
                            self.results.append(text)
                        self.current_text = []
                    self.in_result = False

            def handle_data(self, data):
                if self.in_result:
                    self.current_text.append(data)

        parser = ResultParser()
        parser.feed(html)

        if parser.results:
            return {
                "query": query,
                "results": parser.results[:5],
                "source": "DuckDuckGo",
                "timestamp": datetime.utcnow().isoformat()
            }
        else:
            return {
                "query": query,
                "results": ["No results found. Try a different search query."],
                "source": "DuckDuckGo",
                "timestamp": datetime.utcnow().isoformat()
            }

    except Exception as e:
        logger.error(f"Web search failed: {e}")
        return {
            "query": query,
            "error": f"Search failed: {str(e)}",
            "results": [],
            "source": "DuckDuckGo"
        }


# Tool definitions for OpenAI function calling
TOOLS_BASE = [
    {
        "type": "function",
        "function": {
            "name": "get_user_symbols",
            "description": "Get list of stock symbols currently tracked by the user in their portfolio",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_recent_signals",
            "description": "Get recent BUY/SELL trading signals generated by strategies",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {
                        "type": "string",
                        "description": "Optional: Filter by specific stock symbol (e.g., AAPL)",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Number of signals to retrieve (default: 10)",
                        "default": 10,
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_open_positions",
            "description": "Get all currently open trading positions with entry prices and quantities",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_closed_positions_summary",
            "description": "Get summary of closed positions including P&L, win rate, and recent trades",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Number of recent trades to include (default: 10)",
                        "default": 10,
                    }
                },
                "required": [],
            },
        },
    },
]

TOOL_WEB_SEARCH = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": "Search the web for current stock market news, analysis, earnings reports, or any financial information. Use this when user asks about recent news, current events, or real-time market data not in the database.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query (e.g., 'AAPL earnings report 2024', 'Tesla stock news today', 'S&P 500 performance')",
                }
            },
            "required": ["query"],
        },
    },
}


# System prompt for stock analysis specialization
SYSTEM_PROMPT = """You are a professional stock market analyst assistant integrated into Stocky, a swing trading signal generator platform.

**Your Capabilities:**
- Access to user's tracked symbols, trading signals, and positions via tool calls
- Professional financial analysis and market research
- Data-driven insights based on technical analysis and market data
- Web search for real-time news, earnings reports, and market sentiment (when available)

**Your Approach:**
- Provide clear, data-driven analysis
- Be cautious and balanced - avoid overly optimistic or pessimistic predictions
- Always cite sources when using web search or external data
- Focus on risk management and informed decision-making
- Use the available tools to provide personalized insights based on user's portfolio

**Available Data:**
- User's tracked symbols (get_user_symbols)
- Recent BUY/SELL signals from strategies (get_recent_signals)
- Open positions with entry prices (get_open_positions)
- Closed positions with P&L performance (get_closed_positions_summary)

**Communication Style:**
- Professional but approachable
- Use clear financial terminology
- Provide actionable insights when possible
- Format responses with markdown for readability
- Include relevant data points and metrics

Remember: You provide analysis and insights, but users make their own investment decisions. Always emphasize the importance of doing thorough research and considering individual risk tolerance."""


class ChatService:
    """Service for handling AI chat with streaming responses."""

    def __init__(self):
        """Initialize chat service."""
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)

    def _execute_tool(self, session: Session, tool_name: str, arguments: Dict[str, Any]) -> str:
        """Execute a tool function and return results as JSON string."""
        try:
            if tool_name == "get_user_symbols":
                result = get_user_symbols(session)
            elif tool_name == "get_recent_signals":
                result = get_recent_signals(
                    session,
                    symbol=arguments.get("symbol"),
                    limit=arguments.get("limit", 10),
                )
            elif tool_name == "get_open_positions":
                result = get_open_positions(session)
            elif tool_name == "get_closed_positions_summary":
                result = get_closed_positions_summary(
                    session, limit=arguments.get("limit", 10)
                )
            elif tool_name == "web_search":
                result = web_search(arguments.get("query", ""))
            else:
                return json.dumps({"error": f"Unknown tool: {tool_name}"})

            return json.dumps(result, indent=2)
        except Exception as e:
            logger.error(f"Error executing tool {tool_name}: {e}")
            return json.dumps({"error": str(e)})

    async def stream_chat(
        self, session: Session, messages: List[Dict[str, str]], model: str = "gpt-4o-mini",
        web_search_enabled: bool = False
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat completions with tool calling support.

        Yields JSON strings in format:
        - {"type": "content", "data": "text chunk"}
        - {"type": "tool_call", "data": {"name": "...", "args": {...}}}
        - {"type": "done"}
        - {"type": "error", "data": "error message"}
        """
        try:
            # Prepend system prompt
            full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

            # Build tools list based on web_search_enabled flag
            tools = TOOLS_BASE.copy()
            if web_search_enabled:
                tools.append(TOOL_WEB_SEARCH)

            # Create streaming completion
            stream = await self.client.chat.completions.create(
                model=model,
                messages=full_messages,
                tools=tools,
                stream=True,
                temperature=0.7,
            )

            # Track tool calls during streaming
            tool_calls = {}
            current_tool_call_id = None

            async for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if not delta:
                    continue

                # Handle content (regular message)
                if delta.content:
                    yield json.dumps({"type": "content", "data": delta.content})

                # Handle tool calls
                if delta.tool_calls:
                    for tool_call in delta.tool_calls:
                        # Start of new tool call
                        if tool_call.id:
                            current_tool_call_id = tool_call.id
                            tool_calls[current_tool_call_id] = {
                                "name": tool_call.function.name if tool_call.function.name else "",
                                "arguments": "",
                            }

                        # Accumulate arguments
                        if current_tool_call_id and tool_call.function.arguments:
                            tool_calls[current_tool_call_id]["arguments"] += (
                                tool_call.function.arguments
                            )

            # Execute tool calls if any
            if tool_calls:
                for tool_id, tool_data in tool_calls.items():
                    tool_name = tool_data["name"]
                    try:
                        arguments = json.loads(tool_data["arguments"])
                    except json.JSONDecodeError:
                        arguments = {}

                    # Execute tool
                    result = self._execute_tool(session, tool_name, arguments)

                    # Send tool call notification
                    yield json.dumps({
                        "type": "tool_call",
                        "data": {
                            "name": tool_name,
                            "args": arguments,
                            "result": json.loads(result),
                        },
                    })

                    # Add tool response to messages and continue
                    full_messages.append({
                        "role": "assistant",
                        "content": None,
                        "tool_calls": [{
                            "id": tool_id,
                            "type": "function",
                            "function": {"name": tool_name, "arguments": json.dumps(arguments)},
                        }],
                    })
                    full_messages.append({
                        "role": "tool",
                        "tool_call_id": tool_id,
                        "content": result,
                    })

                # Continue conversation with tool results
                stream = await self.client.chat.completions.create(
                    model=model,
                    messages=full_messages,
                    stream=True,
                    temperature=0.7,
                )

                async for chunk in stream:
                    delta = chunk.choices[0].delta if chunk.choices else None
                    if delta and delta.content:
                        yield json.dumps({"type": "content", "data": delta.content})

            # Signal completion
            yield json.dumps({"type": "done"})

        except Exception as e:
            logger.error(f"Error in chat streaming: {e}")
            yield json.dumps({"type": "error", "data": str(e)})
