#!/usr/bin/env bash
# 在用户目录运行免安装的 PostgreSQL（解压自 .deb），仅监听 /tmp Unix socket。
set -euo pipefail
PGHOME=/workspace/.pgsql/pg
DATA=/workspace/.pgsql/data
export LD_LIBRARY_PATH="$PGHOME/usr/lib/aarch64-linux-gnu:$PGHOME/usr/lib/postgresql/15/lib"
BIN="$PGHOME/usr/lib/postgresql/15/bin"
export PGHOST=/tmp PGPORT=55432 PUSER=app

case "${1:-status}" in
  start)
    if "$BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then echo "already running"; exit 0; fi
    "$BIN/pg_ctl" -D "$DATA" -l /workspace/.pgsql/pg.log start
    ;;
  stop)
    "$BIN/pg_ctl" -D "$DATA" stop -m fast
    ;;
  status)
    "$BIN/pg_ctl" -D "$DATA" status
    ;;
  psql)
    "$BIN/psql" -h /tmp -p 55432 -U app eldercare
    ;;
  *)
    echo "usage: $0 start|stop|status|psql"; exit 1;;
esac
