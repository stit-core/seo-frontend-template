import js from '@eslint/js'
import * as astroParser from 'astro-eslint-parser'
import { defineConfig } from 'eslint/config'
import astro from 'eslint-plugin-astro'
import boundaries from 'eslint-plugin-boundaries'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const EXT = ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.astro']
// Код слайсов любого расширения: frontmatter .astro, модули, клиентские <script> (виртуальные
// файлы `<компонент>.astro/<n>.ts` процессора Astro).
const SRC_CODE = 'src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs,astro}'
const CLIENT_SCRIPTS = 'src/**/*.astro/*.{ts,js}'
// Входы, навязанные Astro: тонкие связки, не слой. Новый вход (Actions…) — строкой здесь.
const ASTRO_ENTRIES = 'src/{middleware,content.config,env.d}.ts'

// Границы FSD держит именно ESLint: резолвер видит цели любого расширения (в т.ч. .astro),
// а `no-restricted-imports` ловит deep-import по форме спецификатора без резолва вовсе.
const fsdSettings = {
  'boundaries/dependency-nodes': ['import', 'dynamic-import', 'export'],
  'boundaries/elements': [
    // app режется по сегментам: pages могут импортировать только app/layouts (см. policies).
    { type: 'app', pattern: 'src/app/*', capture: ['segment'] },
    { type: 'pages', pattern: 'src/pages/**', partialMatch: false },
    { type: 'widgets', pattern: 'src/widgets/*', capture: ['slice'] },
    { type: 'features', pattern: 'src/features/*', capture: ['slice'] },
    { type: 'entities', pattern: 'src/entities/*', capture: ['slice'] },
    { type: 'shared', pattern: 'src/shared/**', partialMatch: false },
  ],
  'boundaries/files': [{ category: 'astro-entry', pattern: ASTRO_ENTRIES }],
  'boundaries/include': ['src/**'],
  'import/resolver': { typescript: { project: './tsconfig.json', extensions: EXT } },
}

// Зависимости внутри одного элемента (слайс → свой сегмент, shared → shared) плагин
// не оценивает, поэтому политики только между элементами.
const to = (...types) => types.map((type) => ({ to: { element: { type } } }))
const appLayouts = { to: { element: { type: 'app', captured: { segment: 'layouts' } } } }

const publicApiPatterns = [
  {
    group: ['@/entities/*/*', '@/features/*/*', '@/widgets/*/*', '@/pages/*/*'],
    message: 'FSD: импорт мимо public API слайса',
  },
  {
    group: [
      '@/shared/*/*',
      '!@/shared/ui/*',
      '!@/shared/lib/*',
      '@/shared/ui/*/*',
      '@/shared/lib/*/*',
    ],
    message: 'FSD: импорт мимо public API сегмента shared',
  },
  {
    // Относительный путь, вышедший из слайса в каталог слоя, — импорт мимо `@/`: public API и
    // направление слоёв читаются только по алиасу.
    regex: String.raw`^(\.\.?/)+(app|pages|widgets|features|entities|shared)/`,
    message:
      'FSD: из слайса наружу — только `@/<layer>/<slice>`, относительный путь — внутри слайса',
  },
]

// Гейт — потребитель кода src, а не его зависимость: модуль scripts/ (разбор HTML, node:*) коду
// приложения не нужен, а связь стала бы двусторонней. Общие данные живут в src (реестр островов —
// shared/config), гейт берёт их оттуда; тест скрипта гейта импортирует его законно.
const GATE_SCRIPTS = {
  regex: String.raw`^(\./)?(\.\./)+scripts/`,
  message: 'FSD: код src не импортирует scripts/ — общие данные гейта и сайта живут в src',
}

// Стили — один токен-слой: CSS UI-кита или пакета приносит свои цвета и размеры мимо токенов.
const importPatterns = [
  ...publicApiPatterns,
  {
    group: ['*.css', '!@/app/styles/index.css'],
    message: 'UI: стили — только токен-слой @/app/styles/index.css, CSS UI-китов и пакетов нет',
  },
  GATE_SCRIPTS,
]

