#!/bin/sh
# Fix permissions for existing volumes that were created by older (root) versions
chown -R axy:axy /data 2>/dev/null || true

# Run the server as non-root user
exec su-exec axy node dist/index.js
