#!/bin/sh
# Старт контейнера: штамповка origin в prerendered-выход (docker/stamp.mjs), затем команда.
# exec — команда заменяет процесс оболочки, и сигналы контейнера доходят до node.
set -eu

node "$(dirname "$0")/stamp.mjs"
exec "$@"
