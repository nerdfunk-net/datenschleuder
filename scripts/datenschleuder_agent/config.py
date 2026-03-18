"""
Configuration management for Datenschleueder Agent
"""

import logging
import os
import socket
from typing import Dict, List, Optional
from pathlib import Path

import yaml
from dotenv import load_dotenv

# Load .env file if it exists
env_file = Path(__file__).parent / ".env"
if env_file.exists():
    load_dotenv(env_file)


class AgentConfig:
    """Agent configuration loaded from environment variables and repos.yaml"""

    def __init__(self):
        # Redis configuration
        self.redis_host = os.getenv("REDIS_HOST", "localhost")
        self.redis_port = int(os.getenv("REDIS_PORT", "6379"))
        self.redis_password = os.getenv("REDIS_PASSWORD")
        self.redis_db = int(os.getenv("REDIS_DB", "0"))

        # Agent identity - used to connect to Redis and must match Datenschleuder configuration
        self.agent_id = os.getenv("AGENT_ID") or socket.gethostname()

        # Git repositories loaded from repos.yaml
        # Format: {"nifi-docker-1": {"path": "...", "container": "..."}, ...}
        self.git_repos: Dict[str, dict] = self._load_repos_yaml()

        # Docker containers loaded from containers.yaml
        # Format: {"nifi-docker-1": {"container": "nifi-nifi-docker-1-1", "type": "nifi"}, ...}
        self.docker_containers: Dict[str, dict] = self._load_containers_yaml()

        # Operational settings
        self.heartbeat_interval = int(os.getenv("HEARTBEAT_INTERVAL", "30"))
        self.command_timeout = int(os.getenv("COMMAND_TIMEOUT", "30"))
        self.docker_timeout = int(os.getenv("DOCKER_TIMEOUT", "60"))

        # Logging configuration
        loglevel_str = os.getenv("LOGLEVEL", "INFO").upper()
        self.loglevel = getattr(logging, loglevel_str, logging.INFO)

        # Agent metadata
        self.agent_version = "1.0.0"

    def _load_repos_yaml(self) -> Dict[str, dict]:
        """Load git repository definitions from repos.yaml"""
        repos_file = Path(__file__).parent / "repos.yaml"
        if not repos_file.exists():
            return {}
        try:
            with open(repos_file, "r") as f:
                data = yaml.safe_load(f)
            if not isinstance(data, dict):
                return {}
            return {k: v for k, v in data.items() if isinstance(v, dict)}
        except Exception as e:
            logging.getLogger(__name__).error("Failed to load repos.yaml: %s", e)
            return {}

    def _load_containers_yaml(self) -> Dict[str, dict]:
        """Load docker container definitions from containers.yaml"""
        containers_file = Path(__file__).parent / "containers.yaml"
        if not containers_file.exists():
            return {}
        try:
            with open(containers_file, "r") as f:
                data = yaml.safe_load(f)
            if not isinstance(data, dict):
                return {}
            return {k: v for k, v in data.items() if isinstance(v, dict)}
        except Exception as e:
            logging.getLogger(__name__).error("Failed to load containers.yaml: %s", e)
            return {}

    @property
    def git_repo_paths(self) -> List[str]:
        """Computed list of all configured git repo paths (for backward compat)."""
        return [v["path"] for v in self.git_repos.values() if "path" in v]

    def get_command_channel(self) -> str:
        """Get the Redis channel name for receiving commands"""
        return f"datenschleuder-agent:{self.agent_id}"

    def get_response_channel(self) -> str:
        """Get the Redis channel name for sending responses"""
        return f"datenschleuder-agent-response:{self.agent_id}"

    def get_agent_key(self) -> str:
        """Get the Redis key for agent registry"""
        return f"agents:{self.agent_id}"

    def validate(self) -> tuple[bool, Optional[str]]:
        """Validate configuration"""
        if not self.redis_host:
            return False, "REDIS_HOST is required"

        if not self.git_repos:
            return False, "repos.yaml must exist and contain at least one repository entry"

        return True, None


# Global config instance
config = AgentConfig()
