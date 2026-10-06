#!/usr/bin/env bash
# .claude/hooks/guard-bash.sh — PreToolUse(Bash): не пускает из сессии Claude обходы git-хуков
# (их ставит lefthook, `lefthook.yml`) и force-push. exit 2 блокирует вызов, stderr уходит Claude.
#
# Блокирует: git commit с -n; git с --no-veri… (любая подкоманда); git push с --force…, -f или
# +refspec; core.hooksPath и переменные lefthook, которые выключают или подменяют хук (LEFTHOOK,
# LEFTHOOK_EXCLUDE, LEFTHOOK_BIN, LEFTHOOK_CONFIG), в команде с git или lefthook; lefthook
# uninstall; запись в .git/hooks и в lefthook-local (rm, mv, chmod… или перенаправление).
# Команда проверяется построчно; тела heredoc — данные (сообщение коммита может упоминать
# флаги); флаги и переменные в строках в кавычках не ищутся, кроме тела `bash -c "…"` и
# `eval "…"`. Это страховка от «удобного» обхода, а не от обфускации (`echo … | bash`, алиасы).
# Сценарии — .gate-fixtures/guard.json, их держит pnpm check:gate.
set -uo pipefail

block() {
    echo "guard-bash: $1 — обход гейта. Почини причину падения; обойти гейт может только человек." >&2
    exit 2
}

# Значение "command" из JSON без jq: \" — вручную, остальное экранирование — printf %b.
raw=$(sed -nE 's/.*"command"[[:space:]]*:[[:space:]]*"(([^"\\]|\\.)*)".*/\1/p' | head -n 1)
cmd=$(printf '%b' "$(printf '%s' "$raw" | sed 's/\\"/"/g')")

# Без тел heredoc: от строки с `<<WORD` до строки-терминатора WORD.
text=$(printf '%s\n' "$cmd" | awk '
    body != "" { line = $0; sub(/^\t+/, "", line); if (line == body) body = ""; next }
    { print }
    match($0, /(^|[^<])<<-?[ \t]*["'\'']?[A-Za-z_][A-Za-z0-9_]*/) {
        body = substr($0, RSTART, RLENGTH); sub(/^[^<]*<<-?[ \t]*["'\'']?/, "", body)
    }')

# `bash -c "…"` (и `-lc`, `-c --`), `sh -c '…'`, `eval "…"` — та же команда: кавычки обёртки
# снимаются до разбора.
wrap="(((ba|z|da)?sh)[[:space:]]+-[a-zA-Z]*c[a-zA-Z]*([[:space:]]+--)?|eval)[[:space:]]+"
text=$(printf '%s' "$text" | sed -E \
    -e "s/(^|[;&|(\`[:space:]])$wrap\"(([^\"\\\\]|\\\\.)*)\"/\1 \6/g" \
    -e "s/(^|[;&|(\`[:space:]])$wrap'([^']*)'/\1 \6/g")

# Команда без строк в кавычках: сообщение коммита и шаблон grep — данные, а не присваивание.
bare=$(printf '%s' "$text" | tr '\n' ';' | sed -E -e 's/"([^"\\]|\\.)*"//g' -e "s/'[^']*'//g")

# Переменные и ключ конфига опасны только рядом с git или lefthook: grep по ним не блокируется.
re_tool='(^|[^[:alnum:]_.-])(git|lefthook)([[:space:]]|$)'
re_env='(^|[^[:alnum:]_])LEFTHOOK(_EXCLUDE|_BIN|_CONFIG)?='
if [[ $bare =~ $re_env ]] && [[ $bare =~ $re_tool ]]; then block "переменная lefthook"; fi
if [[ $(printf '%s' "$text" | tr '[:upper:]' '[:lower:]') == *core.hookspath* && $text =~ $re_tool ]]; then
    block "core.hooksPath"
fi

# Хук и его локальная подмена живут вне диффа: запись туда — тот же обход, что uninstall.
re_hooks='(\.git/hooks|lefthook-local)'
re_write="(^|[;&|(\`[:space:]])(rm|mv|cp|chmod|ln|unlink|truncate|tee|install)[[:space:]][^;&|]*$re_hooks"
re_redirect=">[[:space:]]*[^;&|[:space:]]*$re_hooks"
if [[ $text =~ $re_write || $text =~ $re_redirect ]]; then block "запись в .git/hooks или lefthook-local"; fi

# Флаги git ищем вне кавычек, по сегментам: строки (с учётом `\` в конце) и части между
# ; & | ( ) и обратными кавычками.
segments=$(printf '%s' "$text" | sed -e ':a' -e '/\\$/{N;s/\\\n//;ba' -e '}' | tr '\n' ';' |
    sed -E -e 's/"([^"\\]|\\.)*"//g' -e "s/'[^']*'//g" | tr ';&|()`' '\n\n\n\n\n\n')
while read -r -a words; do
    git=0 sub="" skip=0 lefthook=0
    for w in ${words[@]+"${words[@]}"}; do
        if [ "$git" = 0 ]; then
            [[ $lefthook == 1 && $w == uninstall ]] && block "lefthook uninstall"
            [[ $w == lefthook || $w == */lefthook ]] && lefthook=1
            [[ $w == git || $w == */git ]] && git=1
        elif [ -z "$sub" ]; then # подкоманда — первое слово не-флаг, кроме значений -C/-c/--git-dir…
            case "$w" in
                -C | -c | --git-dir | --work-tree | --namespace) skip=1 ;;
                -*) ;;
                *) if [ "$skip" = 1 ]; then skip=0; else sub=$w; fi ;;
            esac
        else
            case "$w" in
                --no-veri*) block "git $sub $w" ;;
                --force*) [[ $sub == push ]] && block "git push $w" ;;
                +*) [[ $sub == push ]] && block "git push $w" ;;
                # Кластер коротких флагов до первого флага со значением: commit -an, push -uf.
                -[a-zA-Z]*)
                    [[ $sub == commit && ${w%%[mFcCtS]*} == *n* ]] && block "git commit $w"
                    [[ $sub == push && ${w%%[oO]*} == *f* ]] && block "git push $w"
                    ;;
            esac
        fi
    done
done <<<"$segments"
exit 0
