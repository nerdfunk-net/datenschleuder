"""NiFi connection testing operations - pure nipyapi logic."""

import logging
from typing import Dict, Any

from nipyapi import config
from nipyapi.nifi import FlowApi

logger = logging.getLogger(__name__)


def test_connection() -> Dict[str, Any]:
    """Test the currently configured NiFi connection."""
    host = config.nifi_config.host
    logger.debug("Testing NiFi connection to: %s", host)

    try:
        flow_api = FlowApi()
        controller_status = flow_api.get_controller_status()
    except Exception as e:
        logger.error("NiFi connection failed to %s: %s", host, str(e))
        raise

    version = "unknown"
    if hasattr(controller_status, "controller_status"):
        if hasattr(controller_status.controller_status, "version"):
            version = controller_status.controller_status.version

    logger.info("NiFi connection successful to %s (version: %s)", host, version)
    return {
        "connected": True,
        "version": version,
    }
