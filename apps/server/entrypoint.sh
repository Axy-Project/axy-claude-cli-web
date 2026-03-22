#!/bin/sh
# Fix permissions for existing volumes that were created by older (root) versions
chown -R axy:axy /data 2>/dev/null || true

# Give axy user access to the Docker socket (needed for self-update)
if [ -S /var/run/docker.sock ]; then
  DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)
  addgroup -g "$DOCKER_GID" -S docker 2>/dev/null || true
  addgroup axy docker 2>/dev/null || true
fi

# Run the server as non-root user
exec su-exec axy node dist/index.js
