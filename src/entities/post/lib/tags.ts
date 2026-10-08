// Страница тега индексируется от трёх опубликованных записей локали. Ниже порога она почти
// повторяет список блога: тонкая страница собирается (ссылки на неё живые), но закрыта noindex —
// её нет ни в карте сайта, ни в hreflang.
export const TAG_INDEX_MIN_POSTS = 3

export function isTagIndexable(posts: number): boolean {
  return posts >= TAG_INDEX_MIN_POSTS
}
