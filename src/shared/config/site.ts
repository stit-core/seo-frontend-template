// Идентичность сайта — демо-значения шаблона; /de-template заменяет их проектными.
export const SITE_NAME = 'ssr-frontend-template'

// Профили организации в других сервисах (JSON-LD Organization.sameAs).
export const SITE_SAME_AS: readonly string[] = [
  'https://git.stit.tech/stit-core/ssr-frontend-template',
]

// Логотип организации (JSON-LD Organization.logo) — из набора иконок public/.
export const SITE_LOGO_PATH = '/icon-512.png'

// Публичные per-site идентификаторы живут здесь, а не в env: prerendered-страница печатается
// на сборке, а образ собирается без env — runtime-значение до неё не доходит. /de-template
// подставляет проектные. Тип — string, а не литерал пустой строки: с проектным значением проверка
// «задано ли» иначе не компилируется.

// Счётчик Яндекс Метрики; пусто — аналитики нет и ни одного стороннего скрипта.
export const METRIKA_ID: string = ''

// Подтверждение домена в Search Console и Вебмастере: токен из панели. Пусто — тега нет;
// альтернатива — HTML-файл в public/ или запись DNS TXT.
export const SITE_VERIFICATION: { readonly google: string; readonly yandex: string } = {
  google: '',
  yandex: '',
}

// Политика ИИ-ботов — решение владельца сайта (бриф strategy, `search.ai_bots_policy`): пускать
// всех; пускать поиск и ИИ-ответы, но не обучение; закрыть ИИ всё, кроме классического поиска.
// Поле сборки, а не env: решение ревьюится в git, одно на все среды и доходит до <head>
// prerendered-страниц. Кого закрывает robots.txt и какие мета ставит <head> — реестр ботов
// shared/seo/crawlers.yaml.
export type AiBotsPolicy = 'allow-all' | 'allow-search-deny-training' | 'deny-all'
export const AI_BOTS_POLICY: AiBotsPolicy = 'allow-all'

// Служебные параметры адреса для Яндекса (Clean-param в robots.txt): метки кликов рекламных систем
// страницу не меняют, а каждый клик рождал бы адрес-дубль. Метка Openstat в Директе — `_openstat`;
// `openstat` — имя из нормы базы strategy, вреда от него нет. `utm_*`, `ysclid` и `yrclid` Яндекс
// срезает сам; свои параметры проекта (сессия, `ref`) дописываются сюда.
export const CLEAN_PARAMS: readonly string[] = ['yclid', 'gclid', 'fbclid', 'openstat', '_openstat']

// Тема сайта — решение проекта (блок `themes` брифа strategy); значения тем — файл токенов ДС
// src/app/styles/tokens.css. `default`: `system` — по настройке системы, иначе одна тема атрибутом
// `data-theme`; `switcher` — кнопка выбора в шапке и остров предпочтений. Темы поля есть у файла
// токенов (кнопке и теме по системе нужны обе): расхождение называет тест токен-слоя.
export const THEME: {
  readonly default: 'system' | 'light' | 'dark'
  readonly switcher: boolean
} = { default: 'system', switcher: true }

// Переключатель движения — решение проекта (эффект motion-toggle в планах страниц strategy): `switcher` —
// `MotionToggle` на страницах с петлями. Выбор движения, как и темы, действует на всём сайте: остров
// предпочтений встаёт на каждую страницу. Без переключателя движение — по настройке системы.
export const MOTION: { readonly switcher: boolean } = { switcher: false }

// Превью ссылки по умолчанию, 1200×630 (public/og-default.png); у записи с обложкой — её кадр того
// же размера (shared/seo). Подпись картинки — строка словаря `og.alt` на языке страницы.
export const OG_DEFAULT_IMAGE = { path: '/og-default.png', width: 1200, height: 630 } as const
