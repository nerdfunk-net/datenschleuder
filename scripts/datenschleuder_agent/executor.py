"""
Command executor for Datenschleuder Agent
Handles execution of git, docker, and other commands
"""

import asyncio
import logging
import os
import time
from typing import Callable, Dict

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
        self.register("git_status", self._execute_git_status)
        self.register("nifi_restart", self._execute_nifi_restart)
        self.register("zookeeper_restart", self._execute_zookeeper_restart)
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

    async def _execute_git_pull(self, params: dict) -> dict:
        """
        Execute git pull command
        Uses repository path from params or falls back to first configured path in GIT_REPO_PATH
        """
        repo_path = params.get("repository_path") or ""
        branch = params.get("branch", "main")
        logger.info(f"Git pull request - params: {params}")

        # If no path provided, use first configured path
        if not repo_path:
            if not config.git_repo_paths:
                error_msg = "No git repositories configured (GIT_REPO_PATH not set)"
                logger.error(error_msg)
                return {
                    "status": "error",
                    "error": error_msg,
                    "output": None,
                }
            repo_path = config.git_repo_paths[0]
            logger.info(f"Using default git repo path from config: {repo_path}")
        else:
            logger.info(f"Using provided repository path: {repo_path}")

        # Validate repository path is in allowed paths
        allowed_paths = config.git_repo_paths
        logger.debug(f"Allowed paths: {allowed_paths}")
        if repo_path not in allowed_paths:
            error_msg = f"Repository path not allowed. Configured paths: {', '.join(allowed_paths)}"
            logger.error(error_msg)
            return {
                "status": "error",
                "error": error_msg,
                "output": None,
            }

        # Check if path exists
        if not os.path.isdir(repo_path):
            error_msg = f"Repository path does not exist: {repo_path}"
            logger.error(error_msg)
            return {
                "status": "error",
                "error": error_msg,
                "output": None,
            }
        logger.info(f"Repository path exists: {repo_path}")

        # Check if it's a git repository
        git_dir = os.path.join(repo_path, ".git")
        if not os.path.isdir(git_dir):
            error_msg = f"Not a git repository: {repo_path} (no .git directory)"
            logger.error(error_msg)
            return {
                "status": "error",
                "error": error_msg,
                "output": None,
            }
        logger.info(f"Git repository validated: {repo_path}")

        try:
            logger.info(
                f"Executing: git -C {repo_path} pull origin {branch} (timeout: {config.command_timeout}s)"
            )

            # Execute git pull with timeout
            process = await asyncio.create_subprocess_exec(
                "git",
                "-C",
                repo_path,
                "pull",
                "origin",
                branch,
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
                    f"Git pull timed out after {config.command_timeout}s, killing process"
                )
                process.kill()
                await process.wait()
                return {
                    "status": "error",
                    "error": f"Git pull timed out after {config.command_timeout}s",
                    "output": None,
                }

            stdout_text = stdout.decode("utf-8").strip()
            stderr_text = stderr.decode("utf-8").strip()

            logger.debug(f"Git stdout: {stdout_text or '(empty)'}")
            logger.debug(f"Git stderr: {stderr_text or '(empty)'}")

            if process.returncode == 0:
                logger.info(f"Git pull successful in {repo_path}: {stdout_text}")
                return {
                    "status": "success",
                    "output": stdout_text or "Git pull completed successfully",
                    "error": None,
                }
            else:
                error_msg = stderr_text or "Git pull failed (no error message)"
                logger.error(
                    f"Git pull failed (return code {process.returncode}): {error_msg}"
                )
                return {
                    "status": "error",
                    "error": error_msg,
                    "output": stdout_text,
                }

        except Exception as e:
            logger.error(f"Git pull exception: {e}", exc_info=True)
            return {"status": "error", "error": str(e), "output": None}

    async def _execute_git_status(self, params: dict) -> dict:
        """
        Execute git status command
        Uses repository path from params or falls back to first configured path in GIT_REPO_PATH
        """
        repo_path = params.get("repository_path") or ""
        logger.info(f"Git status request - params: {params}")

        # If no path provided, use first configured path
        if not repo_path:
            if not config.git_repo_paths:
                error_msg = "No git repositories configured (GIT_REPO_PATH not set)"
                logger.error(error_msg)
                return {
                    "status": "error",
                    "error": error_msg,
                    "output": None,
                }
            repo_path = config.git_repo_paths[0]
            logger.info(f"Using default git repo path from config: {repo_path}")
        else:
            logger.info(f"Using provided repository path: {repo_path}")

        # Validate repository path is in allowed paths
        allowed_paths = config.git_repo_paths
        logger.debug(f"Allowed paths: {allowed_paths}")
        if repo_path not in allowed_paths:
            error_msg = f"Repository path not allowed. Configured paths: {', '.join(allowed_paths)}"
            logger.error(error_msg)
            return {
                "status": "error",
                "error": error_msg,
                "output": None,
            }

        # Check if path exists
        if not os.path.isdir(repo_path):
            error_msg = f"Repository path does not exist: {repo_path}"
            logger.error(error_msg)
            return {
                "status": "error",
                "error": error_msg,
                "output": None,
            }
        logger.info(f"Repository path exists: {repo_path}")

        # Check if it's a git repository
        git_dir = os.path.join(repo_path, ".git")
        if not os.path.isdir(git_dir):
            error_msg = f"Not a git repository: {repo_path} (no .git directory)"
            logger.error(error_msg)
            return {
                "status": "error",
                "error": error_msg,
                "output": None,
            }
        logger.info(f"Git repository validated: {repo_path}")

        try:
            logger.info(
                f"Executing: git -C {repo_path} status (timeout: {config.command_timeout}s)"
            )

            # Execute git status with timeout
            process = await asyncio.create_subprocess_exec(
                "git",
                "-C",
                repo_path,
                "status",
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
                    f"Git status timed out after {config.command_timeout}s, killing process"
                )
                process.kill()
                await process.wait()
                return {
                    "status": "error",
                    "error": f"Git status timed out after {config.command_timeout}s",
                    "output": None,
                }

            stdout_text = stdout.decode("utf-8").strip()
            stderr_text = stderr.decode("utf-8").strip()

            logger.debug(f"Git stdout: {stdout_text or '(empty)'}")
            logger.debug(f"Git stderr: {stderr_text or '(empty)'}")

            if process.returncode == 0:
                logger.info(f"Git status successful in {repo_path}")
                return {
                    "status": "success",
                    "output": stdout_text or "Git status: clean",
                    "error": None,
                }
            else:
                error_msg = stderr_text or "Git status failed (no error message)"
                logger.error(
                    f"Git status failed (return code {process.returncode}): {error_msg}"
                )
                return {
                    "status": "error",
                    "error": error_msg,
                    "output": stdout_text,
                }

        except Exception as e:
            logger.error(f"Git status exception: {e}", exc_info=True)
            return {"status": "error", "error": str(e), "output": None}

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

    async def _execute_nifi_restart(self, params: dict) -> dict:
        """
        Restart all configured NiFi containers (NIFI_CONTAINERS).
        """
        logger.info(f"NiFi restart request - params: {params}")

        if not config.nifi_container_names:
            error_msg = "No NiFi containers configured (NIFI_CONTAINERS not set)"
            logger.error(error_msg)
            return {"status": "error", "error": error_msg, "output": None}

        logger.info(f"Restarting NiFi containers: {config.nifi_container_names}")

        try:
            return await self._restart_containers(config.nifi_container_names, "NiFi")
        except Exception as e:
            logger.error(f"NiFi restart exception: {e}", exc_info=True)
            return {"status": "error", "error": str(e), "output": None}

    async def _execute_zookeeper_restart(self, params: dict) -> dict:
        """
        Restart all configured ZooKeeper containers (ZOOKEEPER_CONTAINER).
        """
        logger.info(f"ZooKeeper restart request - params: {params}")

        if not config.zookeeper_container_names:
            error_msg = "No ZooKeeper containers configured (ZOOKEEPER_CONTAINER not set)"
            logger.error(error_msg)
            return {"status": "error", "error": error_msg, "output": None}

        logger.info(
            f"Restarting ZooKeeper containers: {config.zookeeper_container_names}"
        )

        try:
            return await self._restart_containers(
                config.zookeeper_container_names, "ZooKeeper"
            )
        except Exception as e:
            logger.error(f"ZooKeeper restart exception: {e}", exc_info=True)
            return {"status": "error", "error": str(e), "output": None}


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


# Example of how to add custom commands:
# executor = CommandExecutor()
# async def my_custom_handler(params: dict) -> dict:
#     return {"status": "success", "output": "custom result", "error": None}
# executor.register("my_command", my_custom_handler)
