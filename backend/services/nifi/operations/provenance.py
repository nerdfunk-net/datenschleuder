"""Provenance operations — wraps nipyapi ProvenanceApi."""
import time

import nipyapi.nifi

_POLL_INTERVAL = 0.5  # seconds between polls
_POLL_TIMEOUT = 30.0  # seconds before giving up


def get_component_provenance_events(
    component_id: str,
    max_results: int = 100,
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict:
    """
    Submit a provenance query filtered by component ID, poll until complete,
    clean up, and return the provenance events as a dict.

    component_id: NiFi component UUID (ProcessorID search term — works for
                  processors, ports, and other components)
    """
    api = nipyapi.nifi.ProvenanceApi()

    search_value = nipyapi.nifi.ProvenanceSearchValueDTO(value=component_id)
    request_dto = nipyapi.nifi.ProvenanceRequestDTO(
        search_terms={"ProcessorID": search_value},
        max_results=max_results,
        incremental_results=False,
    )
    if start_date:
        request_dto.start_date = start_date
    if end_date:
        request_dto.end_date = end_date

    body = nipyapi.nifi.ProvenanceEntity(
        provenance=nipyapi.nifi.ProvenanceDTO(request=request_dto)
    )

    result = api.submit_provenance_request(body)
    query_id = result.provenance.id

    try:
        deadline = time.monotonic() + _POLL_TIMEOUT
        while True:
            result = api.get_provenance(query_id)
            if result.provenance.finished:
                break
            if time.monotonic() > deadline:
                raise TimeoutError(
                    "Provenance query timed out after %ds" % _POLL_TIMEOUT
                )
            time.sleep(_POLL_INTERVAL)

        return result.to_dict() if hasattr(result, "to_dict") else result
    finally:
        try:
            api.delete_provenance(query_id)
        except Exception:
            pass


def get_flow_lineage_by_filename(
    filename: str,
    max_results: int = 10,
    start_date: str | None = None,
    end_date: str | None = None,
) -> list[dict]:
    """
    Find FlowFile UUIDs by filename via a provenance search, then return
    lineage for each unique UUID found.

    NiFi keeps provenance data for a limited window (default ~24 h).
    Returns a list of lineage result dicts (one per unique FlowFile UUID).
    Raises ValueError if no matching events are found.
    """
    api = nipyapi.nifi.ProvenanceApi()

    search_value = nipyapi.nifi.ProvenanceSearchValueDTO(value=filename)
    request_dto = nipyapi.nifi.ProvenanceRequestDTO(
        search_terms={"Filename": search_value},
        max_results=max_results,
        incremental_results=False,
    )
    if start_date:
        request_dto.start_date = start_date
    if end_date:
        request_dto.end_date = end_date

    body = nipyapi.nifi.ProvenanceEntity(
        provenance=nipyapi.nifi.ProvenanceDTO(request=request_dto)
    )

    result = api.submit_provenance_request(body)
    query_id = result.provenance.id

    try:
        deadline = time.monotonic() + _POLL_TIMEOUT
        while True:
            result = api.get_provenance(query_id)
            if result.provenance.finished:
                break
            if time.monotonic() > deadline:
                raise TimeoutError(
                    "Provenance query timed out after %ds" % _POLL_TIMEOUT
                )
            time.sleep(_POLL_INTERVAL)

        events = (
            result.provenance.results.provenance_events
            if result.provenance.results
            else []
        ) or []

        seen: set[str] = set()
        uuids: list[str] = []
        for event in events:
            uuid = getattr(event, "flow_file_uuid", None)
            if uuid and uuid not in seen:
                seen.add(uuid)
                uuids.append(uuid)
    finally:
        try:
            api.delete_provenance(query_id)
        except Exception:
            pass

    if not uuids:
        raise ValueError(
            "No provenance events found for filename '%s'" % filename
        )

    return [get_flow_lineage(uuid) for uuid in uuids]


def get_flow_lineage(
    flow_file_uuid: str,
    component_id: str | None = None,
) -> dict:
    """
    Trace the complete path of a FlowFile through the NiFi flow.

    Submits a lineage request for the given FlowFile UUID, polls until
    complete, cleans up, and returns both the raw lineage graph and a
    simplified ordered_path list sorted by event timestamp.

    flow_file_uuid: UUID of the FlowFile to trace
    component_id:   Optional component UUID used to annotate which node
                    was the starting point of interest; not required by
                    the NiFi lineage API itself.
    """
    api = nipyapi.nifi.ProvenanceApi()

    body = nipyapi.nifi.LineageEntity(
        lineage=nipyapi.nifi.LineageDTO(
            request=nipyapi.nifi.LineageRequestDTO(
                lineage_request_type="FLOWFILE",
                uuid=flow_file_uuid,
            )
        )
    )

    result = api.submit_lineage_request(body)
    lineage_id = result.lineage.id

    try:
        deadline = time.monotonic() + _POLL_TIMEOUT
        while True:
            result = api.get_lineage(lineage_id)
            if result.lineage.finished:
                break
            if time.monotonic() > deadline:
                raise TimeoutError(
                    "Lineage query timed out after %ds" % _POLL_TIMEOUT
                )
            time.sleep(_POLL_INTERVAL)

        nodes = result.lineage.results.nodes or []
        links = result.lineage.results.links or []

        # Lineage nodes only carry event IDs and timestamps — no component info.
        # Fetch each event individually to get component_id / component_name.
        events_api = nipyapi.nifi.ProvenanceEventsApi()

        # Virtual source/sink nodes use the FlowFile UUID as their id — skip them.
        event_ids = [
            node.id
            for node in nodes
            if node.id != flow_file_uuid
        ]

        def _fetch_event(event_id: str) -> dict:
            detail = events_api.get_provenance_event(id=int(event_id))
            e = detail.provenance_event
            cid = getattr(e, "component_id", None)
            return {
                "event_id": event_id,
                "component_id": cid,
                "component_name": getattr(e, "component_name", None),
                "component_type": getattr(e, "component_type", None),
                "event_type": getattr(e, "event_type", None),
                "timestamp": getattr(e, "event_time", None),
                "millis": getattr(e, "event_duration", None),  # enriched below
                "is_starting_component": cid == component_id if component_id else False,
            }

        enriched = []
        for node in sorted(nodes, key=lambda n: n.millis or 0):
            if node.id == flow_file_uuid:
                continue
            entry = _fetch_event(node.id)
            entry["millis"] = node.millis  # use lineage millis for ordering
            entry["timestamp"] = entry["timestamp"] or node.timestamp
            enriched.append(entry)

        raw_links = []
        for lnk in links:
            d = lnk.to_dict() if hasattr(lnk, "to_dict") else {}
            raw_links.append({
                "source_id": d.get("source_id") or getattr(lnk, "source_id", None),
                "target_id": d.get("target_id") or getattr(lnk, "target_id", None),
            })

        return {
            "flow_file_uuid": flow_file_uuid,
            "component_id": component_id,
            "ordered_path": enriched,
            "links": raw_links,
            "event_count": len(enriched),
        }
    finally:
        try:
            api.delete_lineage(lineage_id)
        except Exception:
            pass
