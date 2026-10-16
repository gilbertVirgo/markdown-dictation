import { test, expect } from '@playwright/test'

test('login page rejects a wrong password', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('Password').fill('definitely-wrong')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('alert')).not.toBeEmpty()
})

test.describe('full flow', () => {
  test.skip(!process.env.APP_PASSWORD || !process.env.MONGODB_URI, 'needs .env')

  test('create, edit, persist, dictate, delete', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('Password').fill(process.env.APP_PASSWORD!)
    await page.keyboard.press('Enter')
    await page.getByLabel('New document').click()
    await page.waitForURL(/\/doc\//)

    await page.locator('.ProseMirror').click()
    await page.keyboard.type('# Hello world')
    await expect(page.locator('h1')).toHaveText('Hello world')
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.locator('h1')).toHaveText('Hello world')

    await page.route('**/api/refine', (r) => r.fulfill({ json: { text: 'Nehemiah rebuilt the wall.' } }))
    await page.evaluate(() => (window as any).__dictate.insertChunk('knee higher rebuilt the wall', 'body'))
    await expect(page.getByText('Nehemiah rebuilt the wall.')).toBeVisible()
    await expect(page.locator('[data-pending]')).toHaveCount(0)

    page.on('dialog', (d) => d.accept())
    await page.getByLabel('Menu').click()
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page).toHaveURL(/\/$/)
  })
})
