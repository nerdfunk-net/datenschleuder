"""
Export-flows job executor.

Fetches NiFi flows from the local database and writes them as a JSON or CSV
file into a git repository.
"""

import csv
import io
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _flows_to_csv(flows: List[dict]) -> str:
    """Serialise a list of flow dicts to CSV.

    Hierarchy values (nested under the ``hierarchy_values`` key) are flattened
    into ``src_<attr>`` / ``dest_<attr>`` columns so that the CSV is fully
    flat.
    """
    if not flows:
        return ""

    # Collect all attribute names from the first flow's hierarchy_values
    first = flows[0]
    hierarchy_attrs: List[str] = list((first.get("hierarchy_values") or {}).keys())

    # Build fieldnames: static fields first, then flattened hierarchy columns
    static_fields = [
        "id",
        "name",
        "contact",
        "active",
        "src_connection_param",
        "dest_connection_param",
        "src_template_id",
        "dest_template_id",
        "description",
        "creator_name",
        "created_at",
    ]
    hierarchy_fields: List[str] = []
    for attr in hierarchy_attrs:
        hierarchy_fields.append("src_" + attr.lower())
        hierarchy_fields.append("dest_" + attr.lower())

    fieldnames = static_fields + hierarchy_fields

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()

    for flow in flows:
        row: Dict[str, Any] = {k: flow.get(k) for k in static_fields}
        for attr in hierarchy_attrs:
            vals = (flow.get("hierarchy_values") or {}).get(attr, {})
            row["src_" + attr.lower()] = vals.get("source", "")
            row["dest_" + attr.lower()] = vals.get("destination", "")
        writer.writerow(row)

    return output.getvalue()


def _ensure_extension(filename: str, export_type: str) -> str:
    """Append the correct extension to *filename* if it is missing."""
    expected_ext = "." + export_type.lower()
    if not filename.lower().endswith(expected_ext):
        return filename + expected_ext
    return filename


# ---------------------------------------------------------------------------
# Public executor
# ---------------------------------------------------------------------------


