#!/bin/sh
set -eu
# Railway mounts volumes as root; initialize only our known directories.
if [ -n "${RAILWAY_ENVIRONMENT_ID:-}" ] && [ "${RAILWAY_VOLUME_MOUNT_PATH:-}" != /data ]; then
  echo 'FeedFix requires a persistent Railway volume mounted at /data.' >&2
  exit 1
fi
if [ "$(id -u)" = 0 ]; then
  mkdir -p /data/feedfix /data/metrics /data/study
  chown node:node /data/feedfix /data/metrics /data/study
  chmod 700 /data/feedfix /data/metrics /data/study
  exec gosu node "$@"
fi
exec "$@"