// Клиентский <script> исполняется в браузере: импортирует только модули без серверного кода.
// Баррель тянет в бандл всё, что за ним (`@/shared/config` — это Zod и env процесса).
const CLIENT_MODULES = ['@/shared/lib', '@/shared/i18n']
const clientPatterns = [
  ...importPatterns,
  {
    regex: String.raw`^(?!\.\.?/|(${CLIENT_MODULES.join('|')})$)`,
    message: `FSD: клиентскому <script> — только свой слайс и ${CLIENT_MODULES.join(', ')}`,
  },
]

const fsdRules = {
  'boundaries/dependencies': [
    'error',
    {
      default: 'disallow',
      policies: [
        {
          // app не импортирует pages: страница сама импортирует документ-шелл, и обратная
          // зависимость дала бы цикл.
          from: [{ element: { type: 'app' } }],
          allow: to('app', 'widgets', 'features', 'entities', 'shared'),
        },
        {
          from: [{ element: { type: 'pages' } }],
          // Astro не оборачивает страницы снаружи — страница сама импортирует документ-шелл.
          // Это единственный разрешённый импорт вверх.
          allow: [appLayouts, ...to('widgets', 'features', 'entities', 'shared')],
        },
        { from: [{ element: { type: 'widgets' } }], allow: to('features', 'entities', 'shared') },
        { from: [{ element: { type: 'features' } }], allow: to('entities', 'shared') },
        { from: [{ element: { type: 'entities' } }], allow: to('shared') },
        { from: [{ file: { categories: 'astro-entry' } }], allow: to('app', 'entities') },
      ],
    },
  ],
  // Файл вне слоёв (src/components, src/lib…) — мимо всех границ сразу.
  'boundaries/no-unknown-files': 'error',
  'no-restricted-imports': ['error', { patterns: importPatterns }],
}

// Среда — runtime env через getRuntimeConfig(): `import.meta.env.<KEY>` Vite подставляет на сборке
// (секрет уехал бы в бандл); `DEV` — признак `astro dev` для черновиков. Сам объект `import.meta.env`
// — в любом месте, кроме `.DEV`: ключ, деструктуризация, присваивание.
const importMetaEnv = {
  selector:
    "MemberExpression[object.type='MetaProperty'][property.name='env']:not(MemberExpression[property.name='DEV'] > *)",
  message: 'env: из import.meta.env — только DEV; конфигурация среды — getRuntimeConfig()',
}

// Строка словаря — фраза целиком: порядок слов, место числа и имени задаёт словарь языка подстановкой `{имя}`, а
// склейка в коде (шаблонная строка, `+`) закрепила бы порядок одного языка. Склейку в разметке (строка и элемент
// рядом) держит ревью.
const dictConcat = {
  selector:
    "TemplateLiteral > CallExpression[callee.name='t'], BinaryExpression[operator='+'] > CallExpression[callee.name='t']",
  message:
    'i18n: строка словаря не склеивается с другой — подстановка `{имя}` в строке словаря языка',
}

