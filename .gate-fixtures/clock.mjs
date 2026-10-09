// Часы фикстур: скрипт гейта, запущенный с `--import` этого модуля, живёт в одном моменте, и «день
// проверки» дат записей (check:content) не сдвигается с днём прогона. Момент — полночь самого
// раннего пояса Земли (UTC+14): там уже 10 октября 2026, а по UTC и в поясе, в котором check:gate
// гоняет скрипты, — ещё девятое.
const NOW = Date.parse('2026-10-09T10:00:00Z')

globalThis.Date = class extends Date {
  constructor(...args) {
    super(...(args.length === 0 ? [NOW] : args))
  }

  static now() {
    return NOW
  }
}
