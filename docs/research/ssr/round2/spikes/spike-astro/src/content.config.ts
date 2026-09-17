// Astro требует этот путь. Импорт — напрямую из модуля слайса, а не через
// баррель: через public API dev-сервер логирует «Content config not loaded».
import { postCollection } from '@/entities/post/model/collection'

export const collections = { post: postCollection }
