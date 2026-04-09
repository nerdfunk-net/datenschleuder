"""
Command executor for Datenschleuder Agent
Handles execution of git, docker, and other commands
"""

import asyncio
import json
import logging
import os
import time
from typing import Callable, Dict, List, Optional

from config import config

logger = logging.getLogger(__name__)


class CommandExecutor:
    """Pluggable command executor with handler registry"""

    def __init__(self):
        self.handlers: Dict[str, Callable] = {}
        self._register_builtin_commands()

    def _register_builtin_commands(self):
        """Register default command handlers"""
        self.register("echo", self._execute_echo)
        self.register("git_pull", self._execute_git_pull)
        self.register("git_push", self._execute_git_push)
        self.register("git_status", self._execute_git_status)
        self.register("list_repositories", self._execute_list_repositories)

        self.register("fetch_nifi_properties", self._execute_fetch_nifi_properties)

        if config.mode == "bare":
            self.register("nifi_restart", self._execute_nifi_restart)
            self.register("nifi_stop", self._execute_nifi_stop)
            self.register("nifi_start", self._execute_nifi_start)
        else:
            self.register("docker_restart", self._execute_docker_restart)
            self.register("list_containers", self._execute_list_containers)
            self.register("docker_stats", self._execute_docker_stats)
            self.register("docker_ps", self._execute_docker_ps)

    def register(self, command_name: str, handler: Callable):
        """Register a new command handler"""
        self.handlers[command_name] = handler
        logger.info(f"Registered command handler: {command_name}")

    async def execute(self, command: str, params: dict) -> dict:
        """
        Execute a command by name
        Returns: dict with status, output, error, execution_time_ms
        """
        start_time = time.time()

        if command not in self.handlers:
            return {
                "status": "error",
                "error": f"Unknown command: {command}",
                "output": None,
                "execution_time_ms": 0,
            }

        try:
            handler = self.handlers[command]
            result = await handler(params)

            # Add execution time
            execution_time_ms = int((time.time() - start_time) * 1000)
            result["execution_time_ms"] = execution_time_ms

            return result

        except Exception as e:
            logger.error(f"Command execution failed: {command}", exc_info=True)
            execution_time_ms = int((time.time() - start_time) * 1000)
            return {
                "status": "error",
                "error": str(e),
                "output": None,
                "execution_time_ms": execution_time_ms,
            }

    async def _execute_echo(self, params: dict) -> dict:
        """Echo command for health checks"""
        message = params.get("message", "pong")
        logger.info(f"Echo command: {message}")
        return {"status": "success", "output": message, "error": None}

    async def _run_git(self, repo_path: str, *args: str) -> tuple[int, str, str]:
        """Run a git command inside repo_path. Returns (returncode, stdout, stderr)."""
        process = await asyncio.create_subprocess_exec(
            "git", "-C", repo_path, *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), timeout=config.command_timeout
            )
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            return -1, "", f"timed out after {config.command_timeout}s"
        return process.returncode, stdout.decode("utf-8").strip(), stderr.decode("utf-8").strip()

    async def _git_pull_one(self, repo_id: str, repo_path: str, branch: str) -> dict:
        """Execute git pull for a single repository path. Returns per-repo result dict."""
        # Check if path exists
        if not os.path.isdir(repo_path):
            return {"status": "error", "error": f"Path does not exist: {repo_path}", "output": None}

        git_dir = os.path.join(repo_path, ".git")
        if not os.path.isdir(git_dir):
            return {"status": "error", "error": f"Not a git repository: {repo_path}", "output": None}

        logger.info("Executing: git -C %s pull origin %s (timeout: %ss)", repo_path, branch, config.command_timeout)

        process = await asyncio.create_subprocess_exec(
            "git", "-C", repo_path, "pull", "origin", branch,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), timeout=config.command_timeout
            )
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            return {
                "status": "error",
                "error": f"Git pull timed out after {config.command_timeout}s",
                "output": None,
            }

        stdout_text = stdout.decode("utf-8").strip()
        stderr_text = stderr.decode("utf-8").strip()

        if process.returncode == 0:
            logger.info("Git pull successful for %s: %s", repo_id, stdout_text)
            return {"status": "success", "output": stdout_text or "Git pull completed successfully", "error": None}
        else:
            error_msg = stderr_text or "Git pull failed (no error message)"
            logger.error("Git pull failed for %s (rc=%s): %s", repo_id, process.returncode, error_msg)
            return {"status": "error", "error": error_msg, "output": stdout_text}

    async def _execute_git_pull(self, params: dict) -> dict:
        """
        Execute git pull on one or more repositories identified by ID.
        Accepts optional 'repository_ids' list; if omitted, pulls all configured repos.
        """
        repository_ids: Optional[List[str]] = params.get("repository_ids") or None
        branch = params.get("branch", "main")
        logger.info("Git pull request - params: %s", params)

        if not config.git_repos:
            error_msg = "No git repositories configured (repos.yaml missing or empty)"
            logger.error(error_msg)
            return {"status": "error", "error": error_msg, "output": None}

        # Determine which repos to pull
        if repository_ids:
            unknown = [rid for rid in repository_ids if rid not in config.git_repos]
            if unknown:
                error_msg = f"Unknown repository IDs: {', '.join(unknown)}. Configured: {', '.join(config.git_repos.keys())}"
                logger.error(error_msg)
                return {"status": "error", "error": error_msg, "output": None}
            target_repos = {rid: config.git_repos[rid] for rid in repository_ids}
        else:
            target_repos = config.git_repos

        outputs = []
        errors = []

        for repo_id, repo_info in target_repos.items():
            repo_path = repo_info.get("path", "")
            result = await self._git_pull_one(repo_id, repo_path, branch)
            line = f"[{repo_id}] {result.get('output') or result.get('error') or ''}"
            if result["status"] == "success":
                outputs.append(line)
            else:
                errors.append(line)

        combined_output = "\n".join(outputs + errors) or None

        if errors and not outputs:
            return {"status": "error", "error": "\n".join(errors), "output": None}
        if errors:
            return {"status": "error", "error": "\n".join(errors), "output": "\n".join(outputs)}

        return {"status": "success", "output": combined_output or "Git pull completed successfully", "error": None}

    async def _git_push_one(self, repo_id: str, repo_path: str, branch: str) -> dict:
        """Stage all changes, commit with timestamp, and push for a single repository."""
        if not os.path.isdir(repo_path):
            return {"status": "error", "error": f"Path does not exist: {repo_path}", "output": None}
        if not os.path.isdir(os.path.join(repo_path, ".git")):
            return {"status": "error", "error": f"Not a git repository: {repo_path}", "output": None}

        # 1. Stage all changes
        logger.info("Executing: git -C %s add -A", repo_path)
        rc, _, stderr = await self._run_git(repo_path, "add", "-A")
        if rc == -1:
            return {"status": "error", "error": f"git add timed out after {config.command_timeout}s", "output": None}
        if rc != 0:
            return {"status": "error", "error": stderr or "git add failed", "output": None}

        # 2. Commit with timestamp
        commit_msg = f"Auto-commit {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}"
        logger.info("Executing: git -C %s commit -m '%s'", repo_path, commit_msg)
        rc, stdout, stderr = await self._run_git(repo_path, "commit", "-m", commit_msg)
        if rc == -1:
            return {"status": "error", "error": f"git commit timed out after {config.command_timeout}s", "output": None}
        if rc != 0:
            combined = (stdout + "\n" + stderr).strip()
            # nothing to commit is not a failure
            if "nothing to commit" in combined:
                logger.info("Nothing to commit for %s", repo_id)
                return {"status": "success", "output": "Nothing to commit, working tree clean", "error": None}
            return {"status": "error", "error": stderr or stdout or "git commit failed", "output": stdout or None}

        # 3. Push
        logger.info("Executing: git -C %s push origin %s", repo_path, branch)
        rc, push_stdout, push_stderr = await self._run_git(repo_path, "push", "origin", branch)
        if rc == -1:
            return {"status": "error", "error": f"git push timed out after {config.command_timeout}s", "output": stdout}
        if rc != 0:
            error_msg = push_stderr or "git push failed"
            logger.error("Git push failed for %s (rc=%s): %s", repo_id, rc, error_msg)
            return {"status": "error", "error": error_msg, "output": stdout}

        combined_output = "\n".join(filter(None, [stdout, push_stdout, push_stderr])) or "Committed and pushed successfully"
        logger.info("Git push successful for %s", repo_id)
        return {"status": "success", "output": combined_output, "error": None}

    async def _execute_git_push(self, params: dict) -> dict:
        """
        Stage all changes, commit with timestamp, and push one or more repositories.
        Accepts optional 'repository_ids' list; if omitted, pushes all configured repos.
        Accepts optional 'branch' string (default: 'main').
        """
        repository_ids: Optional[List[str]] = params.get("repository_ids") or None
        branch = params.get("branch", "main")
        logger.info("Git push request - params: %s", params)

        if not config.git_repos:
            error_msg = "No git repositories configured (repos.yaml missing or empty)"
            logger.error(error_msg)
            return {"status": "error", "error": error_msg, "output": None}

        if repository_ids:
            unknown = [rid for rid in repository_ids if rid not in config.git_repos]
            if unknown:
                error_msg = f"Unknown repository IDs: {', '.join(unknown)}. Configured: {', '.join(config.git_repos.keys())}"
                logger.error(error_msg)
                return {"status": "error", "error": error_msg, "output": None}
            target_repos = {rid: config.git_repos[rid] for rid in repository_ids}
        else:
            target_repos = config.git_repos

        outputs = []
        errors = []

        for repo_id, repo_info in target_repos.items():
            repo_path = repo_info.get("path", "")
            result = await self._git_push_one(repo_id, repo_path, branch)
            line = f"[{repo_id}] {result.get('output') or result.get('error') or ''}"
            if result["status"] == "success":
                outputs.append(line)
            else:
                errors.append(line)

        combined_output = "\n".join(outputs + errors) or None

        if errors and not outputs:
            return {"status": "error", "error": "\n".join(errors), "output": None}
        if errors:
            return {"status": "error", "error": "\n".join(errors), "output": "\n".join(outputs)}

        return {"status": "success", "output": combined_output or "Git push completed successfully", "error": None}

    async def _git_status_one(self, repo_id: str, repo_path: str) -> dict:
        """Execute git status for a single repository path."""
        if not os.path.isdir(repo_path):
            return {"status": "error", "error": f"Path does not exist: {repo_path}", "output": None}

        git_dir = os.path.join(repo_path, ".git")
        if not os.path.isdir(git_dir):
            return {"status": "error", "error": f"Not a git repository: {repo_path}", "output": None}

        logger.info("Executing: git -C %s status --short --branch (timeout: %ss)", repo_path, config.command_timeout)

        process = await asyncio.create_subprocess_exec(
            "git", "-C", repo_path, "status", "--short", "--branch",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), timeout=config.command_timeout
            )
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            return {
                "status": "error",
                "error": f"Git status timed out after {config.command_timeout}s",
                "output": None,
            }

        stdout_text = stdout.decode("utf-8").strip()
        stderr_text = stderr.decode("utf-8").strip()

        if process.returncode == 0:
            logger.info("Git status successful for %s", repo_id)
            return {"status": "success", "output": stdout_text or "Git status: clean", "error": None}
        else:
            error_msg = stderr_text or "Git status failed (no error message)"
            logger.error("Git status failed for %s (rc=%s): %s", repo_id, process.returncode, error_msg)
            return {"status": "error", "error": error_msg, "output": stdout_text}

    async def _execute_git_status(self, params: dict) -> dict:
        """
        Execute git status on one or more repositories identified by ID.
        Accepts optional 'repository_ids' list; if omitted, checks all configured repos.
        """
        repository_ids: Optional[List[str]] = params.get("repository_ids") or None
        logger.info("Git status request - params: %s", params)

        if not config.git_repos:
            error_msg = "No git repositories configured (repos.yaml missing or empty)"
            logger.error(error_msg)
            return {"status": "error", "error": error_msg, "output": None}

        if repository_ids:
            unknown = [rid for rid in repository_ids if rid not in config.git_repos]
            if unknown:
                error_msg = f"Unknown repository IDs: {', '.join(unknown)}. Configured: {', '.join(config.git_repos.keys())}"
                logger.error(error_msg)
                return {"status": "error", "error": error_msg, "output": None}
            target_repos = {rid: config.git_repos[rid] for rid in repository_ids}
        else:
            target_repos = config.git_repos

        outputs = []
        errors = []

        for repo_id, repo_info in target_repos.items():
            repo_path = repo_info.get("path", "")
            result = await self._git_status_one(repo_id, repo_path)
            lines = f"[{repo_id}]\n{result.get('output') or result.get('error') or ''}"
            if result["status"] == "success":
                outputs.append(lines)
            else:
                errors.append(lines)

        combined_output = "\n\n".join(outputs + errors) or None

        if errors and not outputs:
            return {"status": "error", "error": "\n".join(errors), "output": None}
        if errors:
            return {"status": "error", "error": "\n".join(errors), "output": "\n".join(outputs)}

        return {"status": "success", "output": combined_output or "Git status: clean", "error": None}

    async def _execute_list_repositories(self, params: dict) -> dict:
        """Return the list of configured repository IDs."""
        repos = [{"id": k} for k in config.git_repos.keys()]
        return {"status": "success", "output": json.dumps(repos), "error": None}

    async def _restart_containers(self, container_names: list, label: str) -> dict:
        """
        Restart a list of docker containers sequentially.
        Returns a combined result with all outputs.
        """
        outputs = []
        errors = []

        for container_name in container_names:
            logger.info(
                f"Executing: docker restart {container_name} (timeout: {config.docker_timeout}s)"
            )

            process = await asyncio.create_subprocess_exec(
                "docker",
                "restart",
                container_name,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            logger.debug(f"Subprocess started with PID: {process.pid}")

            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(), timeout=config.docker_timeout
                )
                logger.debug(
                    f"Process completed with return code: {process.returncode}"
                )
            except asyncio.TimeoutError:
                logger.error(
                    f"Restart of {container_name} timed out after {config.docker_timeout}s, killing process"
                )
                process.kill()
                await process.wait()
                errors.append(
                    f"{container_name}: timed out after {config.docker_timeout}s"
                )
                continue

            stdout_text = stdout.decode("utf-8").strip()
            stderr_text = stderr.decode("utf-8").strip()

            if process.returncode == 0:
                logger.info(f"Restart successful for {container_name}: {stdout_text}")
                outputs.append(stdout_text or f"{container_name} restarted")
            else:
                error_msg = stderr_text or f"{container_name}: restart failed"
                logger.error(
                    f"Restart failed for {container_name} (return code {process.returncode}): {error_msg}"
                )
                errors.append(error_msg)

        if errors:
            return {
                "status": "error",
                "error": "; ".join(errors),
                "output": "; ".join(outputs) or None,
            }

        return {
            "status": "success",
            "output": "; ".join(outputs) or f"All {label} containers restarted",
            "error": None,
        }

    async def _execute_docker_restart(self, params: dict) -> dict:
        """
        Restart one or more containers identified by ID from containers.yaml.
        Accepts optional 'container_ids' list; if omitted, restarts all configured containers.
        """
        container_ids: Optional[List[str]] = params.get("container_ids") or None
        logger.info("Docker restart request - params: %s", params)

        if not config.docker_containers:
            error_msg = "No docker containers configured (containers.yaml missing or empty)"
            logger.error(error_msg)
            return {"status": "error", "error": error_msg, "output": None}

        if container_ids:
            unknown = [cid for cid in container_ids if cid not in config.docker_containers]
            if unknown:
                error_msg = f"Unknown container IDs: {', '.join(unknown)}. Configured: {', '.join(config.docker_containers.keys())}"
                logger.error(error_msg)
                return {"status": "error", "error": error_msg, "output": None}
            target_containers = {cid: config.docker_containers[cid] for cid in container_ids}
        else:
            target_containers = config.docker_containers

        outputs = []
        errors = []

        for container_id, container_info in target_containers.items():
            container_name = container_info.get("container", "")
            result = await self._restart_containers([container_name], container_id)
            line = f"[{container_id}] {result.get('output') or result.get('error') or ''}"
            if result["status"] == "success":
                outputs.append(line)
            else:
                errors.append(line)

        combined_output = "\n".join(outputs + errors) or None

        if errors and not outputs:
            return {"status": "error", "error": "\n".join(errors), "output": None}
        if errors:
            return {"status": "error", "error": "\n".join(errors), "output": "\n".join(outputs)}

        return {"status": "success", "output": combined_output or "All containers restarted", "error": None}

    async def _execute_list_containers(self, params: dict) -> dict:
        """Return the list of configured container IDs with their types."""
        containers = [
            {"id": k, "type": v.get("type", "")}
            for k, v in config.docker_containers.items()
        ]
        return {"status": "success", "output": json.dumps(containers), "error": None}


    async def _execute_docker_stats(self, params: dict) -> dict:
        """
        Execute 'docker container stats --no-stream' and return the output.
        """
        logger.info("Docker stats request")

        try:
            logger.info(
                f"Executing: docker container stats --no-stream (timeout: {config.command_timeout}s)"
            )

            process = await asyncio.create_subprocess_exec(
                "docker",
                "container",
                "stats",
                "--no-stream",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            logger.debug(f"Subprocess started with PID: {process.pid}")

            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(), timeout=config.command_timeout
                )
                logger.debug(
                    f"Process completed with return code: {process.returncode}"
                )
            except asyncio.TimeoutError:
                logger.error(
                    f"Docker stats timed out after {config.command_timeout}s, killing process"
                )
                process.kill()
                await process.wait()
                return {
                    "status": "error",
                    "error": f"Docker stats timed out after {config.command_timeout}s",
                    "output": None,
                }

            stdout_text = stdout.decode("utf-8").strip()
            stderr_text = stderr.decode("utf-8").strip()

            logger.debug(f"Docker stats stdout: {stdout_text or '(empty)'}")
            logger.debug(f"Docker stats stderr: {stderr_text or '(empty)'}")

            if process.returncode == 0:
                logger.info("Docker stats successful")
                return {
                    "status": "success",
                    "output": stdout_text or "No containers running",
                    "error": None,
                }
            else:
                error_msg = stderr_text or "Docker stats failed (no error message)"
                logger.error(
                    f"Docker stats failed (return code {process.returncode}): {error_msg}"
                )
                return {
                    "status": "error",
                    "error": error_msg,
                    "output": stdout_text or None,
                }

        except Exception as e:
            logger.error(f"Docker stats exception: {e}", exc_info=True)
            return {"status": "error", "error": str(e), "output": None}


    async def _execute_docker_ps(self, params: dict) -> dict:
        """
        Execute 'docker ps' and return the output.
        """
        logger.info("Docker ps request")

        try:
            logger.info(
                f"Executing: docker ps (timeout: {config.command_timeout}s)"
            )

            process = await asyncio.create_subprocess_exec(
                "docker",
                "ps",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            logger.debug(f"Subprocess started with PID: {process.pid}")

            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(), timeout=config.command_timeout
                )
                logger.debug(
                    f"Process completed with return code: {process.returncode}"
                )
            except asyncio.TimeoutError:
                logger.error(
                    f"Docker ps timed out after {config.command_timeout}s, killing process"
                )
                process.kill()
                await process.wait()
                return {
                    "status": "error",
                    "error": f"Docker ps timed out after {config.command_timeout}s",
                    "output": None,
                }

            stdout_text = stdout.decode("utf-8").strip()
            stderr_text = stderr.decode("utf-8").strip()

            logger.debug(f"Docker ps stdout: {stdout_text or '(empty)'}")
            logger.debug(f"Docker ps stderr: {stderr_text or '(empty)'}")

            if process.returncode == 0:
                logger.info("Docker ps successful")
                return {
                    "status": "success",
                    "output": stdout_text or "No containers running",
                    "error": None,
                }
            else:
                error_msg = stderr_text or "Docker ps failed (no error message)"
                logger.error(
                    f"Docker ps failed (return code {process.returncode}): {error_msg}"
                )
                return {
                    "status": "error",
                    "error": error_msg,
                    "output": stdout_text or None,
                }

        except Exception as e:
            logger.error(f"Docker ps exception: {e}", exc_info=True)
            return {"status": "error", "error": str(e), "output": None}


    async def _run_bare_service_action(self, service_id: str, service_info: dict, action: str) -> dict:
        """Run a bare service action (restart/stop/start) using the command from bare.yaml."""
        cmd_string = service_info.get(action)
        if not cmd_string:
            return {
                "status": "error",
                "error": f"No '{action}' command defined for service '{service_id}'",
                "output": None,
            }

        cmd_parts = cmd_string.split()
        logger.info("Executing bare service %s for %s: %s (timeout: %ss)", action, service_id, cmd_string, config.command_timeout)

        process = await asyncio.create_subprocess_exec(
            *cmd_parts,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), timeout=config.command_timeout
            )
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            return {
                "status": "error",
                "error": f"Command timed out after {config.command_timeout}s: {cmd_string}",
                "output": None,
            }

        stdout_text = stdout.decode("utf-8").strip()
        stderr_text = stderr.decode("utf-8").strip()

        if process.returncode == 0:
            logger.info("Bare service %s %s successful", action, service_id)
            return {"status": "success", "output": stdout_text or f"{service_id} {action} completed", "error": None}
        else:
            error_msg = stderr_text or stdout_text or f"{service_id} {action} failed"
            logger.error("Bare service %s %s failed (rc=%s): %s", action, service_id, process.returncode, error_msg)
            return {"status": "error", "error": error_msg, "output": stdout_text or None}

    async def _execute_bare_action_by_type(self, action: str, service_type: str, params: dict) -> dict:
        """
        Execute an action on all bare services of a given type (e.g. 'nifi').
        Accepts optional 'service_ids' list to target specific services.
        """
        service_ids: Optional[List[str]] = params.get("service_ids") or None

        if not config.bare_services:
            error_msg = "No bare services configured (bare.yaml missing or empty)"
            logger.error(error_msg)
            return {"status": "error", "error": error_msg, "output": None}

        # Filter by type
        typed_services = {k: v for k, v in config.bare_services.items() if v.get("type") == service_type}
        if not typed_services:
            error_msg = f"No services of type '{service_type}' found in bare.yaml"
            logger.error(error_msg)
            return {"status": "error", "error": error_msg, "output": None}

        if service_ids:
            unknown = [sid for sid in service_ids if sid not in typed_services]
            if unknown:
                error_msg = f"Unknown {service_type} service IDs: {', '.join(unknown)}. Configured: {', '.join(typed_services.keys())}"
                logger.error(error_msg)
                return {"status": "error", "error": error_msg, "output": None}
            target_services = {sid: typed_services[sid] for sid in service_ids}
        else:
            target_services = typed_services

        outputs = []
        errors = []

        for service_id, service_info in target_services.items():
            result = await self._run_bare_service_action(service_id, service_info, action)
            line = f"[{service_id}] {result.get('output') or result.get('error') or ''}"
            if result["status"] == "success":
                outputs.append(line)
            else:
                errors.append(line)

        combined_output = "\n".join(outputs + errors) or None

        if errors and not outputs:
            return {"status": "error", "error": "\n".join(errors), "output": None}
        if errors:
            return {"status": "error", "error": "\n".join(errors), "output": "\n".join(outputs)}

        return {"status": "success", "output": combined_output or f"All {service_type} services {action} completed", "error": None}

    async def _fetch_nifi_properties_one(self, repo_id: str, repo_path: str, branch: str) -> dict:
        """Fetch nifi.properties from git remote and overwrite the local file.

        Steps:
        1. Check whether nifi.properties has local modifications.
        2. Run 'git fetch origin <branch>' to update remote refs.
        3. Force-checkout nifi.properties from FETCH_HEAD, discarding local changes.
        Returns a dict with status, output (includes was_modified flag), error.
        """
        if not os.path.isdir(repo_path):
            return {"status": "error", "error": f"Path does not exist: {repo_path}", "output": None}
        if not os.path.isdir(os.path.join(repo_path, ".git")):
            return {"status": "error", "error": f"Not a git repository: {repo_path}", "output": None}

        nifi_props_file = "nifi.properties"

        # 1. Detect local modification
        logger.info("Checking modification status of %s in %s", nifi_props_file, repo_path)
        rc, status_out, status_err = await self._run_git(repo_path, "status", "--short", "--", nifi_props_file)
        if rc == -1:
            return {"status": "error", "error": f"git status timed out after {config.command_timeout}s", "output": None}
        if rc != 0:
            return {"status": "error", "error": status_err or "git status failed", "output": None}

        was_modified = bool(status_out.strip())
        logger.info("nifi.properties modified=%s for repo '%s'", was_modified, repo_id)

        # 2. Fetch remote branch
        logger.info("Executing: git -C %s fetch origin %s", repo_path, branch)
        rc, _, fetch_err = await self._run_git(repo_path, "fetch", "origin", branch)
        if rc == -1:
            return {"status": "error", "error": f"git fetch timed out after {config.command_timeout}s", "output": None}
        if rc != 0:
            return {"status": "error", "error": fetch_err or "git fetch failed", "output": None}

        # 3. Force-checkout nifi.properties from FETCH_HEAD
        logger.info("Executing: git -C %s checkout FETCH_HEAD -- %s", repo_path, nifi_props_file)
        rc, _, checkout_err = await self._run_git(repo_path, "checkout", "FETCH_HEAD", "--", nifi_props_file)
        if rc == -1:
            return {"status": "error", "error": f"git checkout timed out after {config.command_timeout}s", "output": None}
        if rc != 0:
            return {"status": "error", "error": checkout_err or "git checkout failed", "output": None}

        modified_label = "was modified" if was_modified else "was not modified"
        output = f"nifi.properties fetched from origin/{branch} ({modified_label})"
        logger.info("fetch_nifi_properties successful for %s: %s", repo_id, output)
        return {"status": "success", "output": output, "error": None, "was_modified": was_modified}

    async def _execute_fetch_nifi_properties(self, params: dict) -> dict:
        """
        Fetch nifi.properties from the git remote and overwrite the local file.
        Accepts optional 'repository_ids' list; if omitted, targets all configured repos.
        Accepts optional 'branch' string (default: 'main').
        The response output includes whether the file was locally modified before the fetch.
        """
        repository_ids: Optional[List[str]] = params.get("repository_ids") or None
        branch = params.get("branch", "main")
        logger.info("fetch_nifi_properties request - params: %s", params)

        if not config.git_repos:
            error_msg = "No git repositories configured (repos.yaml missing or empty)"
            logger.error(error_msg)
            return {"status": "error", "error": error_msg, "output": None}

        if repository_ids:
            unknown = [rid for rid in repository_ids if rid not in config.git_repos]
            if unknown:
                error_msg = f"Unknown repository IDs: {', '.join(unknown)}. Configured: {', '.join(config.git_repos.keys())}"
                logger.error(error_msg)
                return {"status": "error", "error": error_msg, "output": None}
            target_repos = {rid: config.git_repos[rid] for rid in repository_ids}
        else:
            target_repos = config.git_repos

        outputs = []
        errors = []

        for repo_id, repo_info in target_repos.items():
            repo_path = repo_info.get("path", "")
            result = await self._fetch_nifi_properties_one(repo_id, repo_path, branch)
            line = f"[{repo_id}] {result.get('output') or result.get('error') or ''}"
            if result["status"] == "success":
                outputs.append(line)
            else:
                errors.append(line)

        combined_output = "\n".join(outputs + errors) or None

        if errors and not outputs:
            return {"status": "error", "error": "\n".join(errors), "output": None}
        if errors:
            return {"status": "error", "error": "\n".join(errors), "output": "\n".join(outputs)}

        return {"status": "success", "output": combined_output or "nifi.properties fetched successfully", "error": None}

    async def _execute_nifi_restart(self, params: dict) -> dict:
        """Restart all NiFi services defined in bare.yaml"""
        logger.info("NiFi restart request - params: %s", params)
        return await self._execute_bare_action_by_type("restart", "nifi", params)

    async def _execute_nifi_stop(self, params: dict) -> dict:
        """Stop all NiFi services defined in bare.yaml"""
        logger.info("NiFi stop request - params: %s", params)
        return await self._execute_bare_action_by_type("stop", "nifi", params)

    async def _execute_nifi_start(self, params: dict) -> dict:
        """Start all NiFi services defined in bare.yaml"""
        logger.info("NiFi start request - params: %s", params)
        return await self._execute_bare_action_by_type("start", "nifi", params)


# Example of how to add custom commands:
# executor = CommandExecutor()
# async def my_custom_handler(params: dict) -> dict:
#     return {"status": "success", "output": "custom result", "error": None}
# executor.register("my_command", my_custom_handler)
