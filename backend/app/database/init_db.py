"""
Database initialization: creates all tables and optionally seeds demo data.
"""
import logging
from app.database.database import engine, Base
from app.core.config import settings

logger = logging.getLogger(__name__)


def init_db() -> None:
    """Create all tables if they do not exist, and ensure schema migrations."""
    # Import all models so Base.metadata has them registered
    import app.models  # noqa: F401
    from sqlalchemy import text
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)

    # SQLite lightweight column migration helper
    with engine.connect() as conn:
        for tbl, cols in [
            ("users", [
                ("emergency_contact_phone", "VARCHAR(20)"),
                ("emergency_contact_name", "VARCHAR(255)"),
            ]),
            ("bookings", [
                ("emergency_contact_phone", "VARCHAR(20)"),
                ("emergency_contact_name", "VARCHAR(255)"),
                ("emergency_contact_notified", "BOOLEAN DEFAULT 0"),
                ("emergency_contact_notified_at", "DATETIME"),
                ("emergency_contact_message", "TEXT"),
            ]),
        ]:
            try:
                res = conn.execute(text(f"PRAGMA table_info({tbl})")).fetchall()
                existing_cols = {row[1] for row in res}
                for col_name, col_type in cols:
                    if col_name not in existing_cols:
                        conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN {col_name} {col_type}"))
                        conn.commit()
                        logger.info(f"Added column {col_name} to table {tbl}")
            except Exception as e:
                logger.debug(f"Column check for {tbl}: {e}")

    logger.info("Database tables created.")


def seed_demo_data() -> None:
    """Seed demo data if in demo mode."""
    if not settings.DEMO_MODE:
        logger.info("Demo mode disabled — skipping seed.")
        return
    from app.database.database import SessionLocal
    from app.database.seed import seed_database
    db = SessionLocal()
    try:
        seed_database(db)
    except Exception as e:
        logger.error(f"Seeding failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()
