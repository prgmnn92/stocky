"""Main FastAPI application."""
import logging
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from app.api.routes import router
from app.api.auth import router as auth_router, get_current_user
from app.database import init_db
from app.jobs import run_daily_job
from app.config import settings
from app.models import User

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


# Scheduler instance (module-level for access in lifespan)
scheduler = BackgroundScheduler(timezone=settings.sched_timezone)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("Starting up application")
    init_db()
    logger.info("Database initialized")

    # Start scheduler
    scheduler.add_job(
        run_daily_job,
        CronTrigger(
            hour=settings.sched_hour,
            minute=settings.sched_minute,
            timezone=settings.sched_timezone,
        ),
        id="daily_job",
        name="Daily Trading Job",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        f"Scheduler started: daily job at {settings.sched_hour}:{settings.sched_minute:02d} {settings.sched_timezone}"
    )

    yield

    # Shutdown
    logger.info("Shutting down application")
    scheduler.shutdown()
    logger.info("Scheduler stopped")


# Create app
app = FastAPI(
    title="Stocky - Swing Trading Signal Generator",
    description="Daily analysis and signal generation for swing trading",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.app_env == "dev" else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(auth_router)
app.include_router(router)


# Manual job trigger endpoint (admin/manager only)
@app.post("/run/daily")
async def trigger_daily_job(current_user: User = Depends(get_current_user)) -> dict:
    """Manually trigger the daily job (admin/manager only)."""
    # Check permission
    if not current_user.can_run_daily_job():
        raise HTTPException(
            status_code=403,
            detail="Only admin and manager users can run the daily job",
        )

    logger.info(f"Manual trigger of daily job by {current_user.username}")
    try:
        result = run_daily_job()
        return result
    except Exception as e:
        logger.error(f"Manual job trigger failed: {e}")
        raise


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=settings.app_env == "dev")
