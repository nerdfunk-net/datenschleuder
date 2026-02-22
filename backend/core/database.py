"""
Database connection and session management using SQLAlchemy with PostgreSQL.
Replaces all SQLite-based database operations.
"""

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from config import settings
from typing import Generator
import logging

logger = logging.getLogger(__name__)

# Create database engine
DATABASE_URL = settings.database_url
logger.info(
    f"Connecting to database: postgresql://{settings.database_username}:***@{settings.database_host}:{settings.database_port}/{settings.database_name}"
)

engine = create_engine(
    DATABASE_URL,
    pool_size=5,  # Number of persistent connections in the pool
    max_overflow=10,  # Additional connections when pool is exhausted
    pool_pre_ping=True,  # Verify connections are alive before use
    pool_recycle=3600,  # Recycle connections after 1 hour
    echo=False,  # SQL logging disabled (use LOG_LEVEL for application logging)
)

# Create session factory
# expire_on_commit=False: after a commit, objects are NOT expired, so their column
# attributes remain accessible even after the session is closed. Without this,
# committing expires all attributes and any post-close access raises DetachedInstanceError.
SessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=engine, expire_on_commit=False
)

# Base class for all models
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Get database session.
    Use as a dependency in FastAPI routes or context manager.

    Example:
        with get_db() as db:
            db.query(User).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db_session() -> Session:
    """
    Get database session for direct use (not as generator).
    Remember to close the session after use!

    Example:
        db = get_db_session()
        try:
            users = db.query(User).all()
        finally:
            db.close()
    """
    return SessionLocal()


def init_db():
    """
    Initialize database - create all tables from SQLAlchemy models.
    This should be called on application startup.

    This will create any missing tables but will NOT alter existing tables.
    For schema migrations, use the migration system in migrations/ directory.
    """
    try:
        logger.info("Initializing database schema...")

        # Import all models to ensure they're registered with Base.metadata
        from core import models  # noqa: F401

        logger.info(
            "Loaded %s table definitions from models", len(Base.metadata.tables)
        )

        # Get inspector to check existing tables
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())
        model_tables = set(Base.metadata.tables.keys())

        missing_tables = model_tables - existing_tables

        if missing_tables:
            logger.info(
                "Creating %s missing table(s): %s",
                len(missing_tables),
                ", ".join(sorted(missing_tables)),
            )
            # Create all tables defined in models (only missing ones will be created)
            Base.metadata.create_all(bind=engine)
            logger.info("✓ Database tables created successfully")
        else:
            logger.info("✓ Database schema is up to date - all tables exist")

        logger.info(
            f"Database initialized successfully ({len(model_tables)} tables total)"
        )
    except Exception as e:
        logger.error("Error initializing database: %s", e)
        raise


def drop_all_tables():
    """
    Drop all tables - USE WITH CAUTION!
    This is primarily for development/testing.
    """
    logger.warning("Dropping all database tables...")
    Base.metadata.drop_all(bind=engine)
    logger.info("All tables dropped")


def check_connection():
    """
    Check if database connection is working.
    Returns True if connection successful, False otherwise.
    """
    try:
        from sqlalchemy import text

        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connection successful")
        return True
    except Exception as e:
        logger.error("Database connection failed: %s", e)
        return False
