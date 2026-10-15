import { action, defineBlock, list, media, text, untargeted } from '@/shared/strategy'

export const header = defineBlock({
  id: 'header',
  variants: ['site-nav', 'landing-minimal'],
  slots: {
    logo: media,
    // Подписи пунктов меню по порядку пунктов карты (chrome.header.items): у посадочной меню нет.
    'nav-link': list(text).optional(),
    cta: action.optional(),
    'cta-label': text.optional(),
    phone: action.optional(),
    'lang-switch': untargeted.optional(),
  },
})
