#!/bin/bash
# docker-entrypoint.sh - Start NiFi and keep the container alive by tailing logs.
#
# nifi.sh start launches the bootstrap + NiFi JVM then returns immediately.
# We tail the log files so that:
#   - The container stays alive as long as NiFi is running.
#   - Log output is visible via "docker logs".

set -euo pipefail

NIFI_HOME="${NIFI_HOME:-/opt/nifi/nifi-current}"
LOG_DIR="${NIFI_HOME}/logs"
BOOTSTRAP_LOG="${LOG_DIR}/nifi-bootstrap.log"
APP_LOG="${LOG_DIR}/nifi-app.log"

echo "Starting NiFi..."
"${NIFI_HOME}/bin/nifi.sh" start

# Wait for the bootstrap log to appear (NiFi is initialising)
echo "Waiting for NiFi bootstrap log..."
timeout=60
elapsed=0
while [ ! -f "${BOOTSTRAP_LOG}" ]; do
    sleep 1
    elapsed=$((elapsed + 1))
    if [ "${elapsed}" -ge "${timeout}" ]; then
        echo "ERROR: NiFi bootstrap log did not appear within ${timeout}s." >&2
        exit 1
    fi
done

echo "NiFi started. Streaming logs (bootstrap + app)..."

# Tail both log files; -F follows rotations, keeps running even if file disappears briefly.
tail -F "${BOOTSTRAP_LOG}" &
TAIL_BOOTSTRAP_PID=$!

# Wait for the app log to appear before tailing it (may take a few seconds to create)
( while [ ! -f "${APP_LOG}" ]; do sleep 2; done; tail -F "${APP_LOG}" ) &
TAIL_APP_PID=$!

# Trap SIGTERM/SIGINT so docker stop triggers a clean NiFi shutdown
_shutdown() {
    echo "Stopping NiFi..."
    "${NIFI_HOME}/bin/nifi.sh" stop
    kill "${TAIL_BOOTSTRAP_PID}" "${TAIL_APP_PID}" 2>/dev/null || true
}
trap _shutdown SIGTERM SIGINT

# Wait for the bootstrap PID file to be written before monitoring the process.
# nifi.sh start returns before the PID file exists; polling status too early
# yields "not running" and would incorrectly trigger shutdown.
BOOTSTRAP_PID_FILE="${NIFI_HOME}/run/nifi-bootstrap.pid"
echo "Waiting for NiFi bootstrap PID file..."
pid_wait=0
while [ ! -f "${BOOTSTRAP_PID_FILE}" ]; do
    sleep 2
    pid_wait=$((pid_wait + 2))
    if [ "${pid_wait}" -ge 120 ]; then
        echo "ERROR: NiFi bootstrap PID file did not appear within 120s." >&2
        _shutdown
        exit 1
    fi
done

BOOTSTRAP_PID=$(cat "${BOOTSTRAP_PID_FILE}")
echo "NiFi bootstrap running with PID ${BOOTSTRAP_PID}."

# Keep the container alive by waiting on the bootstrap process directly.
# This is more reliable than polling nifi.sh status (which re-reads the PID
# file and can race during startup or rotation).
while kill -0 "${BOOTSTRAP_PID}" 2>/dev/null; do
    sleep 10
done

echo "NiFi has stopped."
_shutdown
