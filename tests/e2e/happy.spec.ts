// 第 13.2 節 Happy ×7：每卡 home→intake→「是！班長」→cmd 出現 .meme .big 非空。
import { expect, test } from '@playwright/test'

const CARDS = ['eat', 'go', 'attend', 'rest', 'sleep', 'reply', 'buy'] as const

for (const id of CARDS) {
  test(`happy：${id} 可從首頁走到口令畫面`, async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-screen="home"]')).toBeVisible()

    await page.locator(`[data-card="${id}"]`).click()
    await expect(page.locator('[data-screen="intake"]')).toBeVisible()

    await page.getByRole('button', { name: '是！班長' }).click()
    await expect(page.locator('[data-screen="cmd"]')).toBeVisible()

    const big = page.getByTestId('meme-big')
    await expect(big).toBeVisible()
    expect((await big.textContent())?.trim().length).toBeGreaterThan(0)

    // 步驟卡在梗圖卡下方，且至少一條
    await expect(page.getByTestId('steps').locator('p').first()).toBeVisible()
  })
}

test('首頁：班長在最上面、4 磁貼 + 3 小鍵', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.officer')).toBeVisible()
  await expect(page.locator('.grid .tile')).toHaveCount(4)
  await expect(page.locator('.minor button')).toHaveCount(3)
})

test('點頭像換班長，三段火力循環', async ({ page }) => {
  await page.goto('/')
  const name = page.getByTestId('officer-name')
  await expect(name).toHaveText('黑面') // 預設中檔
  await page.locator('.officer .av').click()
  await expect(name).toHaveText('老郭')
  await page.locator('.officer .av').click()
  await expect(name).toHaveText('阿良')
  await page.locator('.officer .av').click()
  await expect(name).toHaveText('黑面')
})
