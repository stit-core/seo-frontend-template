// Astro требует этот путь. Коллекции импортируются сюда напрямую из модуля слайса
// (`@/entities/<name>/model/collection`), не через баррель: через public API
// dev-сервер теряет конфиг контента («Content config not loaded»).
export const collections = {}
