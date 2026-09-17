// ⚠️ Server-only (`defineAction`) в этот баррель не попадает: он утащил бы
// `astro:actions` в клиентский чанк острова и убил бы гидрацию.
// Action живёт своим entry: '@/features/contact-form/api/action'.
export {
  type ContactInput,
  ContactInputSchema,
  type ContactResult,
  formToObject,
  handleContact,
  MIN_FILL_MS,
} from './model/schema'
export { ContactForm } from './ui/contact-form'
