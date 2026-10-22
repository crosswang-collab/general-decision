// 檢舉不當口令（App Store 1.2；DEV-PLAN-3 W3）。純函式：不碰 DOM、不碰 storage、不含座標。
// 由 W2 在口令卡 StepsCard 下方掛一顆「回報這道口令」文字連結，href 就是這裡的回傳值。
import { OFFICER_BY_LEVEL } from './officers.ts'
import type { Level, Order } from './types.ts'

/** 聯絡信箱佔位，Cross 上架前換成真的（同一個常數也被 privacy.tsx 引用）。 */
export const CONTACT_EMAIL = '[CONTACT_EMAIL]'

export const REPORT_SUBJECT = '【報告班長】回報不當口令'

/**
 * 組 mailto 連結。body 只有：meme 三行、steps、哪一位班長、一句說明。
 * 刻意不放：座標、place.id、mapUrl（連結內含店家代碼）、使用者的選擇。
 * 店名會出現在 meme.big／steps 裡，這是使用者要檢舉的口令本文，不是額外蒐集。
 */
export function reportMailto(order: Order, level: Level): string {
  const officer = OFFICER_BY_LEVEL[level]
  const lines = [
    '請描述哪裡不妥（可直接寫在這行下面）：',
    '',
    '',
    '── 以下是被回報的口令，請保留 ──',
    `班長：${officer.name}（${officer.duty}）`,
    `上：${order.meme.top}`,
    `中：${order.meme.big}`,
    `下：${order.meme.bot}`,
    ...order.steps.map((s, i) => `步驟${i + 1}：${s}`),
  ]
  const body = lines.join('\r\n')
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(REPORT_SUBJECT)}&body=${encodeURIComponent(body)}`
}
