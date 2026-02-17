"""NiFi processor operations - pure nipyapi logic."""

import logging
from typing import Dict, Any, Optional

from nipyapi import canvas

logger = logging.getLogger(__name__)


def get_processor_configuration(processor_id: str) -> Dict[str, Any]:
    """Get processor configuration details."""
    processor = canvas.get_processor(processor_id, "id")

    if not processor:
        raise ValueError("Processor '%s' not found" % processor_id)

    component = processor.component
    config_obj = component.config

    properties = {}
    if config_obj and config_obj.properties:
        properties = dict(config_obj.properties)

    return {
        "id": component.id,
        "name": component.name,
        "type": component.type,
        "state": component.state,
        "properties": properties,
        "scheduling_period": config_obj.scheduling_period if config_obj else None,
        "scheduling_strategy": config_obj.scheduling_strategy if config_obj else None,
        "execution_node": config_obj.execution_node if config_obj else None,
        "penalty_duration": config_obj.penalty_duration if config_obj else None,
        "yield_duration": config_obj.yield_duration if config_obj else None,
        "bulletin_level": config_obj.bulletin_level if config_obj else None,
        "comments": config_obj.comments if config_obj else None,
        "auto_terminated_relationships": (
            list(config_obj.auto_terminated_relationships)
            if config_obj and config_obj.auto_terminated_relationships
            else []
        ),
        "run_duration_millis": config_obj.run_duration_millis if config_obj else None,
        "concurrent_tasks": (
            config_obj.concurrently_schedulable_task_count if config_obj else None
        ),
    }


def update_processor_configuration(
    processor_id: str, config_update: Dict[str, Any]
) -> Dict[str, str]:
    """Update processor configuration."""
    processor = canvas.get_processor(processor_id, "id")

    if not processor:
        raise ValueError("Processor '%s' not found" % processor_id)

    # Filter out None values
    update_dict = {k: v for k, v in config_update.items() if v is not None}

    updated_processor = canvas.update_processor(
        processor=processor,
        update=update_dict,
    )

    if not updated_processor:
        raise ValueError("Failed to update processor configuration")

    return {
        "processor_id": updated_processor.component.id,
        "processor_name": updated_processor.component.name,
    }