def execute_export_flows(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Execute an export_flows job.

    Reads NiFi flows from the local database, serialises them to JSON or CSV,
    and commits the result to the configured git repository.

    Args:
        schedule_id:    Job schedule ID (informational).
        credential_id:  Not used for export_flows.
        job_parameters: Runtime overrides; recognised keys mirror the template fields.
        target_devices: Not used for export_flows.
        task_context:   Celery task context (used for progress updates).
        template:       Resolved job template dict.
        job_run_id:     Job run ID for result tracking (informational).

    Returns:
        dict with keys ``success``, ``exported_count``, ``flows``,
        ``export_type``, ``filename``, ``git_repo_name``, ``commit_sha``,
        ``nifi_clusters``, and optionally ``error``.
    """
    from repositories.settings.git_repository_repository import GitRepositoryRepository
    from services.nifi import nifi_flow_service
    from services.settings.git.service import GitService

    params = job_parameters or {}
    tmpl = template or {}

    # ------------------------------------------------------------------
    # 1. Resolve parameters
    # ------------------------------------------------------------------
    all_flows: bool = bool(
        params.get("export_flows_all_flows")
        if "export_flows_all_flows" in params
        else tmpl.get("export_flows_all_flows", True)
    )
    filters: dict = (
        params.get("export_flows_filters") or tmpl.get("export_flows_filters") or {}
    )
    git_repo_id: Optional[int] = (
        params.get("export_flows_git_repo_id") or tmpl.get("export_flows_git_repo_id")
    )
    filename_raw: str = (
        params.get("export_flows_filename") or tmpl.get("export_flows_filename") or "nifi_flows"
    )
    export_type: str = (
        params.get("export_flows_export_type")
        or tmpl.get("export_flows_export_type")
        or "json"
    ).lower()

    nifi_cluster_ids = (
        params.get("export_flows_nifi_cluster_ids")
        or tmpl.get("export_flows_nifi_cluster_ids")
    )

    push_to_git: bool = bool(
        params.get("export_flows_push_to_git")
        if "export_flows_push_to_git" in params
        else tmpl.get("export_flows_push_to_git", True)
    )

    # ------------------------------------------------------------------
    # 2. Resolve NiFi cluster label (informational only)
    # ------------------------------------------------------------------
    nifi_clusters_label = "all clusters"
    if nifi_cluster_ids:
        try:
            from repositories.nifi.nifi_cluster_repository import NifiClusterRepository
            cluster_repo = NifiClusterRepository()
            labels = []
            for cid in nifi_cluster_ids:
                clusters = cluster_repo.get_all()
                for c in clusters:
                    if c.id == cid:
                        labels.append(c.cluster_id or str(cid))
                        break
            if labels:
                nifi_clusters_label = ", ".join(labels)
        except Exception as exc:
            logger.warning("Could not resolve NiFi cluster labels: %s", exc)

    task_context.update_state(
        state="PROGRESS",
        meta={"current": 10, "total": 100, "status": "Fetching flows from database…"},
    )

    # ------------------------------------------------------------------
    # 3. Fetch flows
    # ------------------------------------------------------------------
    try:
        if all_flows or not filters:
            flows = nifi_flow_service.list_flows()
        else:
            flows = nifi_flow_service.get_filtered_flows(filters)
    except Exception as exc:
        logger.error("export_flows: failed to fetch flows: %s", exc, exc_info=True)
        return {
            "success": False,
            "exported_count": 0,
            "flows": [],
            "export_type": export_type,
            "filename": filename_raw,
            "git_repo_name": None,
            "commit_sha": None,
            "nifi_clusters": nifi_clusters_label,
            "error": "Failed to fetch flows: %s" % exc,
        }

    task_context.update_state(
        state="PROGRESS",
        meta={
            "current": 30,
            "total": 100,
            "status": "Serialising %d flow(s) as %s…" % (len(flows), export_type.upper()),
        },
    )

    # ------------------------------------------------------------------
    # 4. Serialise
    # ------------------------------------------------------------------
    try:
        if export_type == "csv":
            content = _flows_to_csv(flows)
        else:
            content = json.dumps(flows, indent=2, default=str)
    except Exception as exc:
        logger.error("export_flows: serialisation failed: %s", exc, exc_info=True)
        return {
            "success": False,
            "exported_count": len(flows),
            "flows": [],
            "export_type": export_type,
            "filename": filename_raw,
            "git_repo_name": None,
            "commit_sha": None,
            "nifi_clusters": nifi_clusters_label,
            "error": "Serialisation failed: %s" % exc,
        }

    filename = _ensure_extension(filename_raw, export_type)

    # ------------------------------------------------------------------
    # 5. Load git repository
    # ------------------------------------------------------------------
    if not git_repo_id:
        logger.error("export_flows: no git repository configured")
        return {
            "success": False,
            "exported_count": len(flows),
            "flows": [],
            "export_type": export_type,
            "filename": filename,
            "git_repo_name": None,
            "commit_sha": None,
            "nifi_clusters": nifi_clusters_label,
            "error": "No git repository configured for this export template",
        }

    try:
        git_repo_repository = GitRepositoryRepository()
        git_repo_model = git_repo_repository.get_by_id(git_repo_id)
        if git_repo_model is None:
            raise ValueError("Git repository with id %d not found" % git_repo_id)
        repository_dict = {
            "id": git_repo_model.id,
            "name": git_repo_model.name,
            "url": git_repo_model.url,
            "branch": git_repo_model.branch,
            "auth_type": getattr(git_repo_model, "auth_type", "token"),
            "credential_name": git_repo_model.credential_name,
            "path": getattr(git_repo_model, "path", None),
            "verify_ssl": getattr(git_repo_model, "verify_ssl", True),
            "git_author_name": getattr(git_repo_model, "git_author_name", None),
            "git_author_email": getattr(git_repo_model, "git_author_email", None),
        }
        git_repo_name = git_repo_model.name
    except Exception as exc:
        logger.error("export_flows: failed to load git repository: %s", exc, exc_info=True)
        return {
            "success": False,
            "exported_count": len(flows),
            "flows": [],
            "export_type": export_type,
            "filename": filename,
            "git_repo_name": None,
            "commit_sha": None,
            "nifi_clusters": nifi_clusters_label,
            "error": "Failed to load git repository: %s" % exc,
        }

    task_context.update_state(
        state="PROGRESS",
        meta={"current": 60, "total": 100, "status": "Writing file to git repository…"},
    )

    # ------------------------------------------------------------------
    # 6. Write file to cloned repo path
    # ------------------------------------------------------------------
    try:
        git_service = GitService()
        repo = git_service.open_or_clone(repository_dict)
        repo_path: Path = git_service.get_repo_path(repository_dict)

        # Parse directory component from filename.
        # "subdir/nifi_flows.json"  → write to repo_path/subdir/nifi_flows.json
        # "nifi_flows.json"         → write to repo_path/nifi_flows.json (root)
        filename_path = Path(filename)
        file_subdir = filename_path.parent
        base_filename = filename_path.name

        if str(file_subdir) != ".":
            target_dir = repo_path / file_subdir
            target_dir.mkdir(parents=True, exist_ok=True)
            abs_path = target_dir / base_filename
            relative_path = str(file_subdir / base_filename)
        else:
            abs_path = repo_path / base_filename
            relative_path = base_filename

        abs_path.write_text(content, encoding="utf-8")
        logger.info(
            "export_flows: wrote %d bytes to %s",
            len(content.encode("utf-8")),
            abs_path,
        )
    except Exception as exc:
        logger.error("export_flows: failed to write file: %s", exc, exc_info=True)
        return {
            "success": False,
            "exported_count": len(flows),
            "flows": [],
            "export_type": export_type,
            "filename": filename,
            "git_repo_name": git_repo_name,
            "commit_sha": None,
            "nifi_clusters": nifi_clusters_label,
            "error": "Failed to write file: %s" % exc,
        }

    # Serialise flows so that datetime fields don't break JSON encoding downstream
    serialisable_flows = json.loads(json.dumps(flows, default=str))

    # ------------------------------------------------------------------
    # 7. Commit and push (only when push_to_git is enabled)
    # ------------------------------------------------------------------
    commit_sha = None

    if not push_to_git:
        logger.info(
            "export_flows: push_to_git disabled – skipping commit/push for repo '%s'",
            git_repo_name,
        )
        task_context.update_state(
            state="PROGRESS",
            meta={"current": 100, "total": 100, "status": "Done – %d flow(s) exported (not pushed)" % len(flows)},
        )
    else:
        task_context.update_state(
            state="PROGRESS",
            meta={"current": 80, "total": 100, "status": "Committing and pushing to remote…"},
        )

        # Warn if repo already had uncommitted changes before we add ours
        if repo.is_dirty(untracked_files=False):
            logger.warning(
                "export_flows: repo '%s' has uncommitted changes before export commit",
                git_repo_name,
            )

        try:
            commit_message = "Export %d NiFi flow(s) as %s [job_run_id=%s]" % (
                len(flows),
                export_type.upper(),
                job_run_id or "manual",
            )
            push_result = git_service.commit_and_push(
                repository=repository_dict,
                message=commit_message,
                files=[relative_path],
                repo=repo,
            )
        except Exception as exc:
            logger.error("export_flows: git commit/push failed: %s", exc, exc_info=True)
            return {
                "success": False,
                "exported_count": len(flows),
                "flows": [],
                "export_type": export_type,
                "filename": filename,
                "git_repo_name": git_repo_name,
                "commit_sha": None,
                "nifi_clusters": nifi_clusters_label,
                "push_to_git": push_to_git,
                "error": "Git commit/push failed: %s" % exc,
            }

        if not push_result.success:
            logger.error("export_flows: git operation failed: %s", push_result.message)
            return {
                "success": False,
                "exported_count": len(flows),
                "flows": [],
                "export_type": export_type,
                "filename": filename,
                "git_repo_name": git_repo_name,
                "commit_sha": push_result.commit_sha,
                "nifi_clusters": nifi_clusters_label,
                "push_to_git": push_to_git,
                "error": push_result.message,
            }

        commit_sha = push_result.commit_sha
        task_context.update_state(
            state="PROGRESS",
            meta={"current": 100, "total": 100, "status": "Done – %d flow(s) exported" % len(flows)},
        )

    logger.info(
        "export_flows: exported %d flow(s) to %s in repo '%s' (commit %s, push_to_git=%s)",
        len(flows),
        filename,
        git_repo_name,
        commit_sha,
        push_to_git,
    )

    return {
        "success": True,
        "exported_count": len(flows),
        "flows": serialisable_flows,
        "export_type": export_type,
        "filename": filename,
        "git_repo_name": git_repo_name,
        "commit_sha": commit_sha,
        "nifi_clusters": nifi_clusters_label,
        "push_to_git": push_to_git,
    }
