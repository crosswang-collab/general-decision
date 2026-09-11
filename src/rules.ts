// 模組硬規則 — 第 6 節。這些是算得出來的事，不外包給 Claude：
// 先算好塞進 prompt，再拿回傳結果對一次，錯了就以本地規則為準。
import type { Level, ModuleId, Order } from './types.ts'

/** attend：★≤2 且非婚禮 → 不去。 */
export function attendVerdict(stars: number, occasion: string): 'do' | 'stop' {
  return stars <= 2 && occasion !== '婚禮' ? 'stop' : 'do'
}

/** sleep：熄燈 = 起床 − 8 小時。回 'HH:MM'。 */
export function lightsOut(wake: string): string {
  const m = wake.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) throw new Error(`起床時間格式不對：${wake}`)
  const mins = ((Number(m[1]) * 60 + Number(m[2])) - 8 * 60 + 24 * 60) % (24 * 60)
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}

/** buy：預設不買；除非 72 小時前已為同類報告過一次。 */
export function buyVerdict(
  recent: { module: ModuleId; big: string; at: string }[],
  now: Date,
): 'do' | 'stop' {
  const cutoff = now.getTime() - 72 * 3600 * 1000
  const reported = recent.some((r) => r.module === 'buy' && new Date(r.at).getTime() <= cutoff)
  return reported ? 'do' : 'stop'
}

/** 大事不受理 — 第 7 節規則 5。 */
export const BIG_MATTER_ORDER: Order = {
  verdict: 'stop',
  meme: { top: '這不是班長管的', big: '大事不受理', bot: '去找連長。' },
  steps: ['去找連長。'],
  log: '大事，未受理。',
}

/**
 * 把本地算得出來的硬規則套回 Claude 的回傳。
 * Claude 只負責語氣與內容，判定權在這裡。
 */
export function enforceRules(
  order: Order,
  module: ModuleId,
  choices: Record<string, string | number>,
  now: Date,
  recent: { module: ModuleId; big: string; at: string }[],
): Order {
  if (module === 'attend') {
    const want = attendVerdict(Number(choices.stars ?? 5), String(choices.occasion ?? ''))
    if (order.verdict !== want) return { ...order, verdict: want }
  }
  if (module === 'buy') {
    const want = buyVerdict(recent, now)
    if (order.verdict !== want) return { ...order, verdict: want }
  }
  if (module === 'reply' && order.verdict !== 'do') {
    return { ...order, verdict: 'do' } // 第 6 節：reply 永遠 do
  }
  return order
}

/** 罰則倒數總長（毫秒），給測試與 e2e 用。 */
export function punishmentMs(level: Level, count: number, stepMs: number): number {
  void level
  return count * stepMs
}
