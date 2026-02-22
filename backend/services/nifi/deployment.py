"""NiFi deployment service for handling flow deployment operations."""

import time
import logging
from typing import Optional, Tuple, Any

from nipyapi import versioning, canvas
from nipyapi.nifi import ProcessGroupsApi

logger = logging.getLogger(__name__)


class NiFiDeploymentService:
    """Service class for NiFi flow deployment operations."""

    def __init__(self, last_hierarchy_attr: str = "cn") -> None:
        self.last_hierarchy_attr = last_hierarchy_attr

    def get_bucket_and_flow_identifiers(
        self, bucket_id: str, flow_id: str, registry_client_id: str
    ) -> Tuple[str, str]:
        """Get bucket and flow identifiers from registry."""
        reg_client = versioning.get_registry_client(registry_client_id, "id")
        reg_client_name = (
            reg_client.component.name
            if hasattr(reg_client, "component")
            else registry_client_id
        )

        is_github_registry = (
            "github" in reg_client_name.lower() if reg_client_name else False
        )

        if is_github_registry:
            logger.info("GitHub registry detected, using provided IDs directly")
            return bucket_id, flow_id

        try:
            bucket = versioning.get_registry_bucket(bucket_id)
            flow = versioning.get_flow_in_bucket(
                bucket.identifier, identifier=flow_id
            )
            return bucket.identifier, flow.identifier
        except Exception as lookup_error:
            logger.warning("Could not lookup bucket/flow, using provided values: %s", lookup_error)
            return bucket_id, flow_id

    def get_deploy_version(
        self,
        requested_version: Optional[Any],
        reg_client_id: str,
        bucket_identifier: str,
        flow_identifier: str,
    ) -> Optional[int]:
        """Determine version to deploy."""
        if requested_version is not None:
            return requested_version

        logger.info("No version specified - fetching latest version explicitly...")
        try:
            flow_versions = versioning.list_flow_versions(
                bucket_id=bucket_identifier,
                flow_id=flow_identifier,
                registry_id=reg_client_id,
                service="nifi",
            )

            if flow_versions and hasattr(
                flow_versions, "versioned_flow_snapshot_metadata_set"
            ):
                versions_list = flow_versions.versioned_flow_snapshot_metadata_set
                if versions_list:
                    sorted_versions = sorted(
                        versions_list,
                        key=lambda x: x.versioned_flow_snapshot_metadata.timestamp,
                        reverse=True,
                    )
                    deploy_version = sorted_versions[0].versioned_flow_snapshot_metadata.version
                    logger.info("Latest version selected: %s", deploy_version)
                    return deploy_version

        except Exception as version_error:
            logger.warning("Could not fetch latest version: %s", version_error)

        return None

    def check_existing_process_group(
        self, process_group_name: Optional[str], parent_pg_id: str
    ) -> None:
        """Check if process group with same name already exists. Raises if exists."""
        if not process_group_name:
            return

        pg_api = ProcessGroupsApi()
        try:
            parent_pg_response = pg_api.get_process_groups(id=parent_pg_id)

            if hasattr(parent_pg_response, "process_groups"):
                for pg in parent_pg_response.process_groups:
                    if (
                        hasattr(pg, "component")
                        and hasattr(pg.component, "name")
                        and pg.component.name == process_group_name
                    ):
                        raise ValueError(
                            "Process group '%s' already exists (id: %s)"
                            % (process_group_name, pg.id)
                        )
        except ValueError:
            raise
        except Exception as check_error:
            logger.warning("Could not check for existing process group: %s", check_error)

    def deploy_flow_version(
        self,
        parent_pg_id: str,
        bucket_identifier: str,
        flow_identifier: str,
        reg_client_id: str,
        deploy_version: Optional[int],
        x_position: int = 0,
        y_position: int = 0,
    ) -> Any:
        """Deploy flow version to NiFi."""
        logger.info("Deploying flow - Bucket: %s, Flow: %s, Version: %s",
                     bucket_identifier, flow_identifier, deploy_version)

        deployed_pg = versioning.deploy_flow_version(
            parent_id=parent_pg_id,
            location=(float(x_position), float(y_position)),
            bucket_id=bucket_identifier,
            flow_id=flow_identifier,
            reg_client_id=reg_client_id,
            version=deploy_version,
        )

        logger.info("Successfully deployed process group: %s", deployed_pg.id)
        return deployed_pg

    def rename_process_group(self, deployed_pg: Any, new_name: str) -> Tuple[str, str]:
        """Rename deployed process group."""
        pg_id = deployed_pg.id if hasattr(deployed_pg, "id") else None
        pg_name = (
            deployed_pg.component.name
            if hasattr(deployed_pg, "component")
            and hasattr(deployed_pg.component, "name")
            else None
        )

        if new_name and pg_id:
            try:
                updated_pg = canvas.update_process_group(
                    pg=deployed_pg, update={"name": new_name}
                )
                pg_name = updated_pg.component.name
                logger.info("Renamed process group to '%s'", pg_name)
            except Exception as rename_error:
                logger.warning("Could not rename process group: %s", rename_error)

        return pg_id, pg_name

    def extract_deployed_version(self, deployed_pg: Any) -> Optional[int]:
        """Extract version from deployed process group."""
        if hasattr(deployed_pg, "component") and hasattr(
            deployed_pg.component, "version_control_information"
        ):
            vci = deployed_pg.component.version_control_information
            if vci and hasattr(vci, "version"):
                return vci.version
        return None

    def auto_connect_ports(self, pg_id: str, parent_pg_id: str) -> None:
        """Auto-connect input and output ports between child and parent process groups."""
        pg_api = ProcessGroupsApi()

        # Connect output ports
        self._auto_connect_port(pg_api, pg_id, parent_pg_id, "output")

        # Connect input ports
        self._connect_input_ports(pg_api, pg_id, parent_pg_id)

    def _auto_connect_port(
        self,
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
            logger.info("Created %s connection: '%s' -> '%s'",
                        port_type, source_name, target_name)

        except Exception as connect_error:
            logger.warning("Could not auto-connect %s ports: %s", port_type, connect_error)

    def _connect_input_ports(
        self, pg_api: ProcessGroupsApi, child_pg_id: str, parent_pg_id: str
    ) -> None:
        """Connect input ports with RouteOnAttribute support."""
        try:
            child_response = pg_api.get_input_ports(id=child_pg_id)
            child_ports = (
                child_response.input_ports
                if hasattr(child_response, "input_ports")
                else []
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
                child_pg.component.name
                if hasattr(child_pg, "component")
                else "Unknown"
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
            needs_update = not property_exists or routing_strategy != "Route to Property name"

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
                    property_value = (
                        "${%s:equalsIgnoreCase('%s')}"
                        % (self.last_hierarchy_attr, child_pg_name)
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

    def stop_version_control(self, pg_id: str) -> None:
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

    def start_process_group(self, pg_id: str) -> None:
        """Start all components in a process group.

        Note: Components in DISABLED or INVALID states will not be started,
        as reported by nipyapi.
        """
        try:
            result = canvas.schedule_process_group(pg_id, scheduled=True, identifier_type="id")
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

    def disable_process_group(self, pg_id: str) -> None:
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

    def assign_parameter_context(
        self, pg_id: str, parameter_context_name: Optional[str]
    ) -> None:
        """Assign parameter context to a process group by name lookup."""
        if not parameter_context_name:
            return

        try:
            import nipyapi

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


def find_or_create_process_group_by_path(path: str) -> str:
    """Find process group ID by path, creating missing parent process groups if needed."""
    if not path or path == "/" or path == "":
        return canvas.get_root_pg_id()

    path_parts = [p.strip() for p in path.split("/") if p.strip()]
    if not path_parts:
        return canvas.get_root_pg_id()

    root_pg_id = canvas.get_root_pg_id()
    root_pg = canvas.get_process_group(root_pg_id, "id")
    root_pg_name = (
        root_pg.component.name
        if hasattr(root_pg, "component") and hasattr(root_pg.component, "name")
        else None
    )

    if root_pg_name and path_parts[0] == root_pg_name:
        path_parts = path_parts[1:]
        if not path_parts:
            return root_pg_id

    all_pgs = canvas.list_all_process_groups(root_pg_id)

    pg_map = {}
    for pg in all_pgs:
        pg_map[pg.id] = {
            "id": pg.id,
            "name": pg.component.name,
            "parent_group_id": pg.component.parent_group_id,
        }

    def build_path_parts(pg_id):
        parts = []
        current_id = pg_id
        while current_id in pg_map and current_id != root_pg_id:
            pg_info = pg_map[current_id]
            parts.insert(0, pg_info["name"])
            current_id = pg_info["parent_group_id"]
        return parts

    for pg_id, pg_info in pg_map.items():
        pg_path_parts = build_path_parts(pg_id)
        if pg_path_parts == path_parts:
            return pg_id

    current_parent_id = root_pg_id
    existing_depth = 0

    for i in range(len(path_parts)):
        partial_path = path_parts[: i + 1]
        found = False
        for pg_id, pg_info in pg_map.items():
            pg_path_parts = build_path_parts(pg_id)
            if pg_path_parts == partial_path:
                current_parent_id = pg_id
                existing_depth = i + 1
                found = True
                break
        if not found:
            break

    for i in range(existing_depth, len(path_parts)):
        pg_name = path_parts[i]
        new_pg = canvas.create_process_group(
            parent_pg=canvas.get_process_group(current_parent_id, "id"),
            new_pg_name=pg_name,
            location=(0.0, 0.0),
        )
        current_parent_id = new_pg.id
        logger.info("Created process group '%s' (ID: %s)", pg_name, current_parent_id)

    return current_parent_id
