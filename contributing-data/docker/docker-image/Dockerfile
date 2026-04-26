# Dockerfile - Build Apache NiFi image from local binary
#
# Proxy settings are accepted as build-time ARGs only.
# They are NOT persisted in the final image (air-gap safe).
#
# Usage:
#   docker build --build-arg NIFI_VERSION=2.9.0 -t datenschleuder/nifi:2.9.0 .
#   # With proxy:
#   docker build --build-arg HTTPS_PROXY=http://proxy:3128 --build-arg NIFI_VERSION=2.9.0 -t datenschleuder/nifi:2.9.0 .

# ── Build-time proxy ARGs (never become ENV - not persisted in image) ─────────
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

ARG NIFI_VERSION=2.9.0

# ── Base image: BellSoft Liberica OpenJDK 21 on Debian (same as official NiFi image) ──
FROM bellsoft/liberica-openjdk-debian:21

# Redeclare ARGs so they are visible inside this stage
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ARG NIFI_VERSION=2.9.0

# Configure apt proxy temporarily during package installation, then remove it.
# This ensures the proxy is used only at build time.
RUN if [ -n "$HTTP_PROXY" ] || [ -n "$HTTPS_PROXY" ]; then \
        echo "Acquire::http::Proxy \"${HTTP_PROXY}\";"   > /etc/apt/apt.conf.d/01proxy; \
        echo "Acquire::https::Proxy \"${HTTPS_PROXY}\";" >> /etc/apt/apt.conf.d/01proxy; \
    fi \
    && apt-get update \
    && apt-get install -y \
        jq \
        xmlstarlet \
        procps \
        unzip \
        python3 \
        python3-venv \
    && apt-get -y autoremove \
    && apt-get clean autoclean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* \
    # Remove proxy config so it is gone in the final layer
    && rm -f /etc/apt/apt.conf.d/01proxy

# ── NiFi installation ─────────────────────────────────────────────────────────

# Create base directory
RUN mkdir -p /opt/nifi

# Copy the local NiFi binary (must be in the same directory as this Dockerfile)
COPY nifi-${NIFI_VERSION}-bin.zip /tmp/nifi-${NIFI_VERSION}-bin.zip

# Extract, symlink, and clean up
RUN unzip -q /tmp/nifi-${NIFI_VERSION}-bin.zip -d /opt/nifi/ \
    && rm /tmp/nifi-${NIFI_VERSION}-bin.zip \
    && ln -s /opt/nifi/nifi-${NIFI_VERSION} /opt/nifi/nifi-current

# Copy entrypoint script (as root, before switching user)
COPY docker-entrypoint.sh /opt/nifi/docker-entrypoint.sh

# ── Runtime user ──────────────────────────────────────────────────────────────
RUN groupadd -r nifi \
    && useradd -r -g nifi -d /opt/nifi/nifi-current -s /bin/bash nifi \
    && chown -R nifi:nifi /opt/nifi \
    && chmod +x /opt/nifi/docker-entrypoint.sh

USER nifi
WORKDIR /opt/nifi/nifi-current

# ── Runtime environment (no proxy vars here - air-gap safe) ───────────────────
ENV NIFI_HOME=/opt/nifi/nifi-current \
    PATH="/opt/nifi/nifi-current/bin:${PATH}"

EXPOSE 8443

ENTRYPOINT ["/opt/nifi/docker-entrypoint.sh"]
