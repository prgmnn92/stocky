# Chat Feature - AI Stock Analysis Assistant

## Overview

Added an AI-powered chat interface integrated with OpenAI's GPT models for stock analysis and research. The assistant can access user's portfolio data, recent signals, and positions to provide personalized insights.

## Features Implemented

### Backend (`app/services/chat_service.py`)

**OpenAI Integration:**
- Async streaming chat completions using OpenAI Python SDK
- Server-Sent Events (SSE) for real-time streaming
- Function/tool calling for database queries

**Available Tools:**
1. `get_user_symbols()` - List of tracked symbols
2. `get_recent_signals(symbol?, limit?)` - Recent BUY/SELL signals
3. `get_open_positions()` - Current open positions with P&L
4. `get_closed_positions_summary(limit?)` - Closed positions with win rate

**System Prompt:**
- Specialized for stock market analysis
- Professional, data-driven, cautious approach
- Emphasizes risk management and informed decisions
- Uses markdown formatting for readability

**Streaming Implementation:**
- Token-by-token content streaming
- Tool call execution during streaming
- Error handling and recovery
- Automatic tool result injection

### API Endpoint (`app/api/routes.py`)

**POST /chat/stream**
- Accepts conversation history and model selection
- Returns StreamingResponse with SSE format
- Headers configured for proper streaming (no buffering)

**Request Format:**
```json
{
  "messages": [
    {"role": "user", "content": "Show me recent signals"}
  ],
  "model": "gpt-4o-mini"
}
```

**Response Format (SSE):**
```
data: {"type": "content", "data": "text chunk"}
data: {"type": "tool_call", "data": {"name": "...", "result": {...}}}
data: {"type": "done"}
data: {"type": "error", "data": "error message"}
```

### Frontend (`frontend/src/pages/Chat.tsx`)

**UI Components:**
- Full-page chat interface with header and input area
- Scrollable message history
- User messages (right-aligned, blue)
- Assistant messages (left-aligned, green)
- Markdown rendering with syntax highlighting
- Typing indicator during streaming
- Error display with retry capability

**EventSource Integration:**
- Native browser EventSource API for SSE
- Token-by-token message building
- Auto-scroll to bottom on new messages
- Connection status indicator

**User Experience:**
- Suggested prompts for first-time users
- Enter key to send (Shift+Enter for newline)
- Input disabled during streaming
- Focus management for smooth UX

### Navigation

**Added to Layout:**
- "Chat" navigation item with message icon
- Route: `/chat`
- Accessible from sidebar

## Configuration

### Environment Variables

**Backend (.env):**
```bash
OPENAI_API_KEY=sk-...your-key...
```

Already added by user - no additional configuration needed!

### Dependencies

**Backend (pyproject.toml):**
- `openai = "^1.0.0"` - Official OpenAI SDK

**Frontend (package.json):**
- `react-markdown = "^9.0.1"` - Markdown rendering

## Usage Examples

### Example 1: Portfolio Overview
**User:** "What symbols am I tracking?"

**Assistant:** Uses `get_user_symbols()` tool to fetch and display tracked symbols with dates.

### Example 2: Recent Signals
**User:** "Show me recent BUY signals for tech stocks"

**Assistant:** Uses `get_recent_signals()` with appropriate filters, then analyzes and presents results.

### Example 3: Position Analysis
**User:** "How are my positions performing?"

**Assistant:** Uses `get_open_positions()` and `get_closed_positions_summary()` to provide comprehensive P&L analysis with win rate.

### Example 4: Stock Research
**User:** "Analyze AAPL stock"

**Assistant:** Provides professional analysis based on available data and can suggest checking recent signals/positions related to AAPL.

## Installation & Setup

### Backend Setup

1. **Install dependencies:**
```bash
poetry install
```

2. **Verify OpenAI API key in .env:**
```bash
cat .env | grep OPENAI_API_KEY
```

3. **Start backend:**
```bash
poetry run uvicorn app.main:app --reload
```

### Frontend Setup

1. **Install dependencies:**
```bash
cd frontend
npm install
```

2. **Start development server:**
```bash
npm run dev
```

3. **Access chat:**
Navigate to http://localhost:3000/chat

## Testing

### Manual Testing Checklist

- [ ] Chat page loads without errors
- [ ] Message input accepts text
- [ ] Send button sends message
- [ ] Streaming responses appear token-by-token
- [ ] Tool calls execute (test with "What symbols am I tracking?")
- [ ] Markdown renders correctly (test with code blocks, lists)
- [ ] Error handling works (test with invalid API key)
- [ ] Navigation between pages preserves state
- [ ] Mobile responsive layout works

### Tool Call Testing

**Test each tool:**
1. `get_user_symbols`: "List my symbols"
2. `get_recent_signals`: "Show recent signals"
3. `get_open_positions`: "What positions do I have?"
4. `get_closed_positions_summary`: "How have my trades performed?"

## Architecture

### Data Flow

