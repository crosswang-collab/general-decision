import type { Page } from '@playwright/test'

export const FIXED_ORDER = {
  verdict: 'do',
  meme: { top: '去吃熱的', big: '阿財魯肉飯', bot: '這週兩天超商了' },
  steps: ['步行 6 分鐘，營業到 21:00。', '魯肉飯、滷蛋、燙青菜。', '12 分鐘吃完，手機收起來。'],
  place: { id: 'p1', name: '阿財魯肉飯', walkMin: 6, openUntil: '21:00' },
  log: '12:41 魯肉飯，12:58 完成。',
}

export const SECOND_ORDER = {
  ...FIXED_ORDER,
  meme: { top: '店關了不是你的錯', big: '巷口牛肉麵', bot: '第二道口令一樣算' },
  place: { id: 'p2', name: '巷口牛肉麵', walkMin: 3 },
  steps: ['步行 3 分鐘，營業中。', '清燉，不加辣。'],
  log: '13:05 牛肉麵，13:22 完成。',
}

/** 第 13.2 節：e2e 一律 mock API 回固定 Order。 */
export async function mockOrder(page: Page, orders: unknown[] = [FIXED_ORDER]) {
  let i = 0
  await page.route('**/api/order', async (route) => {
    const body = orders[Math.min(i, orders.length - 1)]
    i++
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'x-places-calls': '1' },
      body: JSON.stringify(body),
    })
  })
}

export async function mockOrderFailure(page: Page, status: number, body = '{"error":"upstream","message":"班長在開會。30 秒後再報告。"}') {
  await page.route('**/api/order', (route) =>
    route.fulfill({ status, contentType: 'application/json', body }),
  )
}
