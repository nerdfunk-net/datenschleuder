"""Version control and lifecycle management for NiFi process groups."""

import logging
from typing import Optional

from nipyapi import versioning, canvas

logger = logging.getLogger(__name__)


def stop_version_control(pg_id: str) -> None:
    """Stop version control for a deployed process group."""
    try:
        pg = canvas.get_process_group(pg_id, "id")
        if not pg:
            return

        if not hasattr(pg, "component") or not hasattr(
            pg.component, "version_control_information"
        ):
            return

        if not pg.component.version_control_information:
            return

        versioning.stop_flow_ver(pg, refresh=True)
        logger.info("Version control stopped for process group %s", pg_id)

    except Exception as e:
        logger.warning("Could not stop version control: %s", e)


def start_process_group(pg_id: str) -> None:
    """Start all components in a process group.

    Note: Components in DISABLED or INVALID states will not be started,
    as reported by nipyapi.
    """
    try:
        result = canvas.schedule_process_group(
            pg_id, scheduled=True, identifier_type="id"
        )
        if result:
            logger.info("Process group %s started", pg_id)
        else:
            logger.warning(
                "Process group %s may not have fully started (some components"
                " may be in invalid states)",
                pg_id,
            )
    except Exception as e:
        logger.error("Failed to start process group %s: %s", pg_id, e)
        raise


def disable_process_group(pg_id: str) -> None:
    """Disable all components in a process group."""
    try:
        from nipyapi.nifi import (
            ProcessorsApi,
            ProcessorRunStatusEntity,
            RevisionDTO,
            InputPortsApi,
            OutputPortsApi,
            PortRunStatusEntity,
        )

        processors = canvas.list_all_processors(pg_id)
        processors_api = ProcessorsApi()

        for processor in processors:
            try:
                current_state = (
                    processor.status.run_status
                    if hasattr(processor, "status")
                    else "UNKNOWN"
                )
                if current_state == "DISABLED":
                    continue

                run_status = ProcessorRunStatusEntity(
                    revision=RevisionDTO(version=processor.revision.version),
                    state="DISABLED",
                )
                processors_api.update_run_status4(body=run_status, id=processor.id)
            except Exception:
                pass

        input_ports = canvas.list_all_input_ports(pg_id)
        input_ports_api = InputPortsApi()

        for port in input_ports:
            try:
                current_state = (
                    port.status.run_status if hasattr(port, "status") else "UNKNOWN"
                )
                if current_state == "DISABLED":
                    continue

                run_status = PortRunStatusEntity(
                    revision=RevisionDTO(version=port.revision.version),
                    state="DISABLED",
                )
                input_ports_api.update_run_status2(body=run_status, id=port.id)
            except Exception:
                pass

        output_ports = canvas.list_all_output_ports(pg_id)
        output_ports_api = OutputPortsApi()

        for port in output_ports:
            try:
                current_state = (
                    port.status.run_status if hasattr(port, "status") else "UNKNOWN"
                )
                if current_state == "DISABLED":
                    continue

                run_status = PortRunStatusEntity(
                    revision=RevisionDTO(version=port.revision.version),
                    state="DISABLED",
                )
                output_ports_api.update_run_status3(body=run_status, id=port.id)
            except Exception:
                pass

        logger.info("Process group %s disabled", pg_id)

    except Exception as e:
        logger.warning("Could not disable process group: %s", e)


def assign_parameter_context(pg_id: str, parameter_context_name: Optional[str]) -> None:
    """Assign parameter context to a process group by name lookup."""
    if not parameter_context_name:
        return

    try:
        import nipyapi
        from nipyapi.nifi import ProcessGroupsApi

        param_context = nipyapi.parameters.get_parameter_context(
            identifier=parameter_context_name, identifier_type="name", greedy=True
        )

        if not param_context:
            logger.warning("Parameter context '%s' not found", parameter_context_name)
            return

        param_context_id = param_context.id if hasattr(param_context, "id") else None
        if not param_context_id:
            return

        pg_api = ProcessGroupsApi()
        pg = pg_api.get_process_group(id=pg_id)

        body = {
            "revision": {
                "version": pg.revision.version
                if hasattr(pg.revision, "version")
                else 0,
            },
            "component": {
                "id": pg_id,
                "parameterContext": {"id": param_context_id},
            },
        }

        pg_api.update_process_group(id=pg_id, body=body)
        logger.info(
            "Parameter context '%s' assigned to process group %s",
            parameter_context_name,
            pg_id,
        )

    except Exception as e:
        logger.warning("Could not assign parameter context: %s", e)
