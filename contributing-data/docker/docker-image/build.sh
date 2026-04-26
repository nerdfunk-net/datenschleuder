#!/bin/bash
# build.sh - Build an Apache NiFi Docker image from a local binary archive.
#
# The NiFi binary (nifi-<VERSION>-bin.zip) must be present in the same
# directory as this script.
#
# Configuration via environment variables:
#   NIFI_VERSION   NiFi version to package   (default: 2.9.0)
#   IMAGE_NAME     Docker image name          (default: apache/nifi)
#   IMAGE_TAG      Docker image tag           (default: <NIFI_VERSION>)
#
# Proxy support (build-time only, NOT included in the final image):
#   export HTTPS_PROXY=http://proxy.example.com:3128
#   export HTTP_PROXY=http://proxy.example.com:3128
#   export NO_PROXY=localhost,127.0.0.1
#
# Examples:
#   ./build.sh
#   NIFI_VERSION=2.8.0 ./build.sh
#   HTTPS_PROXY=http://proxy:3128 ./build.sh

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
NIFI_VERSION="${NIFI_VERSION:-2.9.0}"
IMAGE_NAME="${IMAGE_NAME:-datenschleuder/nifi}"
IMAGE_TAG="${IMAGE_TAG:-${NIFI_VERSION}}"
FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Building Apache NiFi Docker Image"
echo "================================="
echo "NiFi Version : ${NIFI_VERSION}"
echo "Image        : ${FULL_IMAGE_NAME}"
echo ""

# ── Validate local binary ─────────────────────────────────────────────────────
BINARY_FILE="${SCRIPT_DIR}/nifi-${NIFI_VERSION}-bin.zip"

if [ ! -f "${BINARY_FILE}" ]; then
    echo "ERROR: Binary not found: ${BINARY_FILE}"
    echo ""
    echo "Place the NiFi binary archive in the same directory as this script:"
    echo "  ${SCRIPT_DIR}/nifi-${NIFI_VERSION}-bin.zip"
    exit 1
fi

echo "Binary       : ${BINARY_FILE}"
echo ""

# ── Detect proxy environment variables ───────────────────────────────────────
# Proxy args are forwarded as Docker build-time ARGs only.
# They are never written into ENV inside the Dockerfile, so the final image
# is free of any proxy configuration (suitable for air-gapped environments).
PROXY_ARGS=()

if [ -n "${HTTP_PROXY:-}" ]; then
    PROXY_ARGS+=("--build-arg" "HTTP_PROXY=${HTTP_PROXY}")
    echo "HTTP proxy   : ${HTTP_PROXY}"
fi

if [ -n "${HTTPS_PROXY:-}" ]; then
    PROXY_ARGS+=("--build-arg" "HTTPS_PROXY=${HTTPS_PROXY}")
    echo "HTTPS proxy  : ${HTTPS_PROXY}"
fi

if [ -n "${NO_PROXY:-}" ]; then
    PROXY_ARGS+=("--build-arg" "NO_PROXY=${NO_PROXY}")
    echo "No proxy     : ${NO_PROXY}"
fi

if [ ${#PROXY_ARGS[@]} -gt 0 ]; then
    echo ""
    echo "NOTE: Proxy will be used during build only and will NOT be embedded in the image."
else
    echo "No proxy configured - building with direct internet access."
fi

echo ""

# ── Build ─────────────────────────────────────────────────────────────────────
docker build \
    -t "${FULL_IMAGE_NAME}" \
    -f "${SCRIPT_DIR}/Dockerfile" \
    --build-arg "NIFI_VERSION=${NIFI_VERSION}" \
    ${PROXY_ARGS[@]+"${PROXY_ARGS[@]}"} \
    "${SCRIPT_DIR}"

echo ""
echo "Build complete!"
echo "==============="
echo ""
docker images "${FULL_IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
echo ""
echo "Save for air-gap deployment:"
echo "  docker save ${FULL_IMAGE_NAME} | gzip > nifi-${IMAGE_TAG}.tar.gz"
echo ""
echo "Load on target machine:"
echo "  gunzip -c nifi-${IMAGE_TAG}.tar.gz | docker load"
