import { ISLANDS } from '../../src/shared/config/islands.ts'
import { expect, test } from './csp'

// Переход между страницами рисует браузер — CSS View Transitions, без скрипта. Что он анимирует, видит
// новая страница в момент показа: событие pagereveal несёт переход, его кадры — document.getAnimations().
// Без разрешённого движения новая страница встаёт сразу: кадров нет вовсе, а не кадры длиной 0.
type Frame = { target: string; duration: number }
type Revealed = Window & { reveal?: Promise<Frame[]> }

function watch() {
  addEventListener('pagereveal', (event) => {
    const transition = (event as Event & { viewTransition?: { ready: Promise<void> } | null })
      .viewTransition
    ;(window as Revealed).reveal = transition
      ? transition.ready.then(
          () =>
            document.getAnimations().map((animation) => {
              const effect = animation.effect as KeyframeEffect | null
              return {
                target: effect?.pseudoElement ?? effect?.target?.nodeName ?? '',
                duration: Number(effect?.getComputedTiming().duration),
              }
            }),
          () => [],
        )
      : Promise.resolve([])
  })
}

// Движение разрешено системой без выбора «меньше» и выбором «полное» вопреки системе (норма motion-toggle).
// Выбор применяет остров предпочтений: у сайта без выбора — ни кнопки темы, ни переключателя движения — его
// нет ни на одной странице, и движение — по системе.
const choosable = ISLANDS.preferences.pages.length > 0
const STATES = [
  { system: 'no-preference', choice: undefined, moves: true },
  { system: 'reduce', choice: undefined, moves: false },
  { system: 'no-preference', choice: 'reduced', moves: false },
  { system: 'reduce', choice: 'full', moves: true },
] as const

for (const { system, choice, moves } of STATES) {
  test.describe(`система ${system}, выбор ${choice ?? 'нет'}`, () => {
    test.use({ reducedMotion: system })
    test.skip(
      choice !== undefined && !choosable,
      'выбора нет: остров предпочтений на сайте не стоит',
    )

    test(`переход между страницами — ${moves ? 'анимирован' : 'без кадров'}`, async ({ page }) => {
      if (choice) await page.addInitScript((value) => localStorage.setItem('motion', value), choice)
      await page.addInitScript(watch)
      await page.goto('/')
      const link = page.locator('header nav a:not([aria-current])').first()
      const target = new URL((await link.getAttribute('href')) ?? '', page.url()).pathname
      await link.click()
      await page.waitForURL(`**${target}`)
      const frames = await page.evaluate<Frame[] | string>(
        () => (window as Revealed).reveal ?? 'нет pagereveal',
      )
      if (!moves) {
        expect(frames).toEqual([])
        return
      }
      expect(frames).not.toEqual([])
      for (const frame of frames as Frame[]) expect(frame.duration, frame.target).toBeGreaterThan(0)
    })
  })
}
