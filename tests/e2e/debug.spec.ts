// 除錯畫面：長按班長名牌進來，顯示最近 10 次 /api/order 的真實經過。
// 藏起來是刻意的（給查問題用，不是給使用者的功能），所以測試要證明「長按才開得了」。
import { expect, test } from '@playwright/test'
import { FIXED_ORDER } from './fixtures.ts'

const DEBUG = {
  module: 'sleep', level: 1, model: 'claude-haiku-4-5',
  ms: { places: 254, claude: 2877, total: 3131 }, outTokens: 194,
  places: {
    how: 'text="居酒屋"',
    tries: [{ r: 800, raw: 0, kept: 0 }, { r: 2000, raw: 15, kept: 8 }],
    candidates: [{ name: '一番地居酒屋', rating: 4.3, count: 520, walkMin: 4 }],
  },
  retry: 'noplace', forced: '一番地居酒屋', picked: '一番地居酒屋',
}

/** 長按：壓住超過 700ms 再放開。 */
async function longPressPlate(page: import('@playwright/test').Page) {
  await page.getByTestId('plate').hover()
  await page.mouse.down()
  await page.waitForTimeout(900)
  await page.mouse.up()
}

test('① 短按名牌不會開除錯畫面，長按才會', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('plate').click()
  await expect(page.locator('[data-screen="home"]')).toBeVisible()

  await longPressPlate(page)
  await expect(page.locator('[data-screen="debug"]')).toBeVisible()
  await expect(page.getByTestId('debug-empty')).toBeVisible()
})

test('② 出過一道口令之後，除錯畫面看得到那一次的完整資料', async ({ page }) => {
  await page.route('**/api/order', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'x-places-calls': '1' },
      body: JSON.stringify({ ...FIXED_ORDER, debug: DEBUG }),
    }))
  await page.goto('/')
  await page.locator('[data-card="sleep"]').click()
  await page.getByRole('button', { name: '是！班長' }).click()
  await expect(page.locator('[data-screen="cmd"]')).toBeVisible()

  // 口令畫面本身不能被 debug 汙染：店名還是原來那家
  await expect(page.getByTestId('meme-big')).toHaveText(FIXED_ORDER.meme.big)

  // 重新載入回首頁：紀錄存在 localStorage，關掉 App 再開也還在
  await page.goto('/')
  await longPressPlate(page)
  const entry = page.getByTestId('debug-entry').first()
  await expect(entry).toContainText('3.1s')
  await expect(entry).toContainText('半徑 800m → 找到 0 家')
  await expect(entry).toContainText('半徑 2000m → 找到 15 家，留下 8 家')
  await expect(entry).toContainText('一番地居酒屋 4.3★(520) 走4分')
  await expect(entry).toContainText('模型沒挑真店')
  await expect(entry).toContainText('強制指定 一番地居酒屋')
})

test('③ 清掉之後紀錄就空了', async ({ page }) => {
  await page.route('**/api/order', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ ...FIXED_ORDER, debug: DEBUG }),
    }))
  await page.goto('/')
  await page.locator('[data-card="sleep"]').click()
  await page.getByRole('button', { name: '是！班長' }).click()
  await expect(page.locator('[data-screen="cmd"]')).toBeVisible()

  await page.goto('/')
  await longPressPlate(page)
  await expect(page.getByTestId('debug-entry')).toHaveCount(1)
  await page.getByTestId('debug-clear').click()
  await expect(page.getByTestId('debug-entry')).toHaveCount(0)
  await expect(page.getByTestId('debug-empty')).toBeVisible()
})

test('④ 失敗的那一次也留得下來，看得出錯在哪', async ({ page }) => {
  await page.route('**/api/order', (route) =>
    route.fulfill({
      status: 502, contentType: 'application/json',
      body: JSON.stringify({
        error: 'no_places', message: '附近查不到營業中的店。換個地方再報告。',
        debug: { module: 'sleep', level: 1, error: 'no_places', places: { how: 'types=restaurant', tries: [{ r: 800, raw: 5, kept: 0 }], candidates: [] } },
      }),
    }))
  await page.goto('/')
  await page.locator('[data-card="sleep"]').click()
  await page.getByRole('button', { name: '是！班長' }).click()
  await expect(page.locator('[data-screen="error"]')).toBeVisible()

  await page.goto('/')
  await longPressPlate(page)
  await expect(page.getByTestId('debug-error')).toContainText('no_places')
  await expect(page.getByTestId('debug-entry').first()).toContainText('半徑 800m → 找到 5 家，留下 0 家')
})
