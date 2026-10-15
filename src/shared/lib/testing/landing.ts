import deck from './package-landing/site/promo/copy/spasibo.yaml'
import plan from './package-landing/site/promo/plans/spasibo.yaml'

// Фикстура базы strategy (scripts/tests/fixtures/package-landing скилла design-deep-dive, тег v0.2.2) в раскладке
// снимка: план и copy deck страницы «спасибо» лендинга без карты — в форме, которую пишет strategy, байт в байт. На ней
// тесты судят чтение и блоки без диалекта.
export const PACKAGE_LANDING = {
  'site/promo/plans/spasibo.yaml': plan,
  'site/promo/copy/spasibo.yaml': deck,
}
