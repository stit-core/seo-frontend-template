// Атрибуты HTML-элемента, чьё значение — текст для человека: браузер показывает его или читает вслух. Это переводимые
// атрибуты стандарта HTML (код lang — не текст, style запрещён каноном UI, content меты — head оболочки: его тексты тест
// читает по имени меты) и строки ARIA.
// Прочие атрибуты — разметка: адрес, id, состояние, слот, data-*. Список один у lint разметки и теста «текст страницы —
// данные»; модуль листовой — его берёт конфиг ESLint.
export const TEXT_ATTRIBUTES: readonly string[] = [
  'abbr',
  'alt',
  'download',
  'label',
  'placeholder',
  'srcdoc',
  'title',
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-placeholder',
  'aria-valuetext',
  'aria-braillelabel',
  'aria-brailleroledescription',
]

// Подпись кнопки-поля — её `value` у `<input>` этих типов; у `<button>`, `<option>` и прочих полей `value` — данные
// формы, а не текст.
export const BUTTON_TYPES: readonly string[] = ['submit', 'reset', 'button']
