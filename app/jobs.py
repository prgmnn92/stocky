"""Background job orchestration."""
import logging
from datetime import datetime
from sqlmodel import Session
from app.database import engine
from app.models import TaskRun
from app.services.data_service import DataService
from app.services.signal_service import SignalService
from app.providers import YahooProvider
from app.config import settings

logger = logging.getLogger(__name__)


def run_daily_job() -> dict:
    """
    Execute daily trading job: ingest prices → generate signals.

    Returns:
        Status dictionary
    """
    task_name = "daily_job"
    started_at = datetime.utcnow()

    session = Session(engine)
    task_run = TaskRun(task=task_name, started_at=started_at, status="RUNNING")
    session.add(task_run)
    session.commit()

    try:
        logger.info("Starting daily job")

        # Initialize services
        provider = YahooProvider()
        data_service = DataService(session, provider)
        signal_service = SignalService(session, data_service)

        # Step 1: Ingest price data
        logger.info("Step 1: Ingesting price data")
        symbols = data_service.get_active_symbols()
        if not symbols:
            logger.warning("No active symbols found")
            task_run.status = "SUCCESS"
            task_run.finished_at = datetime.utcnow()
            session.commit()
            return {"ok": True, "message": "No symbols to process"}

        data_service.ingest_eod_bars(symbols)

        # Step 2: Generate signals
        logger.info("Step 2: Generating signals")
        signal_service.generate_signals_for_all()

        # Mark as success
        task_run.status = "SUCCESS"
        task_run.finished_at = datetime.utcnow()
        session.commit()

        logger.info("Daily job completed successfully")
        return {"ok": True}

    except Exception as e:
        logger.error(f"Daily job failed: {e}", exc_info=True)
        task_run.status = "FAILED"
        task_run.error = str(e)
        task_run.finished_at = datetime.utcnow()
        session.commit()
        raise

    finally:
        session.close()
