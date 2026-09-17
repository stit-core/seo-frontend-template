// Astro требует этот путь. Коллекции импортируются сюда напрямую из модуля слайса
// (`@/entities/<name>/model/collection`), не через баррель: через public API
// dev-сервер теряет конфиг контента («Content config not loaded»).
import { postCollection } from '@/entities/post/model/collection'

export const collections = { post: postCollection }
