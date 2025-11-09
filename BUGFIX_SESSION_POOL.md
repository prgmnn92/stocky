# Bug Fix: Database Connection Pool Exhaustion

## Issue

**Error:**
```
sqlalchemy.exc.TimeoutError: QueuePool limit of size 5 overflow 10 reached,
connection timed out, timeout 30.00
```

**Root Cause:**
The `ChatService` class was storing the database session as an instance variable (`self.session`), which prevented proper session lifecycle management. When sessions were passed to the chat service and stored, they weren't being properly closed by FastAPI's dependency management, leading to connection pool exhaustion.

## Problem Analysis

### Before Fix

```python
class ChatService:
    def __init__(self, session: Session):
        self.session = session  # ❌ Session stored as instance variable
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)

    def _execute_tool(self, tool_name: str, arguments: Dict[str, Any]) -> str:
        # Uses self.session ❌
        result = get_user_symbols(self.session)
```

**Issues:**
1. Session stored beyond its intended lifecycle
2. Session used in async generator that outlives the dependency scope
3. Connections not released back to the pool
4. Pool exhaustion after ~15 requests

### Session Lifecycle Flow (Before)

```
Request arrives
  ↓
FastAPI creates session (Depends(get_session))
  ↓
Session passed to ChatService.__init__()
  ↓
Session stored as self.session ❌
  ↓
Async generator starts (event_generator)
  ↓
FastAPI tries to close session (end of dependency scope) ⚠️
  ↓
Generator still holds reference to self.session ❌
  ↓
Session not properly closed
  ↓
Connection not returned to pool
  ↓
Pool exhaustion after ~15 requests 💥
```

## Solution

### After Fix

```python
class ChatService:
    def __init__(self):
        # ✅ No session stored
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)

    def _execute_tool(self, session: Session, tool_name: str, arguments: Dict[str, Any]) -> str:
        # ✅ Session passed as parameter
        result = get_user_symbols(session)

    async def stream_chat(
        self, session: Session,  # ✅ Session as parameter
        messages: List[Dict[str, str]],
        model: str = "gpt-4o-mini"
    ) -> AsyncGenerator[str, None]:
```

**Improvements:**
1. Session passed as parameter to each method
2. No session stored in instance
3. FastAPI manages session lifecycle properly
4. Connections released back to pool
5. No pool exhaustion

### Session Lifecycle Flow (After)

```
Request arrives
  ↓
FastAPI creates session (Depends(get_session))
  ↓
ChatService created (no session stored) ✅
  ↓
Async generator starts with session parameter ✅
  ↓
Generator uses session from closure ✅
  ↓
Request completes
  ↓
FastAPI closes session properly ✅
  ↓
Connection returned to pool ✅
  ↓
No pool exhaustion ✅
```

## Files Modified

### 1. `app/services/chat_service.py`

**Changes:**
- Removed `session` from `__init__` parameters
- Added `session` parameter to `stream_chat()` method
- Added `session` parameter to `_execute_tool()` method
- Updated all tool calls to pass session

### 2. `app/api/routes.py`

**Changes:**
- Updated `chat_stream()` endpoint to create `ChatService()` without session
- Passed session as parameter to `chat_service.stream_chat()`

## Testing

### Verify the Fix

1. **Load Test:**
```bash
# Run multiple chat requests in succession
for i in {1..20}; do
  curl -X POST http://localhost:8000/chat/stream \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"test"}]}'
done
```

2. **Monitor Connections:**
```python
# Check SQLite connection count
from app.database import engine
print(f"Pool size: {engine.pool.size()}")
print(f"Checked out: {engine.pool.checkedout()}")
```

3. **Concurrent Requests:**
```bash
# Use Apache Bench or similar
ab -n 50 -c 10 http://localhost:8000/health
```

### Expected Results

**Before Fix:**
- Pool exhaustion after ~15 requests
- Timeout errors on subsequent requests
- Need to restart backend to recover

**After Fix:**
- No pool exhaustion even with 100+ requests
- All requests complete successfully
- Connections properly recycled

## SQLAlchemy Pool Configuration

### Current Settings (Default)

```python
# SQLite default pool settings
pool_size = 5          # Max persistent connections
max_overflow = 10      # Additional connections when pool full
pool_timeout = 30.0    # Wait time before timeout
```

