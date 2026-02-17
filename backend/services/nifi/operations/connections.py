"""NiFi connection testing operations - pure nipyapi logic."""

import logging
from typing import Dict, Any

from nipyapi.nifi import FlowApi

logger = logging.getLogger(__name__)


def test_connection() -> Dict[str, Any]:
    """Test the currently configured NiFi connection."""
    flow_api = FlowApi()
    controller_status = flow_api.get_controller_status()

    version = "unknown"
    if hasattr(controller_status, "controller_status"):
        if hasattr(controller_status.controller_status, "version"):
            version = controller_status.controller_status.version

    return {
        "connected": True,
        "version": version,
    }
