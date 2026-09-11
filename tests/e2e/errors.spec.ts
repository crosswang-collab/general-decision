// 第 13.2 節 Error ×4：定位拒絕仍出口令；API 500→重試訊息與重試鍵；非法 JSON→同 500 路徑；離線→離線訊息且日記可開。
import { expect, test } from '@playwright/test'
import { FIXED_ORDER, mockOrder, mockOrderFailure } from './fixtures.ts'

test('① 定位被拒，仍然出得了口令，並顯示班長的話', async ({ page, context }) => {
  await context.clearPermissions() // 不給定位權限
  await mockOrder(page)
  await page.goto('/')
  await page.locator('[data-card="eat"]').click()
  await page.getByRole('button', { name: '是！班長' }).click()
  await expect(page.locator('[data-screen="cmd"]')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('meme-big')).toHaveText(FIXED_ORDER.meme.big)
  await expect(page.getByTestId('geo-denied')).toHaveText('不報座標？行，班長用常識。')
})

test('② API 500 → 班長在開會 + 重試鍵，重試後回到口令', async ({ page }) => {
  await mockOrderFailure(page, 500)
  await page.goto('/')
  await page.locator('[data-card="sleep"]').click()
  await page.getByRole('button', { name: '是！班長' }).click()

  await expect(page.locator('[data-screen="error"]')).toBeVisible()
  await expect(page.getByTestId('error-line')).toContainText('班長在開會。30 秒後再報告。')

  await page.unroute('**/api/order')
  await mockOrder(page)
  await page.getByTestId('retry').click()
  await expect(page.locator('[data-screen="cmd"]')).toBeVisible()
})

test('③ 非法 JSON（伺服器回 502）走同一條路徑', async ({ page }) => {
  await mockOrderFailure(page, 502)
  await page.goto('/')
  await page.locator('[data-card="reply"]').click()
  await page.getByRole('button', { name: '是！班長' }).click()
  await expect(page.getByTestId('error-line')).toContainText('班長在開會')
  await expect(page.getByTestId('retry')).toBeVisible()
})

test('④ 離線 → 離線訊息，且日記仍可開', async ({ page, context }) => {
  await page.goto('/')
  await context.setOffline(true)
  await page.locator('[data-card="buy"]').click()
  await page.getByRole('button', { name: '是！班長' }).click()

  await expect(page.getByTestId('error-line')).toContainText('沒訊號。原地站好，有訊號再報告。')
  await page.getByRole('button', { name: '看日記' }).click()
  await expect(page.locator('[data-screen="diary"], [data-screen="placeholder"]')).toBeVisible()
  await context.setOffline(false)
})

test('429 → 一樣是班長在開會', async ({ page }) => {
  await mockOrderFailure(page, 429, '{"error":"rate_limited","message":"班長在開會。30 秒後再報告。"}')
  await page.goto('/')
  await page.locator('[data-card="go"]').click()
  await page.getByRole('button', { name: '是！班長' }).click()
  await expect(page.getByTestId('error-line')).toContainText('班長在開會')
})
