#!/usr/bin/env python3
"""
Clear all Datenschleuder agent keys from Redis.
Removes all keys matching:
  - agents:*          (agent registry hashes)
  - datenschleuder-*  (pub/sub channels / any leftovers)

Usage:
    python clear_redis.py [--all]

    --all   Flush the entire Redis DB instead of only agent keys
"""

import argparse
import sys
from pathlib import Path

import redis
from dotenv import load_dotenv
import os

# Load .env from the same directory as this script
env_file = Path(__file__).parent / ".env"
if env_file.exists():
    load_dotenv(env_file)
else:
    print("Warning: .env file not found, using environment variables")


def get_redis_client() -> redis.Redis:
    return redis.Redis(
        host=os.getenv("REDIS_HOST", "localhost"),
        port=int(os.getenv("REDIS_PORT", "6379")),
        password=os.getenv("REDIS_PASSWORD"),
        db=int(os.getenv("REDIS_DB", "0")),
        decode_responses=True,
        socket_connect_timeout=5,
    )


def delete_by_patterns(client: redis.Redis, patterns: list[str]) -> int:
    deleted = 0
    for pattern in patterns:
        keys = client.keys(pattern)
        if keys:
            deleted += client.delete(*keys)
            for key in keys:
                print(f"  Deleted: {key}")
    return deleted


def main():
    parser = argparse.ArgumentParser(description="Clear Datenschleuder agent keys from Redis")
    parser.add_argument(
        "--all",
        action="store_true",
        help="Flush the entire Redis DB (FLUSHDB) instead of only agent keys",
    )
    args = parser.parse_args()

    try:
        client = get_redis_client()
        client.ping()
        print(f"Connected to Redis at {os.getenv('REDIS_HOST', 'localhost')}:{os.getenv('REDIS_PORT', '6379')} (db={os.getenv('REDIS_DB', '0')})")
    except redis.ConnectionError as e:
        print(f"Error: Could not connect to Redis: {e}")
        sys.exit(1)

    if args.all:
        confirm = input("This will FLUSHDB and delete ALL keys in this Redis database. Type 'yes' to confirm: ")
        if confirm.strip().lower() != "yes":
            print("Aborted.")
            sys.exit(0)
        client.flushdb()
        print("Flushed entire Redis database.")
    else:
        patterns = ["agents:*", "datenschleuder-agent:*", "datenschleuder-agent-response:*"]
        print("Deleting agent keys matching:", ", ".join(patterns))
        deleted = delete_by_patterns(client, patterns)
        if deleted == 0:
            print("No matching keys found.")
        else:
            print(f"Done. Deleted {deleted} key(s).")


if __name__ == "__main__":
    main()