```
User Input → Chat.tsx
    ↓
EventSource → POST /chat/stream
    ↓
ChatService.stream_chat()
    ↓
OpenAI API (streaming)
    ↓
Tool Execution (if needed)
    ↓
SSE Stream → EventSource
    ↓
Update Messages → UI
```

### Tool Execution Flow

```
1. User asks question
2. GPT decides to call tool
3. Backend executes tool function
4. Tool result injected into conversation
5. GPT synthesizes answer with tool data
6. Stream final response to user
```

## Security Considerations

**API Key Protection:**
- ✅ API key stored in backend .env only
- ✅ Never exposed to frontend
- ✅ Server-side execution only

**Rate Limiting:**
- Consider implementing rate limits for production
- Monitor OpenAI API usage costs

**Input Validation:**
- User messages sanitized
- Tool parameters validated
- Error messages don't expose sensitive data

## Future Enhancements

### Planned Features (Not in MVP)

1. **Chat History Persistence**
   - Save conversations to database
   - Load previous chats
   - Export conversations

2. **Embeddable Chat Component**
   - Floating chat widget
   - Available on all pages
   - Minimize/maximize functionality
   - Context-aware (knows which page user is on)

3. **Advanced Features**
   - Web search integration (via function calling)
   - Chart generation for technical analysis
   - Real-time stock price fetching
   - News aggregation and sentiment analysis
   - Multi-turn conversation memory

4. **Configuration Options**
   - Model selection (GPT-4, GPT-3.5-turbo)
   - Temperature control
   - System prompt customization
   - Tool selection toggle

5. **User Management**
   - Per-user chat history
   - Conversation sharing
   - Favorite prompts
   - Usage statistics

## Troubleshooting

### Common Issues

**Issue:** "API key not configured"
- **Solution:** Check `.env` file has `OPENAI_API_KEY=sk-...`

**Issue:** Streaming not working
- **Solution:** Check browser console for SSE connection errors, verify backend is running

**Issue:** Tool calls failing
- **Solution:** Check database connection, verify symbols/positions exist

**Issue:** Markdown not rendering
- **Solution:** Verify `react-markdown` is installed: `npm list react-markdown`

**Issue:** CORS errors
- **Solution:** Verify Vite proxy configuration in `vite.config.ts`

## Performance

**Expected Performance:**
- First token: ~1-2 seconds
- Streaming speed: ~20-50 tokens/second
- Tool execution: ~100-500ms per tool
- Total response time: 3-10 seconds (depending on complexity)

**Token Usage (Estimated):**
- Simple query: ~500-1000 tokens
- With tool call: ~1000-2000 tokens
- Complex analysis: ~2000-4000 tokens

**Cost Optimization:**
- Using `gpt-4o-mini` by default (cost-effective)
- Tool responses are concise
- System prompt is optimized for clarity

## Model Configuration

**Default Model:** `gpt-4o-mini`
- Fast responses
- Cost-effective
- Good for most analysis tasks

**Alternative:** `gpt-4o` or `gpt-4-turbo`
- Better reasoning
- More detailed analysis
- Higher cost

To change model, update the `model` parameter in Chat.tsx or make it user-configurable.

## Documentation Updates

**Files Created:**
- `app/services/chat_service.py` - Chat service with OpenAI integration
- `frontend/src/pages/Chat.tsx` - Chat UI component
- `CHAT_FEATURE.md` - This documentation

**Files Modified:**
- `pyproject.toml` - Added openai dependency
- `app/api/routes.py` - Added /chat/stream endpoint
- `frontend/package.json` - Added react-markdown
- `frontend/src/types/api.ts` - Added chat types
- `frontend/src/App.tsx` - Added chat route
- `frontend/src/components/Layout.tsx` - Added chat navigation

## Success Criteria

✅ **Completed:**
- Backend OpenAI integration with streaming
- Tool calling for database queries
- Frontend chat UI with real-time streaming
- Navigation integrated
- Markdown rendering
- Error handling
- Professional system prompt for stock analysis

🎯 **Ready for Testing:**
- Install dependencies
- Set OPENAI_API_KEY in .env
- Start backend and frontend
- Navigate to /chat
- Test conversation flow

## Next Steps

1. **Install dependencies:**
   ```bash
   # Backend
   poetry install

   # Frontend
   cd frontend && npm install
   ```

2. **Test the chat:**
   - Start backend: `poetry run uvicorn app.main:app --reload`
   - Start frontend: `cd frontend && npm run dev`
   - Navigate to http://localhost:3000/chat
   - Try: "What symbols am I tracking?"

3. **Verify tool calling:**
   - Add some symbols if none exist
   - Ask about recent signals
   - Check if tools execute correctly

4. **Consider enhancements:**
   - Add web search integration
   - Implement chat history persistence
   - Create embeddable chat widget

---

**Status:** ✅ Complete and ready for testing
**Version:** MVP 1.0
**Date:** 2025-01-25
