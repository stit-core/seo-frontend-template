#!/usr/bin/env bash
# pre-push (lefthook.yml): без CI это последний рубеж — `pnpm check` на том, что уходит в remote.
# Гейт проверяет рабочее дерево, поэтому пушится только чистый HEAD: иначе незакоммиченная правка
# озеленит сломанный коммит, а неотслеживаемый файл уронит чистый.
#
# Обход — только руками человека (`git push --no-verify`); из сессии Claude его и выключение
# lefthook блокирует .claude/hooks/guard-bash.sh.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

if [ -n "$(git status --porcelain)" ]; then
    echo "pre-push: дерево не чистое — pnpm check проверил бы не то, что уходит в remote."
    echo "Закоммить или спрячь изменения (git stash -u):"
    git status --short | sed 's/^/  /'
    exit 1
fi

# stdin: <local ref> <local sha> <remote ref> <remote sha> на каждый пушимый ref.
head=$(git rev-parse HEAD)
while read -r local_ref local_sha _ _; do
    [[ $local_sha =~ ^0+$ ]] && continue # удаление ref: проверять нечего
    if [ "$(git rev-parse "$local_sha^{commit}")" != "$head" ]; then
        echo "pre-push: $local_ref указывает не на HEAD — pnpm check проверяет только HEAD."
        echo "Переключись на пушимый коммит и повтори push."
        exit 1
    fi
done

exec pnpm check
