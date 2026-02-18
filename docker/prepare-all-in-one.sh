#!/bin/bash
# prepare-all-in-one.sh - Build the datenschleuder application image
# Run this script on a machine with internet access

set -e

echo "Building Datenschleuder All-in-One Image"
echo "========================================"

# Configuration
IMAGE_NAME="datenschleuder"
IMAGE_TAG="all-in-one"
FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"
OUTPUT_FILE="docker/airgap-artifacts/${IMAGE_NAME}-${IMAGE_TAG}.tar"

# Create output directory
mkdir -p docker/airgap-artifacts

echo "Image: ${FULL_IMAGE_NAME}"
echo "Output: ${OUTPUT_FILE}"

# Detect proxy environment variables and build proxy arguments
PROXY_ARGS=""
if [ -n "${HTTP_PROXY}" ]; then
    PROXY_ARGS="${PROXY_ARGS} --build-arg HTTP_PROXY=${HTTP_PROXY}"
    echo "HTTP Proxy detected: ${HTTP_PROXY}"
fi

if [ -n "${HTTPS_PROXY}" ]; then
    PROXY_ARGS="${PROXY_ARGS} --build-arg HTTPS_PROXY=${HTTPS_PROXY}"
    echo "HTTPS Proxy detected: ${HTTPS_PROXY}"
fi

if [ -n "${NO_PROXY}" ]; then
    PROXY_ARGS="${PROXY_ARGS} --build-arg NO_PROXY=${NO_PROXY}"
    echo "No Proxy list detected: ${NO_PROXY}"
fi

if [ -n "${PROXY_ARGS}" ]; then
    echo "Using proxy configuration for Docker build"
else
    echo "No proxy configuration detected - building with direct internet access"
fi
echo ""

# Build the all-in-one image with conditional proxy arguments
docker build -t "${FULL_IMAGE_NAME}" -f docker/Dockerfile.all-in-one . \
    --no-cache ${PROXY_ARGS}

echo ""
echo "Saving image to tar file..."
docker save "${FULL_IMAGE_NAME}" -o "${OUTPUT_FILE}"

# Compress the image for smaller transfer
echo "Compressing image for transfer..."
gzip -f "${OUTPUT_FILE}"
COMPRESSED_FILE="${OUTPUT_FILE}.gz"

echo ""
echo "Build complete!"
echo "==============="
echo ""
echo "Transfer file: ${COMPRESSED_FILE}"
echo "File size: $(du -h "${COMPRESSED_FILE}" | cut -f1)"
echo ""
echo "Load image on target machine:"
echo "  gunzip $(basename "${COMPRESSED_FILE}")"
echo "  docker load -i $(basename "${OUTPUT_FILE}")"
echo ""
echo "NOTE: This image contains only the application (frontend + backend)."
echo "      The following external services must be available separately:"
echo "        - PostgreSQL (tested with postgres:16-alpine)"
echo "        - Redis      (tested with redis:7-alpine)"
echo "      See docker/docker-compose.yml for an example configuration."
echo ""

# Show image details
echo "Image Details:"
echo "=============="
docker images "${FULL_IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
