"""Pure output parsing functions for Datenschleuder Agent command responses.

These functions have no external dependencies and are fully unit-testable.
"""

import json
import re


_GIT_XY_LABELS: dict[str, str] = {
    "??": "untracked",
    " M": "modified",   "M ": "staged",       "MM": "staged+modified",
    " D": "deleted",    "D ": "staged deleted","A ": "added",        "AM": "added+modified",
    "R ": "renamed",    " R": "renamed",       "UU": "conflict",     "AA": "conflict",
    " A": "added",
}


def parse_git_status(raw: str) -> list[dict]:
    """Parse multi-repo git status --short --branch output into structured rows.

    The agent prefixes each repo block with [repo-id].  For repos with no
    changed files a synthetic {"status": "clean"} row is emitted so every
    repo is always represented in the output.
    """
    rows: list[dict] = []
    current_repo: str | None = None
    current_branch = ""
    repo_has_files = False

    for raw_line in raw.splitlines():
        line = raw_line.rstrip()
        if not line:
            continue

        # ── Repo header ──────────────────────────────────────────────────────
        if line.startswith("[") and line.endswith("]"):
            if current_repo is not None and not repo_has_files:
                rows.append({"repo": current_repo, "branch": current_branch, "file": "", "status": "clean"})
            current_repo = line[1:-1]
            current_branch = ""
            repo_has_files = False
            continue

        if current_repo is None:
            continue

        # ── Branch info line: ## main...origin/main [ahead N] [behind N] ────
        if line.startswith("## "):
            info = line[3:]
            # handles "main...origin/main", "HEAD (no branch)", "No commits yet on main"
            current_branch = info.split("...")[0].split(" ")[0]
            continue

        # ── File status line: "XY filename" ──────────────────────────────────
        if len(line) >= 4 and line[2] == " ":
            xy = line[:2]
            filename = line[3:]
            status = _GIT_XY_LABELS.get(xy, xy.strip() or "modified")
            rows.append({"repo": current_repo, "branch": current_branch, "file": filename, "status": status})
            repo_has_files = True

    # flush last repo
    if current_repo is not None and not repo_has_files:
        rows.append({"repo": current_repo, "branch": current_branch, "file": "", "status": "clean"})

    return rows


def parse_list_repositories(raw: str) -> list[dict]:
    """Parse list_repositories JSON output into a list of row dicts."""
    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, list):
            return []
        return [{"id": item["id"]} for item in parsed if isinstance(item, dict) and "id" in item]
    except (json.JSONDecodeError, KeyError):
        return []


def parse_list_containers(raw: str) -> list[dict]:
    """Parse list_containers JSON output into a list of row dicts."""
    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, list):
            return []
        return [{"id": item["id"], "type": item.get("type", "")} for item in parsed if isinstance(item, dict) and "id" in item]
    except (json.JSONDecodeError, KeyError):
        return []


def parse_docker_ps(raw: str) -> list[dict]:
    """Parse `docker ps` tabular output into a list of row dicts."""
    lines = raw.strip().splitlines()
    if len(lines) < 2:
        return []
    columns = ["container_id", "image", "command", "created", "status", "ports", "names"]
    rows = []
    for line in lines[1:]:
        parts = re.split(r"\s{2,}", line.strip())
        # docker ps omits the ports column when empty
        while len(parts) < len(columns):
            parts.insert(-1, "")
        row = dict(zip(columns, parts))
        rows.append(row)
    return rows


def parse_docker_stats(raw: str) -> list[dict]:
    """Parse `docker stats --no-stream` tabular output into a list of row dicts."""
    lines = raw.strip().splitlines()
    if len(lines) < 2:
        return []
    rows = []
    for line in lines[1:]:
        parts = re.split(r"\s{2,}", line.strip())
        if len(parts) < 8:
            continue
        mem_parts = parts[3].split(" / ") if len(parts) > 3 else ["", ""]
        net_parts = parts[5].split(" / ") if len(parts) > 5 else ["", ""]
        block_parts = parts[6].split(" / ") if len(parts) > 6 else ["", ""]
        rows.append({
            "container_id": parts[0] if len(parts) > 0 else "",
            "name": parts[1] if len(parts) > 1 else "",
            "cpu_percent": parts[2] if len(parts) > 2 else "",
            "mem_usage": mem_parts[0] if len(mem_parts) > 0 else "",
            "mem_limit": mem_parts[1] if len(mem_parts) > 1 else "",
            "mem_percent": parts[4] if len(parts) > 4 else "",
            "net_io_rx": net_parts[0] if len(net_parts) > 0 else "",
            "net_io_tx": net_parts[1] if len(net_parts) > 1 else "",
            "block_io_read": block_parts[0] if len(block_parts) > 0 else "",
            "block_io_write": block_parts[1] if len(block_parts) > 1 else "",
            "pids": parts[7] if len(parts) > 7 else "",
        })
    return rows


class AgentCommandParser:
    """Dispatch output parsing based on command type."""

    _PARSERS = {
        "docker_ps": parse_docker_ps,
        "docker_stats": parse_docker_stats,
        "list_containers": parse_list_containers,
        "list_repositories": parse_list_repositories,
        "git_status": parse_git_status,
    }

    def parse(self, command: str, raw_output: str) -> list[dict] | None:
        """Parse raw command output. Returns None if no parser is registered for the command."""
        parser = self._PARSERS.get(command)
        if parser is None:
            return None
        result = parser(raw_output)
        return result if result else None
