// 第 9.1 節：跟隨系統（色彩／字級／動態／對比）與小螢幕規則。
import { expect, test } from '@playwright/test'

test('深色模式：背景換成深色 token', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  const bg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor)
  expect(bg).toBe('rgb(23, 24, 19)') // --khaki dark = #171813
})

test('淺色模式：背景是卡其色', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  const bg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor)
  expect(bg).toBe('rgb(227, 223, 208)') // --khaki = #E3DFD0
})

test('梗圖字用 clamp，超長 big 會換行不溢出', async ({ page }) => {
  await page.route('**/api/order', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      verdict: 'do',
      meme: { top: '這是一段很長的上標很長很長', big: '超級無敵長的店名要換行測試用', bot: '下標也很長很長很長很長很長' },
      steps: ['一。'], log: 'x',
    }),
  }))
  await page.goto('/')
  await page.locator('[data-card="sleep"]').click()
  await page.getByRole('button', { name: '是！班長' }).click()

  const meme = page.getByTestId('meme')
  await expect(meme).toBeVisible()
  const overflow = await meme.evaluate((el) => el.scrollWidth - el.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1) // 沒有橫向溢出
  const wrap = await page.getByTestId('meme-big').evaluate((el) => window.getComputedStyle(el).overflowWrap)
  expect(wrap).toBe('anywhere')
})

test('頁面不得橫向捲動', async ({ page }) => {
  await page.goto('/')
  const scrollable = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(scrollable).toBe(false)
})

test('高度 < 700px：3 小鍵變成一列橫向捲動，不換行', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 650 })
  await page.goto('/')
  const minor = page.locator('.minor')
  const [wrap, overflowX] = await minor.evaluate((el) => {
    const s = window.getComputedStyle(el)
    return [s.flexWrap, s.overflowX]
  })
  expect(wrap).toBe('nowrap')
  expect(overflowX).toBe('auto')

  // 三顆鍵仍在同一列
  const tops = await page.locator('.minor button').evaluateAll((els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().top)))
  expect(new Set(tops).size).toBe(1)
})

test('reduced motion：不跑進場動畫', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const anim = await page.locator('[data-screen="home"]')
    .evaluate((el) => window.getComputedStyle(el).animationName)
  expect(anim).toBe('none')
})

test('梗圖卡是 4:5，可截圖', async ({ page }) => {
  await page.route('**/api/order', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      verdict: 'do', meme: { top: 'a', big: 'b', bot: 'c' }, steps: ['一。'], log: 'x',
    }),
  }))
  await page.goto('/')
  await page.locator('[data-card="sleep"]').click()
  await page.getByRole('button', { name: '是！班長' }).click()
  const box = (await page.getByTestId('meme').boundingBox())!
  expect(box.height / box.width).toBeCloseTo(1.25, 1) // 4:5
})
