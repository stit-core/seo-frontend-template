// Нарушение: cross-slice импорт из .js-модуля слайса (widgets/b → widgets/a).
import { A } from '@/widgets/a'

export const Crumbs = A
