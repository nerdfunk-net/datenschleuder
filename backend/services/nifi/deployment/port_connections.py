"""Port auto-wiring for NiFi flow deployment."""

import logging
import time

from nipyapi import canvas
from nipyapi.nifi import ProcessGroupsApi

logger = logging.getLogger(__name__)


def auto_connect_ports(
    pg_id: str, parent_pg_id: str, last_hierarchy_attr: str = "cn"
) -> None:
    """Auto-connect input and output ports between child and parent process groups."""
    pg_api = ProcessGroupsApi()

    # Connect output ports
    _auto_connect_port(pg_api, pg_id, parent_pg_id, "output")

    # Connect input ports
    _connect_input_ports(pg_api, pg_id, parent_pg_id, last_hierarchy_attr)


def _auto_connect_port(
    pg_api: ProcessGroupsApi,
    child_pg_id: str,
    parent_pg_id: str,
    port_type: str,
) -> None:
    """Connect ports between child and parent process groups."""
    try:
        if port_type == "output":
            child_response = pg_api.get_output_ports(id=child_pg_id)
            child_ports = (
                child_response.output_ports
                if hasattr(child_response, "output_ports")
                else []
            )
            parent_response = pg_api.get_output_ports(id=parent_pg_id)
            parent_ports = (
                parent_response.output_ports
                if hasattr(parent_response, "output_ports")
                else []
            )
        else:
            child_response = pg_api.get_input_ports(id=child_pg_id)
            child_ports = (
                child_response.input_ports
                if hasattr(child_response, "input_ports")
                else []
            )
            parent_response = pg_api.get_input_ports(id=parent_pg_id)
            parent_ports = (
                parent_response.input_ports
                if hasattr(parent_response, "input_ports")
                else []
            )

        if not child_ports or not parent_ports:
            return

        child_port = child_ports[0]
        parent_port = parent_ports[0]

        if port_type == "output":
            source_port, target_port = child_port, parent_port
        else:
            source_port, target_port = parent_port, child_port

        source_name = (
            source_port.component.name
            if hasattr(source_port, "component")
            else "Unknown"
        )
        target_name = (
            target_port.component.name
            if hasattr(target_port, "component")
            else "Unknown"
        )

        canvas.create_connection(
            source=source_port,
            target=target_port,
            name="%s to %s" % (source_name, target_name),
        )
        logger.info(
            "Created %s connection: '%s' -> '%s'",
            port_type,
            source_name,
            target_name,
        )

    except Exception as connect_error:
        logger.warning("Could not auto-connect %s ports: %s", port_type, connect_error)


def _connect_input_ports(
    pg_api: ProcessGroupsApi,
    child_pg_id: str,
    parent_pg_id: str,
    last_hierarchy_attr: str,
) -> None:
    """Connect input ports with RouteOnAttribute support."""
    try:
        child_response = pg_api.get_input_ports(id=child_pg_id)
        child_ports = (
            child_response.input_ports if hasattr(child_response, "input_ports") else []
        )

        if not child_ports:
            return

        child_port = child_ports[0]

        # Look for RouteOnAttribute processor in parent
        processors_list = canvas.list_all_processors(pg_id=parent_pg_id)
        route_processor = None

        if processors_list:
            for processor in processors_list:
                processor_type = (
                    processor.component.type
                    if hasattr(processor, "component")
                    and hasattr(processor.component, "type")
                    else None
                )
                processor_pg_id = (
                    processor.component.parent_group_id
                    if hasattr(processor, "component")
                    and hasattr(processor.component, "parent_group_id")
                    else None
                )

                if processor_pg_id != parent_pg_id:
                    continue

                if (
                    processor_type
                    == "org.apache.nifi.processors.standard.RouteOnAttribute"
                ):
                    route_processor = processor
                    break

        if not route_processor:
            # Fallback: parent INPUT port -> child INPUT port
            parent_input_response = pg_api.get_input_ports(id=parent_pg_id)
            parent_input_ports = (
                parent_input_response.input_ports
                if hasattr(parent_input_response, "input_ports")
                else []
            )

            if parent_input_ports:
                parent_input_port = parent_input_ports[0]
                parent_name = (
                    parent_input_port.component.name
                    if hasattr(parent_input_port, "component")
                    else "Unknown"
                )
                child_name = (
                    child_port.component.name
                    if hasattr(child_port, "component")
                    else "Unknown"
                )

                canvas.create_connection(
                    source=parent_input_port,
                    target=child_port,
                    name="%s to %s" % (parent_name, child_name),
                )
                logger.info("Created input connection (port-to-port)")
            return

        # RouteOnAttribute processor found - configure and connect
        child_pg = pg_api.get_process_group(id=child_pg_id)
        child_pg_name = (
            child_pg.component.name if hasattr(child_pg, "component") else "Unknown"
        )

        route_processor_id = route_processor.id
        route_config = canvas.get_processor(route_processor_id, "id")
        config_obj = (
            route_config.component.config
            if hasattr(route_config, "component")
            else None
        )
        properties = {}

        if config_obj and hasattr(config_obj, "properties") and config_obj.properties:
            properties = dict(config_obj.properties)

        property_exists = child_pg_name in properties
        routing_strategy = properties.get("Routing Strategy", "")
        needs_update = (
            not property_exists or routing_strategy != "Route to Property name"
        )

        if needs_update:
            current_state = (
                route_processor.component.state
                if hasattr(route_processor, "component")
                else "STOPPED"
            )

            if current_state == "RUNNING":
                try:
                    canvas.schedule_processor(route_processor, scheduled=False)
                    time.sleep(0.5)
                except Exception:
                    pass

            if not property_exists:
                property_value = "${%s:equalsIgnoreCase('%s')}" % (
                    last_hierarchy_attr,
                    child_pg_name,
                )
                properties[child_pg_name] = property_value

            if routing_strategy != "Route to Property name":
                properties["Routing Strategy"] = "Route to Property name"

            from nipyapi.nifi import ProcessorConfigDTO

            updated_config = ProcessorConfigDTO(properties=properties)
            canvas.update_processor(
                processor=route_processor,
                update=updated_config,
            )

            time.sleep(0.5)
            route_processor = canvas.get_processor(route_processor_id, "id")

            if current_state == "RUNNING":
                try:
                    canvas.schedule_processor(route_processor, scheduled=True)
                except Exception:
                    pass
        else:
            route_processor = canvas.get_processor(route_processor_id, "id")

        canvas.create_connection(
            source=route_processor,
            target=child_port,
            name=child_pg_name,
            relationships=[child_pg_name],
        )
        logger.info("Created RouteOnAttribute connection for '%s'", child_pg_name)

    except Exception as connect_error:
        logger.warning("Could not auto-connect input ports: %s", connect_error)
