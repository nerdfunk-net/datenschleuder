#!/usr/bin/env python3
"""
Datenschleuder Backend Startup Script
Loads configuration and starts the FastAPI server.
"""

import uvicorn
import os
from config import settings
import logging


def main():
    """Start the FastAPI server with configuration."""

    # Configure logging
    # Ensure log_level is valid, default to INFO if invalid
    try:
        log_level = getattr(logging, settings.log_level)
    except AttributeError:
        log_level = logging.INFO
        print(f"Warning: Invalid LOG_LEVEL '{settings.log_level}', defaulting to INFO")

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    # Suppress debug logging from GitPython
    logging.getLogger("git.cmd").setLevel(logging.WARNING)
    logging.getLogger("git.repo").setLevel(logging.WARNING)

    # Suppress debug logging from Celery
    logging.getLogger("celery").setLevel(logging.INFO)
    logging.getLogger("celery.utils.functional").setLevel(logging.INFO)

    global logger
    logger = logging.getLogger(__name__)

    # Log current log level for verification
    logger.debug(f"DEBUG: Logging configured at {settings.log_level} level")
    logger.debug(f"DEBUG: Environment LOG_LEVEL = {os.getenv('LOG_LEVEL', 'not set')}")

    # Log startup information
    logger.info("Starting Datenschleuder Backend Server")
    logger.info(f"Server: {settings.host}:{settings.port}")
    logger.info(f"Log Level: {settings.log_level}")
    logger.info(f"Data Directory: {settings.data_directory}")
    logger.info(f"Git SSL Verification: {settings.git_ssl_verify}")

    # Start the server
    # Get the backend directory path
    backend_dir = os.path.dirname(__file__)

    # Change to backend directory to ensure Uvicorn only watches backend files
    original_cwd = os.getcwd()
    os.chdir(backend_dir)

    try:
        uvicorn.run(
            "main:app",
            host=settings.host,
            port=settings.port,
            reload=False,
            log_level=settings.log_level.lower(),
            access_log=True,
        )
    finally:
        os.chdir(original_cwd)


if __name__ == "__main__":
    main()
