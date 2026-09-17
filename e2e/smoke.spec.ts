import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('главная грузится, разметка доступна (axe)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'SPA' })).toBeVisible()

  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})

test('переход на /todos и добавление задачи', async ({ page }) => {
  await page.goto('/todos')
  await expect(page.getByRole('heading', { name: 'Задачи' })).toBeVisible()

  await page.getByPlaceholder('Что сделать…').fill('Купить молоко')
  await page.getByRole('button', { name: 'Добавить' }).click()

  await expect(page.getByText('Купить молоко')).toBeVisible()
})
