#!/usr/bin/env bash
# template-update.sh — обвязка шаблона в форк: изменения путей шаблона (.template/paths) от версии форка
# (.template/version) до тега шаблона — трёхсторонним слиянием git.
#
#   pnpm template:update                      версия форка, новые теги шаблона и их аннотации
#   pnpm template:update TO=vX.Y.Z            перенести изменения до тега TO
#   pnpm template:update TO=… FROM=<коммит>   база переноса — этот коммит шаблона
#   pnpm template:update TO=… PATHS='<пути>'  тем же переносом — и код форка по этим путям (каталог, файл или
#                                             :(exclude)<путь>): разделы «Безопасность» и «Платформа» аннотаций
#   pnpm template:update TO=… PATHS=-         код форка не брать: аннотации интервала с этими разделами без
#                                             PATHS — отказ (после переноса движок их код не возьмёт)
#   pnpm template:update --status             строка версии обвязки (без сети)
#   pnpm template:update --remote             теги remote template (git ls-remote, без записи): exit 0 — новее
#                                             версии форка нет, 1 — есть или remote нет, 2 — не ответил
#
# Теги шаблона — vX.Y.Z, а в форке vX.Y.Z — его релизы: перенос кладёт теги шаблона в своё пространство ссылок
# refs/template/*, их не уносит git push --tags форка и не встречает его релиз. Теги — из remote `template`
# (git remote add --no-tags template <url шаблона>). Первый перенос форка идёт от коммита шаблона, из которого он
# создан (дерево первого коммита форка), следующие — от .template/version. Конфликты остаются в индексе
# (git status — UU, AA); файл, которого в форке нет, и удалённый шаблоном файл, который форк менял, не трогаются и
# называются. pnpm-lock.yaml — не путь шаблона: после переноса — pnpm install.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$(git rev-parse --show-toplevel)"

fail() { echo "FAIL: $*" >&2; exit 1; }
version() { cat .template/version 2>/dev/null || true; }
latest() { git for-each-ref --sort=-v:refname --count=1 --format='%(refname:strip=2)' 'refs/template/v*'; }
# newer A B — тег B новее тега A.
newer() { [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -1)" = "$2" ]; }
# canon — это репо шаблона: правило одно с гейтом (scripts/lib/template.mjs — по origin).
canon() {
    node --input-type=module -e 'import { pathToFileURL } from "node:url"
const { isCanonical } = await import(pathToFileURL(process.argv[1]).href)
process.exit(isCanonical(process.cwd()) ? 0 : 1)' "$here/lib/template.mjs" 2>/dev/null
}
# glob P — путь для --exclude git apply: скобки маршрутов ([key].txt.ts) он читает как шаблон имени.
glob() { sed 's/[][*?]/[&]/g' <<<"$1"; }
# Разделы аннотации тега шаблона; пункты кода форка — в двух из них.
sections='Breaking|Гейт|Безопасность|Обвязка|Платформа|Как обновиться' fork='Безопасность|Платформа'
# message REF — аннотация тега без подписи: подпись отделяет сам git (contents:signature).
message() {
    local all sig
    all=$(git for-each-ref --format='%(contents)' "$1") sig=$(git for-each-ref --format='%(contents:signature)' "$1")
    printf '%s\n' "${all%"$sig"}"
}

if [ "${1:-}" = "--status" ]; then
    v=$(version) l=$(latest)
    if [ -z "$v" ]; then
        echo "версии обвязки нет (.template/version)"
    elif canon; then
        if git rev-parse -q --verify "refs/tags/$v" >/dev/null; then
            echo "$v +$(git rev-list --count "refs/tags/$v..HEAD") — канон шаблона"
        else
            echo "$v — канон шаблона, тега $v ещё нет"
        fi
    elif [ -n "$l" ] && newer "$v" "$l"; then
        echo "$v · в шаблоне новее: $l → pnpm template:update"
    elif [ -n "$l" ]; then
        echo "$v · новее известных тегов шаблона нет (теги remote — pnpm template:update --remote)"
    else
        echo "$v · тегов шаблона в репо нет — теги remote называет pnpm template:update --remote"
    fi
    exit 0
fi

# Сеть — не ошибка: ни запроса пароля, ни ожидания дольше timeout.
if [ "${1:-}" = "--remote" ]; then
    v=$(version)
    if [ -n "$v" ] && canon; then
        echo "$v — канон шаблона"
        exit 0
    fi
    git remote get-url template >/dev/null 2>&1 || {
        echo "remote template не заведён — о новых тегах шаблона не узнать: git remote add --no-tags template <url шаблона>"
        exit 1
    }
    deadline=()
    ! command -v timeout >/dev/null || deadline=(timeout 30)
    ssh=${GIT_SSH_COMMAND:-$(git config core.sshCommand || echo ssh)}
    tags=$(GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND="$ssh -o BatchMode=yes -o ConnectTimeout=10" \
        "${deadline[@]}" git ls-remote --tags --refs template 'refs/tags/v*' 2>/dev/null) || {
        echo "remote template не ответил — теги шаблона не проверены"
        exit 2
    }
    l=$(sed -n 's#.*refs/tags/##p' <<<"$tags" | sort -V | tail -1)
    if [ -n "$l" ] && { [ -z "$v" ] || newer "$v" "$l"; }; then
        echo "${v:-версии обвязки нет} · в шаблоне новее: $l → pnpm template:update"
        exit 1
    fi
    echo "${v:-—} · новее тегов шаблона нет"
    exit 0
fi

TO="" FROM="" PATHS=""
for arg; do
    case $arg in
    TO=*) TO=${arg#TO=} ;;
    FROM=*) FROM=${arg#FROM=} ;;
    PATHS=*) PATHS=${arg#PATHS=} ;;
    --) ;;
    *) fail "$arg — не TO=, FROM=, PATHS=, --status или --remote" ;;
    esac
