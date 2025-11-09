"""Sentiment analysis service using OpenAI."""
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from openai import OpenAI
from sqlmodel import Session, select
from sqlalchemy.exc import OperationalError
from app.config import settings
from app.models import Sentiment, NewsCache

logger = logging.getLogger(__name__)


class SentimentService:
    """Service for analyzing stock sentiment using OpenAI."""

    def __init__(self):
        """Initialize sentiment service."""
        self.client = OpenAI(api_key=settings.openai_api_key)

    def analyze_symbol_sentiment(
        self, session: Session, symbol: str, days: int = 7
    ) -> Dict[str, Any]:
        """
        Analyze sentiment for a symbol using recent news and market data.

        Args:
            session: Database session
            symbol: Stock symbol to analyze
            days: Number of days to look back for analysis

        Returns:
            Dictionary with sentiment score, classification, and analysis
        """
        try:
            # Define time window
            window_end = datetime.utcnow()
            window_start = window_end - timedelta(days=days)

            # Gather context for analysis
            context = self._gather_context(session, symbol, window_start, window_end)

            # Perform sentiment analysis using OpenAI
            sentiment_data = self._analyze_with_openai(symbol, context)

            # Store sentiment in database
            sentiment = Sentiment(
                symbol=symbol,
                window_start=window_start,
                window_end=window_end,
                score=sentiment_data["score"],
                method="openai_gpt4o",
                meta_json=json.dumps({
                    "classification": sentiment_data["classification"],
                    "reasoning": sentiment_data["reasoning"],
                    "confidence": sentiment_data["confidence"],
                    "key_factors": sentiment_data["key_factors"],
                }),
            )

            # Check if sentiment already exists for this window
            stmt = (
                select(Sentiment)
                .where(Sentiment.symbol == symbol)
                .where(Sentiment.window_start == window_start)
                .where(Sentiment.window_end == window_end)
                .where(Sentiment.method == "openai_gpt4o")
            )
            existing = session.exec(stmt).first()

            if existing:
                # Update existing sentiment
                existing.score = sentiment.score
                existing.meta_json = sentiment.meta_json
            else:
                # Add new sentiment
                session.add(sentiment)

            # Retry commit up to 3 times on database lock
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    session.commit()
                    break
                except OperationalError as e:
                    if "database is locked" in str(e) and attempt < max_retries - 1:
                        logger.warning(
                            f"Database locked on attempt {attempt + 1}, retrying..."
                        )
                        session.rollback()
                        time.sleep(0.5 * (attempt + 1))  # Exponential backoff
                    else:
                        session.rollback()
                        raise

            logger.info(
                f"Sentiment analysis completed for {symbol}: "
                f"{sentiment_data['classification']} ({sentiment_data['score']:.2f})"
            )

            return {
                "symbol": symbol,
                "score": sentiment_data["score"],
                "classification": sentiment_data["classification"],
                "reasoning": sentiment_data["reasoning"],
                "confidence": sentiment_data["confidence"],
                "key_factors": sentiment_data["key_factors"],
                "window_start": window_start.isoformat(),
                "window_end": window_end.isoformat(),
            }

        except Exception as e:
            logger.error(f"Failed to analyze sentiment for {symbol}: {e}")
            raise

    def _gather_context(
        self, session: Session, symbol: str, window_start: datetime, window_end: datetime
    ) -> str:
        """Gather relevant context for sentiment analysis."""
        context_parts = []

        # Add recent news if available
        stmt = (
            select(NewsCache)
            .where(NewsCache.symbol == symbol)
            .where(NewsCache.published_at >= window_start)
            .where(NewsCache.published_at <= window_end)
            .order_by(NewsCache.published_at.desc())
            .limit(10)
        )
        news_items = session.exec(stmt).all()

        if news_items:
            context_parts.append("Recent News:")
            for news in news_items:
                context_parts.append(
                    f"- {news.title} ({news.published_at.strftime('%Y-%m-%d')})"
                )
                if news.summary:
                    context_parts.append(f"  Summary: {news.summary}")
        else:
            context_parts.append("No recent news available in database.")

        return "\n".join(context_parts)

    def _analyze_with_openai(self, symbol: str, context: str) -> Dict[str, Any]:
        """Use OpenAI to analyze sentiment."""
        prompt = f"""Analyze the market sentiment for stock symbol {symbol}.

Context:
{context}

Based on the available information, provide a comprehensive sentiment analysis.

Return your analysis as a JSON object with the following structure:
{{
    "score": <float between -1.0 (very bearish) and 1.0 (very bullish)>,
    "classification": "<VERY_BULLISH|BULLISH|NEUTRAL|BEARISH|VERY_BEARISH>",
    "reasoning": "<brief explanation of the sentiment score>",
    "confidence": "<HIGH|MEDIUM|LOW>",
    "key_factors": ["<factor 1>", "<factor 2>", "<factor 3>"]
}}

If no context is available, provide a neutral analysis with LOW confidence.
"""

        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional financial analyst specialized in market sentiment analysis. Provide objective, data-driven assessments.",
                },
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )

        result = json.loads(response.choices[0].message.content)
        return result

    def get_latest_sentiment(self, session: Session, symbol: str) -> Optional[Dict[str, Any]]:
        """Get the most recent sentiment analysis for a symbol."""
        stmt = (
            select(Sentiment)
            .where(Sentiment.symbol == symbol)
            .order_by(Sentiment.window_end.desc())
            .limit(1)
        )
        sentiment = session.exec(stmt).first()

        if not sentiment:
            return None

        meta = json.loads(sentiment.meta_json)
        return {
            "symbol": symbol,
            "score": sentiment.score,
            "classification": meta.get("classification", "UNKNOWN"),
            "reasoning": meta.get("reasoning", ""),
            "confidence": meta.get("confidence", "LOW"),
            "key_factors": meta.get("key_factors", []),
            "window_start": sentiment.window_start.isoformat(),
            "window_end": sentiment.window_end.isoformat(),
            "analyzed_at": sentiment.window_end.isoformat(),
        }
