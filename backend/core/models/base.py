# Re-export Base from core.database for use in domain model modules.
# Base is defined in core.database to avoid circular imports with the engine/session setup.
from core.database import Base  # noqa: F401

__all__ = ["Base"]