done
v=$(version)
git remote get-url template >/dev/null 2>&1 ||
    fail "нет remote template — git remote add --no-tags template <url шаблона>"
git fetch -q --no-tags template 'refs/tags/v*:refs/template/v*'
[ -z "$TO" ] || { [[ $TO =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] && git rev-parse -q --verify "refs/template/$TO" >/dev/null; } ||
    fail "TO=$TO — не тег шаблона vX.Y.Z (список — pnpm template:update)"
# Перенос до своей же версии её не сдвинул бы: следующий перенос повторил бы те же правки.
[ -z "$TO" ] || [ -z "$v" ] || newer "$v" "$TO" ||
    fail "TO=$TO не новее версии форка $v — перенос до тега новее (список — pnpm template:update)"

# До первого переноса (версия та же, что в первом коммите форка) база — коммит шаблона с деревом
# первого коммита: «Use this template» копирует кончик main, а он обычно новее тега версии.
root=$(git rev-list --max-parents=0 HEAD | tail -1) tag=${TO:-$(latest)} based=""
if [ -z "$FROM" ] && [ -n "$tag" ] && [ "$(git show "$root:.template/version" 2>/dev/null || true)" = "$v" ]; then
    # awk дочитывает лог: ранний exit оборвал бы git log по SIGPIPE, и pipefail уронил бы перенос молча.
    FROM=$(git log --format='%H %T' "refs/template/$tag" | awk -v t="$(git rev-parse "$root^{tree}")" '$2 == t && !n++ { print $1 }')
    # Форк с коммита тега своей версии: база — сам тег.
    [ -z "$FROM" ] || [ "$FROM" != "$(git rev-parse -q --verify "refs/template/$v^{commit}" || true)" ] || FROM=$v
    # Форк правили до первого коммита: такого коммита шаблона нет, база — тег версии, и об этом надо знать.
    [ -n "$FROM" ] || [ -z "$v" ] ||
        based="база переноса: $v — коммита шаблона с деревом первого коммита форка нет (его правили до первого коммита): сверь итог, другая база — FROM=<коммит шаблона>"
fi
FROM=${FROM:-$v}
[ -n "$FROM" ] || fail "базы нет: ни .template/version, ни коммита шаблона с деревом первого коммита форка — FROM=<коммит шаблона>"
# Версия — тег шаблона: имя vX.Y.Z git иначе взял бы из refs/tags — релиз форка.
from=$FROM
if [[ $FROM =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    from=refs/template/$FROM
    git rev-parse -q --verify "$from" >/dev/null || fail "FROM=$FROM: тега шаблона $FROM нет"
fi
git rev-parse -q --verify "$from^{commit}" >/dev/null || fail "FROM=$FROM: такой ревизии нет"

if [ -z "$TO" ]; then
    echo "обвязка форка: ${v:-—}"
    [ -z "$based" ] || echo "$based"
    if [ "$FROM" != "$v" ]; then
        echo "база переноса: $FROM — коммит шаблона, из которого создан форк"
        echo "форк создан не с тега: что из пунктов аннотаций ниже у него уже есть — git log --oneline $FROM..refs/template/<тег>"
    fi
    last=""
    for t in $(git for-each-ref --sort=v:refname --no-merged "$from" --format='%(refname:strip=2)' 'refs/template/v*'); do
        [ -z "$v" ] || newer "$v" "$t" || continue
        echo
        message "refs/template/$t" | sed 's/^/  /'
        last=$t
    done
    [ -n "$last" ] || { echo "новее тегов шаблона нет"; exit 0; }
    echo "перенос: pnpm template:update TO=<тег> PATHS='<пути>' (или PATHS=- — без кода форка)"
    exit 0
fi

to=refs/template/$TO
! git merge-base --is-ancestor "$to" "$from" || fail "обвязка форка уже содержит $TO (база $FROM)"
[ -z "$(git status --porcelain)" ] || fail "дерево не чистое — закоммить или спрячь (git stash -u)"

# Пункты «Безопасность» и «Платформа» аннотаций интервала — код форка вне путей шаблона. Перенос берёт его только
# вместе с обвязкой (PATHS): после переноса версия форка — TO, и код этого интервала движку уже не взять.
items=$(for t in $(git for-each-ref --sort=v:refname --merged "$to" --no-merged "$from" --format='%(refname:strip=2)' 'refs/template/v*'); do
    message "refs/template/$t" | awk -v t="$t" -v f="$fork" '
        $0 ~ ("^(" f "):[ \t]*$") { on = 1; print "  " t " " $0; next }
        /^[ \t]*$/ || /^[^ \t-]/ { on = 0 }
        on { print "    " $0 }'
done)
if [ -z "$PATHS" ] && [ -n "$items" ]; then
    { echo "пункты кода форка до $TO (аннотации тегов):"; echo "$items"; } >&2
    fail "реши их до переноса — после него код этого интервала движок не возьмёт: PATHS='<пути>' — перенести, PATHS=- — не брать (отказ — с причиной в теле коммита)"
fi
[ "$PATHS" != - ] || PATHS=""

mapfile -t paths < <({ git show "$from:.template/paths" 2>/dev/null || true; git show "$to:.template/paths"; } |
    grep -vE '^[[:space:]]*(#|$)' | sort -u)
# Пути — через пробел или с новой строки: read без -d читал бы одну строку и молча терял остальные.
read -r -d '' -a extra <<<"$PATHS" || true
for p in "${extra[@]}"; do
    q=${p#:(exclude)}
    # Опечатка в пути промолчала бы: перенос без этого пути выглядит так же, как перенос без изменений в нём.
    git cat-file -e "$to:$q" 2>/dev/null || git cat-file -e "$from:$q" 2>/dev/null ||
        fail "PATHS: $q — нет ни в $TO, ни в базе $FROM"
    [ "$q" = "$p" ] || continue
    # :(exclude) шаблона сильнее пути PATHS: перенос молча прошёл бы без него.
    while IFS= read -r x; do
        if [ "$q" = "$x" ] || [[ $q == "$x"/* ]]; then
            fail "PATHS: $q — путь форка: .template/paths его исключает (:(exclude)$x) — нужное из шаблона: git show $to:<путь>"
        fi
    done < <(printf '%s\n' "${paths[@]}" | sed -n 's/^:(exclude)//p')
done
paths+=("${extra[@]}")

# git apply атомарен: правка файла, которого в форке нет, или удаление файла, который форк менял,
# сорвали бы перенос целиком. Файл, удалённый и шаблоном, и форком, решать не нужно. Имена — через -z:
# путь не в ASCII (фикстуры гейта) git иначе печатает в кавычках.
absent=() kept=() excludes=()
while IFS= read -r -d '' st && IFS= read -r -d '' f; do
    if [ "$st" != A ] && [ ! -e "$f" ]; then
        excludes+=("--exclude=$(glob "$f")")
        [ "$st" = D ] || absent+=("$f")
    elif [ "$st" = D ] && [ "$(git hash-object -- "$f")" != "$(git rev-parse "$from:$f")" ]; then
        excludes+=("--exclude=$(glob "$f")")
        kept+=("$f")
    fi
done < <(git diff -z --no-renames --name-status "$from" "$to" -- "${paths[@]}")

patch=$(git rev-parse --git-path template-update.patch)
git diff --binary --no-renames "$from" "$to" -- "${paths[@]}" >"$patch"
if [ -s "$patch" ] && ! out=$(git apply -3 "${excludes[@]}" "$patch" 2>&1) &&
    [ -z "$(git diff --name-only --diff-filter=U)" ]; then
    echo "$out" >&2
    rm -f "$patch"
    fail "git apply не перенёс изменения (вывод выше), дерево не тронуто"
fi
rm -f "$patch"

conflicts=$(git -c core.quotePath=false diff --name-only --diff-filter=U)
echo "обвязка: $FROM → $TO, файлов в индексе: $(git diff --cached --name-only | wc -l | tr -d ' ')"
[ -z "$based" ] || echo "$based"
[ ${#extra[@]} -eq 0 ] || echo "код по запросу (PATHS): ${extra[*]}"
[ -z "$items" ] || { echo "пункты кода форка до $TO — в теле коммита — перенесено или отклонено:"; echo "$items"; }
[ -z "$conflicts" ] || { echo "конфликты — разреши и git add:"; sed 's/^/  /' <<<"$conflicts"; }
[ ${#absent[@]} -eq 0 ] || { echo "нет в форке — не тронуты:"; printf '  %s\n' "${absent[@]}"; }
[ ${#kept[@]} -eq 0 ] || { echo "шаблон удалил, форк менял — реши сам:"; printf '  %s\n' "${kept[@]}"; }
echo "дальше: шаги аннотаций тегов до $TO, pnpm install, pnpm check, коммит"
[ -z "$conflicts" ] && [ ${#kept[@]} -eq 0 ]