### Potential Optimizations (If Needed)

If you encounter issues with high concurrent load:

```python
# In database.py
from sqlalchemy.pool import StaticPool

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,  # Single connection for SQLite
)
```

**Or increase pool size:**

```python
engine = create_engine(
    settings.database_url,
    pool_size=10,
    max_overflow=20,
    pool_timeout=60,
)
```

**Note:** For SQLite, `StaticPool` or `NullPool` is often recommended since SQLite is file-based and doesn't benefit from connection pooling the same way as client-server databases.

## Best Practices Applied

### 1. Dependency Injection Pattern

✅ **Good:** Let FastAPI manage session lifecycle
```python
async def endpoint(session: Session = Depends(get_session)):
    # Use session directly
    service.method(session, ...)
```

❌ **Bad:** Store session in service
```python
async def endpoint(session: Session = Depends(get_session)):
    service = Service(session)  # ❌ Session stored
```

### 2. Stateless Services

✅ **Good:** Services that don't hold state
```python
class MyService:
    def __init__(self):
        self.client = SomeClient()  # Stateless client OK

    def method(self, session: Session, ...):
        # Session passed as parameter
```

❌ **Bad:** Services that hold sessions
```python
class MyService:
    def __init__(self, session: Session):
        self.session = session  # ❌ State held
```

### 3. Async Generator Sessions

✅ **Good:** Session in closure, managed by FastAPI
```python
async def endpoint(session: Session = Depends(get_session)):
    async def generator():
        # Session available in closure
        result = query_db(session)
        yield result
    return StreamingResponse(generator())
```

❌ **Bad:** Session stored, outlives scope
```python
async def endpoint(session: Session = Depends(get_session)):
    service.session = session  # ❌ Stored
    async def generator():
        result = query_db(service.session)  # May be closed
        yield result
    return StreamingResponse(generator())
```

## Prevention Guidelines

### Code Review Checklist

- [ ] No database sessions stored as instance variables
- [ ] Sessions passed as parameters to all methods
- [ ] Services are stateless regarding database connections
- [ ] Dependency injection used for session management
- [ ] No manual session creation in endpoints
- [ ] Connection pool size appropriate for workload
- [ ] Async generators don't hold session references

### Patterns to Watch For

**Red Flags:**
- `self.session = ...`
- `self.db = ...`
- `self.connection = ...`
- Long-lived service instances with sessions
- Manual session.close() calls
- Session passed to background tasks

**Green Flags:**
- `session: Session = Depends(get_session)`
- Sessions as method parameters
- Stateless service classes
- FastAPI managing lifecycle
- Proper dependency injection

## Related Issues

### Similar Problems to Watch For

1. **Background Tasks:**
   - Don't pass sessions to background tasks
   - Create new session in background task

2. **Long-Running Operations:**
   - Consider separate connection for long operations
   - Use session.begin() for explicit transactions

3. **Caching:**
   - Don't cache ORM objects
   - Cache only serialized data

## Monitoring

### Add Connection Pool Monitoring (Optional)

```python
# In main.py or monitoring module
from sqlalchemy import event
from app.database import engine

@event.listens_for(engine, "connect")
def receive_connect(dbapi_conn, connection_record):
    logger.info(f"Connection opened: {engine.pool.size()}/{engine.pool.size() + engine.pool.overflow()}")

@event.listens_for(engine, "close")
def receive_close(dbapi_conn, connection_record):
    logger.info(f"Connection closed: {engine.pool.checkedout()}")
```

### Health Check Enhancement

```python
@router.get("/health/db")
async def db_health():
    """Check database connection pool health."""
    return {
        "pool_size": engine.pool.size(),
        "checked_out": engine.pool.checkedout(),
        "overflow": engine.pool.overflow(),
        "available": engine.pool.size() - engine.pool.checkedout()
    }
```

## Summary

**Problem:** Connection pool exhaustion due to improper session lifecycle management

**Root Cause:** Session stored as instance variable in ChatService

**Solution:** Pass session as parameter, let FastAPI manage lifecycle

**Impact:** No more pool exhaustion, all requests complete successfully

**Prevention:** Follow stateless service pattern, use dependency injection

---

**Status:** ✅ Fixed
**Tested:** ✅ Verified
**Deployed:** Ready
**Date:** 2025-01-25
