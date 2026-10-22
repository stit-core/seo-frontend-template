import { channelText } from './channel'

describe('адрес канала', () => {
  it('телефон и почта — без схемы, мессенджер — без схемы и готового сообщения', () => {
    expect(channelText('tel:+74950000000')).toBe('+74950000000')
    expect(channelText('mailto:hello@example.com')).toBe('hello@example.com')
    expect(channelText('https://t.me/primer?text=%D0%97')).toBe('t.me/primer')
    expect(channelText('https://max.ru/')).toBe('max.ru')
  })
})
