#!/usr/bin/env bash
set -euo pipefail

IMAGE="${KATANA_DOCKER_IMAGE:-projectdiscovery/katana:latest}"

exec docker run --rm --network host "$IMAGE" "$@"

