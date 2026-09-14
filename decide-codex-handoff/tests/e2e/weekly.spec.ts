// 第 12 節 S8：週報渲染。
import { expect, test } from '@playwright/test'
import { FIXED_ORDER, mockOrder } from './fixtures.ts'

const REPORT = {
  weekStart: '2026-09-07T00:00:00.000Z',
  level: 1,
  stats: { orders: 11, complianceRate: 82, punishments: 2, weakestModule: 'rest' },
  body: '本週十一道口令，九道完成，兩次罰則。\n\n發現規律了沒？你只在「不用出門」的事情上偷懶。\n\n下週歇的口令改成「站起來再說」。',
  verdict: '本週講評：合格。屁股記過一次。',
}

async function mockWeekly(page: import('@playwright/test').Page, body: unknown = REPORT, status = 200) {
  await page.route('**/api/weekly', (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  )
}

test('日記頁按「看本週莒光園地」→ 週報渲染，單欄 + 角色在下', async ({ page }) => {
  await mockWeekly(page)
  await page.goto('/')
  await page.getByRole('button', { name: '新兵日記' }).click()
  await page.getByRole('button', { name: '看本週莒光園地' }).click()

  await expect(page.locator('[data-screen="weekly"]')).toBeVisible()
  await expect(page.getByTestId('weekly-body')).toContainText('本週十一道口令')
  await expect(page.getByTestId('meme-bot')).toHaveText(REPORT.verdict)

  const meme = page.getByTestId('meme')
  await expect(meme).toHaveClass(/wide/)
  await expect(meme).toHaveClass(/ok/)
  // 單欄：角色在文字之後，不並排
  const cols = await meme.evaluate((el) => window.getComputedStyle(el).gridTemplateColumns)
  expect(cols.split(' ')).toHaveLength(1)
  await expect(page.getByRole('button', { name: '分享週報' })).toBeVisible()
})

test('週報同一週只打一次 API（第 10 節）', async ({ page }) => {
  let calls = 0
  await page.route('**/api/weekly', (route) => {
    calls++
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(REPORT) })
  })
  await page.goto('/')
  await page.getByRole('button', { name: '新兵日記' }).click()
  await page.getByRole('button', { name: '看本週莒光園地' }).click()
  await expect(page.getByTestId('weekly-body')).toBeVisible()

  await page.getByRole('button', { name: '← 回日記' }).click()
  await page.getByRole('button', { name: '看本週莒光園地' }).click()
  await expect(page.getByTestId('weekly-body')).toBeVisible()
  expect(calls).toBe(1) // 第二次讀本機快取
})

test('週報產出失敗 → 顯示延後訊息，不擋日記（第 11 節）', async ({ page }) => {
  await mockOrder(page)
  await mockWeekly(page, { error: 'upstream', message: '本週講評延後，班長還在寫。' }, 502)
  await page.goto('/')

  // 先走一道口令，日記才有東西
  await page.locator('[data-card="reply"]').click()
  await page.getByRole('button', { name: '是！班長' }).click()
  await page.getByRole('button', { name: '報告班長，完成' }).click()
  await page.getByRole('button', { name: '解散' }).click()

  await page.getByRole('button', { name: '新兵日記' }).click()
  await page.getByRole('button', { name: '看本週莒光園地' }).click()

  await expect(page.getByTestId('weekly-pending')).toContainText('本週講評延後，班長還在寫。')
  await page.getByRole('button', { name: '← 回日記' }).click()
  await expect(page.getByTestId('entry')).toHaveCount(1) // 日記照樣看得到
})

test('週報帶著本週日記送出', async ({ page }) => {
  await mockOrder(page)
  let sent: Record<string, unknown> | undefined
  await page.route('**/api/weekly', (route) => {
    sent = route.request().postDataJSON()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(REPORT) })
  })
  await page.goto('/')
  await page.locator('[data-card="reply"]').click()
  await page.getByRole('button', { name: '是！班長' }).click()
  await expect(page.getByTestId('meme-big')).toHaveText(FIXED_ORDER.meme.big)
  await page.getByRole('button', { name: '報告班長，完成' }).click()
  await page.getByRole('button', { name: '解散' }).click()

  await page.getByRole('button', { name: '新兵日記' }).click()
  await page.getByRole('button', { name: '看本週莒光園地' }).click()
  await expect(page.getByTestId('weekly-body')).toBeVisible()
  expect((sent?.entries as unknown[])?.length).toBe(1)
})
