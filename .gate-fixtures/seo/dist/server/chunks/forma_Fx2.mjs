// Пакеты вне dependencies мини-проекта — импорт, реэкспорт, require и import().
import { load } from 'js-yaml'
import { i as __require } from './rolldown-runtime_Fx3.mjs'
export { marked } from 'marked'

const debug = __require('debug')
export const mailer = () => import('nodemailer')
export { debug, load }
