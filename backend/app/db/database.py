"""
Database configuration module.
Provides async engine, session maker, and dependency injection for FastAPI.
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings


# Create async engine with connection pool settings
async_engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
)


# Async session factory
AsyncSessionFactory = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Generator function for dependency injection in FastAPI.
    Yields an AsyncSession and ensures proper cleanup after use.

    Usage in FastAPI:
        @app.get("/users")
        async def get_users(session: AsyncSession = Depends(get_session)):
            ...

    Yields:
        AsyncSession: An async SQLAlchemy session instance.
    """
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_session_context() -> AsyncGenerator[AsyncSession, None]:
    """
    Context manager alternative for session management.
    Useful for scripts and Alembic migrations.

    Usage:
        async with get_session_context() as session:
            result = await session.execute(...)

    Yields:
        AsyncSession: An async SQLAlchemy session instance.
    """
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
