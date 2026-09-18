// 模組硬規則 — 第 6 節。這些是算得出來的事，不外包給 Claude：
// 先算好塞進 prompt，再拿回傳結果對一次，錯了就以本地規則為準。
import { localizeFields, localizeText, stripUrls } from './locale.ts'
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

/**
 * 「沒有回答」偵測 — 2026-09-18 Cross：不吐口令是不被允許的。
 * 舊規則 5 讓模型自己判「大事」回「大事不受理／去找連長」，Haiku 在喝一杯、出國這種小事上也會誤觸。
 * 命中的定義：meme 或 steps 出現「不受理」「找連長」，或 steps 是空的。api/order.ts 命中就重打一次。
 */
export function isNonAnswer(order: Order): boolean {
  const text = [order.meme.top, order.meme.big, order.meme.bot, ...order.steps].join('\n')
  return order.steps.length === 0 || /不受理|找連長|去找.*長/.test(text)
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
    if (order.verdict !== want) order = { ...order, verdict: want }
  }
  if (module === 'buy') {
    const want = buyVerdict(recent, now)
    if (order.verdict !== want) order = { ...order, verdict: want }
  }
  if (module !== 'attend' && module !== 'buy' && order.verdict !== 'do') {
    order = { ...order, verdict: 'do' } // 第 6 節：stop 只有 attend / buy 有資格（stopVerdictAllowed），其餘一律 do
  }
  return localizeOrder(order)
}

/**
 * 階段 D：台灣情境用語守門 + 模型輸出的 URL 一律拔掉（DEV-PLAN-2 規則 8、9）。
 * 涵蓋 meme.top / meme.big / meme.bot / steps[] / log。命中就地替換並 console.warn 一筆，
 * 讓 Vercel runtime log 看得出黑名單命中頻率。乾淨輸入原樣回傳（同一個 reference）。
 */
export function localizeOrder(order: Order): Order {
  const hits: string[] = []
  let out = order

  const meme = localizeFields(order.meme, ['top', 'big', 'bot'])
  if (meme.hits.length) { hits.push(...meme.hits.map((h) => `meme.${h}`)); out = { ...out, meme: meme.value } }

  const rest = localizeFields(out, ['steps', 'log'])
  if (rest.hits.length) { hits.push(...rest.hits); out = rest.value }

  // URL：模型不准講連結。place.mapUrl 由 withPlace() 之後才補，這裡若已有就是模型編的，一併丟掉。
  let urlHits = 0
  const scrub = (s: string) => { const r = stripUrls(s); urlHits += r.hits; return r.text }
  const memeScrubbed = { top: scrub(out.meme.top), big: scrub(out.meme.big), bot: scrub(out.meme.bot) }
  const stepsScrubbed = out.steps.map(scrub)
  const logScrubbed = scrub(out.log)
  if (urlHits) out = { ...out, meme: memeScrubbed, steps: stepsScrubbed, log: logScrubbed }
  if (out.place && 'mapUrl' in out.place) {
    const { mapUrl: _dropped, ...place } = out.place as Order['place'] & { mapUrl?: string }
    void _dropped
    out = { ...out, place }
    urlHits++
  }

  if (hits.length || urlHits) {
    console.warn(`[locale] 用語守門命中 ${hits.length} 處、URL 拔掉 ${urlHits} 處：${hits.join('、') || '-'}`)
  }
  return out
}

/** 週報 body / verdict 走同一套守門（api/weekly.ts 用；週報不經過 enforceRules）。 */
export function localizeWeeklyText(body: string, verdict: string): { body: string; verdict: string } {
  const b = localizeText(body)
  const v = localizeText(verdict)
  const hits = [...b.hits, ...v.hits]
  if (hits.length) console.warn(`[locale] 週報用語守門命中 ${hits.length} 處：${hits.join('、')}`)
  return { body: stripUrls(b.text).text, verdict: stripUrls(v.text).text }
}

/** 罰則倒數總長（毫秒），給測試與 e2e 用。 */
export function punishmentMs(level: Level, count: number, stepMs: number): number {
  void level
  return count * stepMs
}
