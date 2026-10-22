// 檢舉不當口令（App Store 1.2；DEV-PLAN-3 W3）。契約空殼：W3 實作。純函式，不含座標。
import type { Level, Order } from './types.ts'

export const CONTACT_EMAIL = '[CONTACT_EMAIL]'

/** 組 mailto 連結（subject + body 含 meme 三行與 steps）。 */
export function reportMailto(order: Order, level: Level): string {
  void order; void level
  return `mailto:${CONTACT_EMAIL}`
}
