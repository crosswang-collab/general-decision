// 檢舉不當口令（App Store 1.2；DEV-PLAN-3 W3）。純函式：不碰 DOM、不碰 storage、不含座標。
// 由 W2 在口令卡 StepsCard 下方掛一顆「回報這道口令」文字連結，href 就是這裡的回傳值。
import { OFFICER_BY_LEVEL } from './officers.ts'
import type { Level, Order } from './types.ts'

/** 聯絡信箱佔位，Cross 上架前換成真的（同一個常數也被 privacy.tsx 引用）。 */
export const CONTACT_EMAIL = '[CONTACT_EMAIL]'

/** 信箱還沒填之前的聯絡管道：公開的 issues 頁（R2-07）。 */
export const ISSUES_URL = 'https://github.com/crosswang-collab/general-decision/issues'

export const REPORT_SUBJECT = '【報告班長】回報不當口令'

/** 信箱是否已填成真的（仍是佔位就是還沒）。 */
export const hasContactEmail = (email: string = CONTACT_EMAIL): boolean => email !== '[CONTACT_EMAIL]' && email.includes('@')

/**
 * 回報內容（mailto 與 GitHub issue 共用）：meme 三行、steps、哪一位班長、一句說明。
 * 刻意不放：座標、place.id、mapUrl（連結內含店家代碼）、使用者的選擇。
 * 店名會出現在 meme.big／steps 裡，這是使用者要檢舉的口令本文，不是額外蒐集。
 */
function reportLines(order: Order, level: Level, head: string[]): string[] {
  const officer = OFFICER_BY_LEVEL[level]
  return [
    ...head,
    '── 以下是被回報的口令，請保留 ──',
    `班長：${officer.name}（${officer.duty}）`,
    `上：${order.meme.top}`,
    `中：${order.meme.big}`,
    `下：${order.meme.bot}`,
    ...order.steps.map((s, i) => `步驟${i + 1}：${s}`),
  ]
}

/** 組 mailto 連結（信箱填了才會用到）。 */
export function reportMailto(order: Order, level: Level, email: string = CONTACT_EMAIL): string {
  const body = reportLines(order, level, ['請描述哪裡不妥（可直接寫在這行下面）：', '', '']).join('\r\n')
  return `mailto:${email}?subject=${encodeURIComponent(REPORT_SUBJECT)}&body=${encodeURIComponent(body)}`
}

/** 組 GitHub 新 issue 連結：標題與內文預填好，使用者按送出即可。內文含口令文字，不含座標與店家代碼。 */
export function reportIssueUrl(order: Order, level: Level): string {
  const body = reportLines(order, level, [
    '請描述哪裡不妥（可直接寫在這行下面；這是公開頁面，請不要寫個人資料）：', '', '',
  ]).join('\n')
  return `${ISSUES_URL}/new?title=${encodeURIComponent(REPORT_SUBJECT)}&body=${encodeURIComponent(body)}`
}

/** 口令卡上「回報這道口令」的連結：信箱還是佔位 → GitHub issue；填了真信箱 → mailto。 */
export function reportHref(order: Order, level: Level, email: string = CONTACT_EMAIL): string {
  return hasContactEmail(email) ? reportMailto(order, level, email) : reportIssueUrl(order, level)
}
