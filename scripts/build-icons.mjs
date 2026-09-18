/**
 * PWA 圖示產生器 —— 把 public/icons/*.png 從 HTML 版型重新輸出。
 *
 * 為什麼需要這支：圖示是 PNG，換色盤時沒有人能手改二進位檔，於是每一輪都被漏掉
 * （DEV-PLAN-2 A-3 把「icons 三張還是第一輪配色」列為連帶項）。把版型寫成程式碼之後，
 * 下次改色盤只要改這裡的常數再跑一次。
 *
 * 構圖沿用第一輪：圓環 + 五角星 + 「決斷」二字，只換顏色。
 *
 *   node scripts/build-icons.mjs
 *
 * 需要 Playwright 的 Chromium。容器裡沒有 WebKit，但圖示只是點陣輸出，用哪個引擎畫都一樣。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { chromium } from '@playwright/test'

const ROOT = resolve(import.meta.dirname, '..')
const OUT = join(ROOT, 'public', 'icons')

// NES 色盤（design/hwpalette.mjs 的 HW.nes）。換色盤時只改這三個值。
const BG = '#005800'   // 底：L1 大面積，c=88，剛好在上限內
const MARK = '#F8B800' // 圓環與星：L3 點綴
const TEXT = '#FCFCFC' // 字

/** @param {number} size @param {number} inset 可遮罩版要把圖縮進安全區 */
const page = (size, inset) => {
  const s = size * (1 - inset * 2)
  return `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${size}px;height:${size}px;overflow:hidden}
  body{background:${BG};display:flex;align-items:center;justify-content:center;
       font-family:"Noto Sans TC","PingFang TC","Hiragino Sans",system-ui,sans-serif}
  .mark{position:relative;width:${s}px;height:${s}px;display:flex;align-items:center;justify-content:center}
  .ring{position:absolute;inset:${s * 0.06}px;border:${Math.max(2, s * 0.035)}px solid ${MARK};border-radius:50%}
  .star{position:absolute;top:${s * 0.13}px;left:50%;transform:translateX(-50%);
        width:${s * 0.52}px;height:${s * 0.52}px;background:${MARK};
        clip-path:polygon(50% 0%,61.8% 34.5%,98% 34.5%,68.8% 56%,79.4% 90.5%,50% 69.5%,20.6% 90.5%,31.2% 56%,2% 34.5%,38.2% 34.5%)}
  .word{position:absolute;bottom:${s * 0.1}px;left:0;right:0;text-align:center;
        color:${TEXT};font-size:${s * 0.3}px;font-weight:900;letter-spacing:${s * 0.01}px;line-height:1}
</style><div class="mark"><div class="ring"></div><div class="star"></div><div class="word">決斷</div></div>`
}

const TARGETS = [
  { file: 'icon-192.png', size: 192, inset: 0.04 },
  { file: 'icon-512.png', size: 512, inset: 0.04 },
  { file: 'apple-touch-icon.png', size: 180, inset: 0.04 },
  // maskable：作業系統會裁切外圈，圖必須縮進中央 80% 的安全區。
  { file: 'icon-512-maskable.png', size: 512, inset: 0.14 },
]

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
})
try {
  mkdirSync(OUT, { recursive: true })
  for (const t of TARGETS) {
    const p = await browser.newPage({ viewport: { width: t.size, height: t.size }, deviceScaleFactor: 1 })
    await p.setContent(page(t.size, t.inset))
    const buf = await p.screenshot({ type: 'png' })
    const dest = join(OUT, t.file)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, buf)
    await p.close()
    console.log(`  ok   ${t.file} (${t.size}×${t.size})`)
  }
} finally {
  await browser.close()
}