// Значение разметки — только роль слоя сопоставления src/app/styles/index.css. Мимо него ведут
// литерал цвета, число в утилите (шкала Tailwind или пиксели), скобки в классе (произвольное
// значение и `(--переменная)`) и `var()` — переменная ДС напрямую.
// `url(#id)` — ссылка на градиент или маску SVG, а не цвет.
const FUNCTION_COLOR = String.raw`\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(`
const HEX = String.raw`(?<!url\(['"]?)#[0-9a-f]{3,8}\b`
const COLOR = `${HEX}|${FUNCTION_COLOR}`
// В CSS hex-цвет — значение объявления: за ним `;` или `}` раньше `{`; `#add {` — id-селектор.
const CSS_COLOR = `${HEX}[^{};]*[;}]|${FUNCTION_COLOR}`
// Цвет словом (`tomato`, системный `Canvas`): всё, что не ключевое слово без своего цвета.
const NO_COLOR = 'currentcolor|inherit|transparent|none|auto|initial|unset|revert'
const SVG_COLOR = 'fill|stroke|color|stop-color|flood-color|lighting-color'
const NAMED_COLOR = `^(?!(?:${NO_COLOR}|context-fill|context-stroke|freeze|remove)$)[a-z-]+$`
// Имя свойства в CSS: не хвост другого имени, не класс или id селектора (`.stroke:hover`) и не
// условие `@media`, `@container` (`(max-width: 30rem)` — граница, а не объявление).
const property = (names) => String.raw`(?<![\w.#(-])(?:${names})\s*:`
const CSS_NAMED_COLOR = `${property(
  'color|background-color|border(?:-[a-z-]+)?-color|outline-color|text-decoration-color|fill|stroke|caret-color|accent-color',
)}${String.raw`\s*(?!(?:${NO_COLOR})\b)[a-z]+(?![\w(-])`}`
// Типографика, отступы, радиусы и линии — роли: число в их объявлении (кроме нуля) — значение
// мимо роли. Цифра в имени переменной и в hex-цвете числом не считается.
const CSS_LOOK = `${property(
  'font(?:-size|-weight)?|line-height|letter-spacing|(?:margin|padding)(?:-[a-z-]+)?|(?:row-|column-)?gap|border(?:-[a-z-]+)?|outline(?:-width|-offset)?',
)}${String.raw`[^;{}]*(?<![\w#]|\w-)(?:\d*\.)?\d*[1-9]`}`
const CSS_COLOR_SCHEME = String.raw`(?<![\w-])color-scheme\s*:`
// Числовая утилита — число или `px` на месте значения (`px-6`, `-mt-1.5`, `w-1/2`, `h-px`). Счёт,
// порядок и место в сетке — не значение облика, ноль — сброс: `grid-cols-2`, `col-start-2`, `z-10`
// и `inset-0` законны; число перед `:` — счёт варианта (`nth-2:`).
const COUNT =
  'flex|order|z|grid-cols|grid-rows|col-span|row-span|col-start|col-end|row-start|row-end|grow|shrink|columns|line-clamp'
const NUMERIC = String.raw`(?<![\w-])-?(?!(?:${COUNT})-\d+(?![\w.\/-]))[a-z][a-z-]*-(?!0(?![\w.\/]))(?:px|\d+(?:[.\/]\d+)?)(?![\w:-])`
// Ключевое слово со своим значением там, где значение несёт роль: интерлиньяж — у роли текста,
// скругление — у роли радиуса, линия обводки и кольца — у `border.*`, кривая перехода — у роли
// `motion.*`, фильтр — без роли вовсе.
// Перечень — утилиты Tailwind без числа в имени, которые при выключенной теме дают литерал.
const KEYWORD = String.raw`(?<![\w-])(?:leading-none|rounded(?:-[a-z]{1,2})?-full|outline|(?:inset-)?ring|(?:backdrop-)?(?:grayscale|invert|sepia)|ease-linear)(?![\w-])`
// Скобки — произвольное значение, свойство, вариант и `(--переменная)`. Условие по атрибуту
// (`aria-[current=page]:`, `data-[state=open]:`) значения не несёт.
const ARBITRARY = String.raw`(?<!(?:aria|data)-)\[|\](?!:)|[()]`
const SCHEME = String.raw`(?<![\w-])scheme-[a-z-]+(?![\w-])`
// Ширина контейнера: роль `max-w-*` и `container` Tailwind (границы раскладки значениями); в CSS —
// `max-width` длиной (процент — доля родителя, страницу он не сужает). Ключевое слово без длины
// (`max-w-none`, `max-w-full`, `max-w-fit`) страницу не сужает, `@container` — контейнер запросов.
const CONTAINER_WIDTH = String.raw`(?<![\w@-])(?:container|max-w-(?!(?:none|full|fit|min|max|screen|[sld]vw|0)(?![\w-]))[\w-]+)(?![\w-])`
const CSS_CONTAINER_WIDTH = `${property('max-(?:width|inline-size)')}${String.raw`[^;{}]*\d(?![\d.]*%)`}`
const DS_VARIABLE = String.raw`var\(\s*--`
// Тему компонент не знает: цвет темы несёт роль файла токенов, состояние кнопки — `aria-pressed`.
// Своё условие темы — в `<style>` или вариантом класса — разошлось бы с выбором посетителя.
const CSS_THEME = String.raw`prefers-color-scheme|data-theme|light-dark\(`
const THEME_VARIANT = String.raw`(?<!\w)dark:|data-\[theme\b`
// Движение — анимация, переход размера и положения, плавная прокрутка — объявляется под вариантом
// `motion:` слоя сопоставления: он знает и настройку системы, и выбор посетителя (`data-motion`).
// Отклик без смещения — `transition-colors`, `transition-opacity` — остаётся при любом выборе.
// `motion-safe:` и `motion-reduce:` читают только систему и расходятся с выбором.
const MOTION = String.raw`(?<![\w:-])(?:(?!motion:)[^\s:]+:)*(?:animate-(?!none(?![\w-]))[\w-]+|transition(?!-(?:colors|opacity|none)(?![\w-]))(?:-[\w-]+)?|scroll-smooth)(?![\w-])|(?<![\w-])motion-(?:safe|reduce):`
// В `<style>` движения нет: анимацию и её роли объявляет слой, компонент берёт её утилитой.
const CSS_MOTION = `${property('transition(?:-[a-z-]+)?|animation(?:-[a-z-]+)?|scroll-behavior')}|@keyframes|prefers-reduced-motion|data-motion`
const CLASS = "JSXAttribute:matches([name.name='class'], [name.namespace.name='class'])"
const STYLE = "JSXElement[openingElement.name.name='style'] > AstroRawText"
// Строка разметки — литерал, кусок шаблонной строки или ключ-имя объекта `class:list`.
const text = (pattern) =>
  `:matches(Literal[value=/${pattern}/i], TemplateElement[value.raw=/${pattern}/i], Property > Identifier.key[name=/${pattern}/i])`
// Строку класса канон и тест токен-слоя читают в атрибуте: литерал, шаблонная строка, массив,
// объект и условие. Переменная, карта и вызов прячут класс от обоих; чужой класс компонент
// получает пропом `class` — именем `className`.
const OPAQUE =
  ":not(Literal, TemplateLiteral, TemplateElement, ArrayExpression, ObjectExpression, ConditionalExpression, LogicalExpression, Identifier[name='className'], JSXEmptyExpression)"
const OPAQUE_CLASS = [
  `${CLASS} :matches(JSXExpressionContainer, ArrayExpression, TemplateLiteral) > ${OPAQUE}`,
  `${CLASS} ConditionalExpression > ${OPAQUE}:not(.test)`,
  `${CLASS} LogicalExpression > ${OPAQUE}.right`,
  `${CLASS} ObjectExpression > Property[computed=true]`,
].join(', ')
// Страницу собирают секции: ширину контейнера задаёт один примитив `shared/ui/section`. В другом
// месте она сужает страницу мимо него: класс на оболочке загнал бы в колонку каждую страницу.
const containerWidth = {
  selector: `${CLASS} ${text(CONTAINER_WIDTH)}, ${STYLE}[value=/${CSS_CONTAINER_WIDTH}|@apply[^;{}]*${CONTAINER_WIDTH}/i]`,
  message:
    'UI: ширина контейнера (max-w-*, container, max-width) — только примитив секции @/shared/ui/section: страницу собирают Section, каркас — Container',
}
// Сырые <img> и <video> — только в примитивах медиа: мимо них картинка теряет форматы, размеры и роль
// слота, а ролик — постер и условие движения.
const rawMedia = [
  {
    selector: "JSXOpeningElement[name.name='img']",
    message:
      'UI: сырой <img> — только в примитиве @/shared/ui/media: мастер контента — <Picture> из astro:assets (форматы, размеры, LCP), готовый файл ДС — ArtPicture',
  },
  {
    selector: "JSXOpeningElement[name.name='video']",
    message:
      'UI: сырой <video> — только в примитиве @/shared/ui/media: LoopVideo (постер, preload="none", источники под условием движения)',
  },
]
// Текст страницы — данные: страница и блок печатают пропсы (copy deck по ключу page/section/slot, факты), подписи
// интерфейса — строки словаря t(). Литерал с буквами в разметке — узел текста, строка выражения (и ветки && и
// тернарника), литерал атрибута или пропа, set:text и set:html — мимо данных; числа и знаки без букв законны. Это ранний
// сигнал: формы выражений (константа frontmatter, склейка, вызов) держит тест страниц «текст страницы — данные».
const LETTER = String.raw`/\p{L}/u`
const CONTENT = ':matches(JSXElement, JSXFragment) > JSXExpressionContainer'
const BRANCH = `${CONTENT} > :matches(LogicalExpression, ConditionalExpression)`
// Атрибуты и пропсы без текста — по коду страниц, блоков и их фикстур: класс, id и ссылки на id, адрес, тип, имя,
// роль, язык и дата, вид и раскладка примитива, загрузка картинки, состояние ARIA, геометрия и анимация SVG. Литерал с
// буквами в любом другом атрибуте или пропе компонента — текст (подпись, альтернатива, подсказка, проп блока).
const NOT_TEXT = [
  'class',
  'id',
  'for',
  'href',
  'src',
  'action',
  'method',
  'rel',
  'hreflang',
  'lang',
  'type',
  'name',
  'role',
  'datetime',
  'style',
  'labelledby',
  'kind',
  'variant',
  'tone',
  'rhythm',
  'width',
  'ogType',
  'loading',
  'decoding',
  'fetchpriority',
  'fallbackFormat',
  'aria-current',
  'aria-hidden',
  'aria-labelledby',
  'aria-describedby',
  'shape',
  'd',
  'fill',
  'stroke',
  'stop-color',
  'attributeName',
  'dur',
  'repeatCount',
]
const ATTRIBUTE = `:matches(JSXAttribute[name.type='JSXIdentifier'][name.name!=/^(?:${NOT_TEXT.join('|')})$/], JSXAttribute[name.namespace.name='set'])`
const markupText = [
  {
    selector: [
      `JSXText[value=${LETTER}]`,
      `${CONTENT} > Literal[value=${LETTER}]`,
      `${BRANCH} > Literal[value=${LETTER}]`,
      `${CONTENT} > TemplateLiteral > TemplateElement[value.raw=${LETTER}]`,
      `${BRANCH} > TemplateLiteral > TemplateElement[value.raw=${LETTER}]`,
    ].join(', '),
    message:
      'Текст: литерал в разметке страницы и блока — текст секции из copy deck (план strategy, ключ page/section/slot) или подпись интерфейса t()',
  },
  {
    selector: [
      `${ATTRIBUTE} > Literal[value=${LETTER}]`,
      `${ATTRIBUTE} > JSXExpressionContainer > Literal[value=${LETTER}]`,
      `${ATTRIBUTE} > JSXExpressionContainer > TemplateLiteral > TemplateElement[value.raw=${LETTER}]`,
    ].join(', '),
    message:
      'Текст: литерал в атрибуте, пропе компонента или set:text, set:html (подпись, alt, title, проп блока) — текст секции из copy deck или подпись интерфейса t(); атрибут без текста — строка NOT_TEXT eslint.config.js',
  },
]
// Канон разметки .astro (rules shared-ui, render-safety).
const astroSyntax = [
  {
    selector: "JSXNamespacedName[namespace.name='client']",
    message: 'UI: client:* — фреймворка островов нет, остров — инлайн-<script data-island>',
  },
  {
    selector: "JSXAttribute[name.name='style']",
    message: 'UI: инлайн-style — значения через утилиты токен-слоя src/app/styles/index.css',
  },
  {
    // Фокус при загрузке получает только объявление об отказе — сводка ошибок ответа формы. Biome
    // (`noAutofocus`) строчный атрибут внутри выражения шаблона не узнаёт.
    selector:
      "JSXOpeningElement:not(:has(> JSXAttribute[name.name='role'][value.value='alert'])) > JSXAttribute[name.name=/^autofocus$/i]",
    message:
      'UI: autofocus забирает фокус при загрузке страницы — он только у объявления об отказе (role="alert"): сводка ошибок ответа формы',
  },
  {
    selector: OPAQUE_CLASS,
    message:
      'UI: класс из переменной, карты или вызова — строка класса пишется в атрибуте, вариант — условием class:list; чужой класс — проп class (className)',
  },
  {
    selector: `${CLASS} ${text(ARBITRARY)}`,
    message: 'UI: произвольное значение в классе ([…], (--…)) — утилита роли слоя сопоставления',
  },
  {
    selector: `${CLASS} ${text(NUMERIC)}`,
    message:
      'UI: числовая утилита в классе — шаг или роль слоя сопоставления (mt-md); число — счёт и ноль',
  },
  {
    selector: `${CLASS} ${text(KEYWORD)}`,
    message:
      'UI: ключевое слово со своим значением (leading-none, rounded-full, outline, ring, grayscale, ease-linear) — мимо роли: интерлиньяж несёт роль текста, скругление и линию — роли радиуса и border, кривую перехода — роль движения',
  },
  {
    selector: `${CLASS} ${text(SCHEME)}, ${STYLE}[value=/${CSS_COLOR_SCHEME}/i]`,
    message: 'UI: color-scheme объявляет только файл токенов — тему компонент не знает',
  },
  {
    selector: `${STYLE}[value=/${CSS_THEME}/i], ${CLASS} ${text(THEME_VARIANT)}`,
    message:
      'UI: компонент не знает тему (prefers-color-scheme, data-theme, light-dark(), dark:) — цвет темы несёт роль файла токенов, состояние кнопки — aria-pressed',
  },
  {
    // SMIL-анимацию SVG не останавливают ни вариант motion:, ни выбор посетителя: она идёт всегда.
    selector: 'JSXOpeningElement[name.name=/^(?:animate|animateMotion|animateTransform|set)$/]',
    message:
      'UI: SMIL-анимация SVG (<animate>, <animateMotion>, <animateTransform>, <set>) идёт при любом выборе движения — движение только утилитой под вариантом motion:',
  },
  {
    selector: `${CLASS} ${text(MOTION)}, ${STYLE}[value=/${CSS_MOTION}|@apply[^;{}]*(?:${MOTION})/i]`,
    message:
      'UI: движение (animate-*, transition-transform, transition-all, scroll-smooth; transition, animation и @keyframes в <style>) — только утилитой под вариантом motion: он знает систему и выбор посетителя; отклик без смещения — transition-colors, transition-opacity',
  },
  {
    selector: `JSXAttribute ${text(DS_VARIABLE)}`,
    message: 'UI: переменная ДС в разметке — роль берёт утилита слоя сопоставления',
  },
  {
    selector: `${STYLE}[value=/${DS_VARIABLE}/i]`,
    message: 'UI: переменная ДС в <style> — роль берёт утилита слоя сопоставления',
  },
  {
    selector: `${STYLE}[value=/${CSS_COLOR}/i], ${STYLE}[value=/${CSS_NAMED_COLOR}/i]`,
    message: 'UI: сырой цвет в <style> — токен src/app/styles/index.css',
  },
  {
    selector: `${STYLE}[value=/${CSS_LOOK}/i]`,
    message:
      'UI: размер, кегль или линия числом в <style> — утилита роли в разметке; <style> — раскладка',
  },
  {
    selector: `${STYLE}[value=/@apply[^;{}]*(?:${ARBITRARY}|${NUMERIC}|${KEYWORD})/i]`,
    message: 'UI: @apply значения мимо роли в <style> — утилита роли слоя сопоставления',
  },
  {
    selector: `JSXAttribute[name.name=/^(${SVG_COLOR})$/] ${text(COLOR)}, JSXAttribute[name.name=/^(${SVG_COLOR})$/] > Literal[value=/${NAMED_COLOR}/i]`,
    message: 'UI: сырой цвет в атрибуте — currentColor или токен',
  },
  {
    // В разметку из env попадает только origin через absoluteUrl(): на prerender getRuntimeConfig()
    // — значение сборки, а секрет уехал бы в HTML.
    selector:
      "ImportDeclaration[source.value='@/shared/config'] > :matches(ImportSpecifier[imported.name='getRuntimeConfig'], ImportNamespaceSpecifier)",
    message: 'env в разметке: origin — absoluteUrl(), публичные id — site.ts, остальное — .ts фичи',
  },
]

export default defineConfig(
  {
    ignores: [
      'dist/**',
      '.astro/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      '.gate-fixtures/**',
      'docs/**',
      // Worktree агентов: чужая незаконченная работа не роняет lint этого дерева.
      '.claude/**',
    ],
  },
  // Правило выключается только блоком этого файла — с причиной. Комментарий-директива в коде не
  // действует, а её предупреждение роняет `pnpm lint` (`--max-warnings 0`).
  { linterOptions: { noInlineConfig: true } },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs['flat/recommended'],
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    // Логика слайсов и e2e: здесь можно позволить typed-lint.
    files: ['src/**/*.{ts,mts,cts}', 'e2e/**/*.ts'],
    // Виртуальные блоки клиентских <script> (процессор Astro) не лежат на диске: project
    // service их не видит — они разбираются блоком ниже.
    ignores: [CLIENT_SCRIPTS],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/**/*.astro'],
    languageOptions: {
      parser: astroParser,
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.astro'] },
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        ...rawMedia,
        ...astroSyntax,
        containerWidth,
        importMetaEnv,
        dictConcat,
      ],
    },
  },
  {
    // Страница и блок каталога печатают тексты данных: литерал текста в их разметке — ошибка.
    files: ['src/pages/**/*.astro', 'src/widgets/**/*.astro'],
    ignores: ['src/pages/_tests/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...rawMedia,
        ...astroSyntax,
        containerWidth,
        importMetaEnv,
        dictConcat,
        ...markupText,
      ],
    },
  },
  {
    // Примитив секции — единственное место, где задаётся ширина контейнера.
    files: ['src/shared/ui/section/*.astro'],
    rules: {
      'no-restricted-syntax': ['error', ...rawMedia, ...astroSyntax, importMetaEnv, dictConcat],
    },
  },
  {
    // Примитивы медиа — единственное место сырых <img> и <video>.
    files: ['src/shared/ui/media/*.astro'],
    rules: {
      'no-restricted-syntax': ['error', ...astroSyntax, containerWidth, importMetaEnv, dictConcat],
    },
  },
  {
    files: [CLIENT_SCRIPTS],
    languageOptions: {
      parser: tseslint.parser,
      sourceType: 'module',
      parserOptions: { projectService: false },
    },
  },
  {
    // Границы FSD — на всём коде src: модули, frontmatter и клиентские <script>.
    files: [SRC_CODE],
    plugins: { boundaries },
    settings: fsdSettings,
    rules: fsdRules,
  },
  {
    files: [CLIENT_SCRIPTS],
    rules: { 'no-restricted-imports': ['error', { patterns: clientPatterns }] },
  },
  {
    files: ['src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
    rules: { 'no-restricted-syntax': ['error', importMetaEnv, dictConcat] },
  },
  {
    // Public API слайса/сегмента: только explicit re-exports — без своего кода, который баррель
    // исполнил бы у каждого импортёра. Примитивы Astro и Node не раздаются мимо API слайса.
    files: [
      'src/{entities,features,widgets}/*/index.ts',
      'src/shared/*/index.ts',
      'src/shared/{ui,lib}/*/index.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...importPatterns,
            {
              group: ['astro:*', 'node:*'],
              message: 'FSD: примитивы Astro и Node не реэкспортируются из public API слайса',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program > :not(ExportNamedDeclaration[source])',
          message: 'FSD: в index.ts — только `export { x } from "./…"`, без импортов и вызовов',
        },
      ],
    },
  },
  {
    // Лог — один log() из shared/observability: порог LOG_LEVEL, JSON-строка без PII.
    files: [SRC_CODE],
    ignores: ['src/shared/observability/log.ts', 'src/**/*.test.ts'],
    rules: { 'no-console': 'error' },
  },
  {
    // Среда — только getRuntimeConfig(): на prerender process.env — значение сборки, не контейнера.
    files: [SRC_CODE],
    ignores: ['src/shared/config/**', 'src/**/*.test.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'env — только через getRuntimeConfig() из @/shared/config (rule env-local)',
        },
      ],
    },
  },
  {
    // Точки входа, навязанные Astro: server-only код и коллекции контента
    // импортируются напрямую из модуля слайса, не через баррель.
    files: [ASTRO_ENTRIES],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // Тело 410 — HTML-строка: строка словаря в ней — текст элемента, как в разметке .astro.
    files: ['src/app/middleware/gone.ts'],
    rules: { 'no-restricted-syntax': ['error', importMetaEnv] },
  },
  {
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // Тест собирает ожидание из строк словаря так же, как их ставит рядом разметка.
      'no-restricted-syntax': ['error', importMetaEnv],
      'no-restricted-imports': [
        'error',
        { patterns: importPatterns.filter((pattern) => pattern !== GATE_SCRIPTS) },
      ],
    },
  },
  {
    // Корневые конфиги — вне ts-программы src/: линтятся без type-aware правил.
    files: ['*.config.{ts,js,mjs}', '.size-limit.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // CommonJS по требованию инструмента (size-limit, commitlint): require здесь легитимен.
    files: ['**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
)
