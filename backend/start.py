#!/usr/bin/env python3
"""
Datenschleuder Backend Startup Script
Loads configuration and starts the FastAPI server.

Environment Variables:
    INSTALL_CERTIFICATE_FILES: Set to 'true' to install certificates from
        config/oidc/ to the system CA store on startup (for Docker environments).
"""

import shutil
import subprocess
import uvicorn
import os
from pathlib import Path
from config import settings
import logging


def install_certificates():
    """
    Install certificates from config/oidc/ to the system CA store.

    This copies all .crt files from config/oidc/ to /usr/local/share/ca-certificates/
    and runs update-ca-certificates to update the system trust store.

    Only runs when DATENSCHLEUDER_COPY_CERTIFICATES environment variable is set to 'true'.
    """
    if os.environ.get("INSTALL_CERTIFICATE_FILES", "false").lower() != "true":
        return

    print("Installing certificates from config/oidc/...")

    backend_dir = os.path.dirname(os.path.abspath(__file__))
    config_certs_dir = Path(backend_dir) / ".." / "config" / "oidc"
    system_ca_dir = Path("/usr/local/share/ca-certificates")

    if not config_certs_dir.exists():
        print(f"  Certificate directory not found: {config_certs_dir}")
        return

    cert_files = list(config_certs_dir.glob("*.crt"))
    if not cert_files:
        print("  No .crt files found in config/oidc/")
        return

    try:
        system_ca_dir.mkdir(parents=True, exist_ok=True)
    except PermissionError:
        print(f"  ERROR: Permission denied creating {system_ca_dir}")
        return

    copied_count = 0
    for cert_file in cert_files:
        try:
            dest_path = system_ca_dir / cert_file.name
            shutil.copy2(cert_file, dest_path)
            print(f"  Copied: {cert_file.name}")
            copied_count += 1
        except PermissionError:
            print(f"  ERROR: Permission denied copying {cert_file.name}")
        except Exception as e:
            print(f"  ERROR: Failed to copy {cert_file.name}: {e}")

    if copied_count == 0:
        print("  No certificates were copied")
        return

    print("  Running update-ca-certificates...")
    try:
        result = subprocess.run(
            ["update-ca-certificates"],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode == 0:
            print(f"  Successfully installed {copied_count} certificate(s)")
            if result.stdout:
                for line in result.stdout.strip().split("\n"):
                    if line.strip():
                        print(f"    {line}")
        else:
            print(f"  WARNING: update-ca-certificates returned {result.returncode}")
            if result.stderr:
                print(f"    {result.stderr}")
    except FileNotFoundError:
        print("  WARNING: update-ca-certificates not found (not running in Docker?)")
    except subprocess.TimeoutExpired:
        print("  WARNING: update-ca-certificates timed out")
    except Exception as e:
        print(f"  WARNING: Failed to run update-ca-certificates: {e}")


def main():
    """Start the FastAPI server with configuration."""

    # Install certificates if enabled (for Docker environments)
    install_certificates()

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
    logger.debug("DEBUG: Logging configured at %s level", settings.log_level)
    logger.debug("DEBUG: Environment LOG_LEVEL = %s", os.getenv("LOG_LEVEL", "not set"))

    # Log startup information
    logger.info("Starting Datenschleuder Backend Server")
    logger.info("Server: %s:%s", settings.host, settings.port)
    logger.info("Log Level: %s", settings.log_level)
    logger.info("Data Directory: %s", settings.data_directory)

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
