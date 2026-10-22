// Ссылка канала без подписи в анатомии блока показывает свой адрес: номер телефона, почту, адрес мессенджера без схемы и
// параметров (готовое сообщение несёт ссылка, а не текст).
export function channelText(href: string): string {
  if (/^(?:tel|mailto):/.test(href)) return href.replace(/^(?:tel|mailto):/, '')
  const url = new URL(href)
  return `${url.host}${url.pathname === '/' ? '' : url.pathname}`
}
