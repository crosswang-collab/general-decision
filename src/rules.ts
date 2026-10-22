// 模組硬規則 — 第 6 節。這些是算得出來的事，不外包給 Claude：
// 先算好塞進 prompt，再拿回傳結果對一次，錯了就以本地規則為準。
import { findBanned } from './banned.ts'
import { stripBranch } from './chains.ts'
import { localizeFields, localizeText, stripUrls } from './locale.ts'
import { NEUTRAL_LOG, NEUTRAL_STEP, hasWrongCount, lineSalt, modeLine, neutralBot, satisfiesMode } from './modeLines.ts'
import { amountsIn, priceText } from './price.ts'
import type { Country, EnforceCtx, Level, ModuleId, Order, PickResult } from './types.ts'

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
 * Round 3（DEV-PLAN-3 W1.6）ctx 有 pick 時再加四道：店家覆寫（T2）→ 金額來源（T6）→ 禁詞（T7、C3）→ mode 語意（T3）。
 * ctx 省略 = 舊呼叫端（設計稿、既有測試）：只做 verdict 規則、禁詞、用語守門，國家當台灣。
 */
export function enforceRules(
  order: Order,
  module: ModuleId,
  choices: Record<string, string | number>,
  now: Date,
  recent: { module: ModuleId; big: string; at: string }[],
  ctx?: EnforceCtx,
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
  const level: Level = ctx?.level ?? 1
  const pick = ctx?.pick ?? null
  order = pick ? overridePlace(order, pick) : dropServerFields(order)
  if (pick) order = scrubAmounts(order, priceText(pick.place, ctx?.country ?? 'TW') ?? '', ctx?.country ?? 'TW', pick.place.name)
  order = scrubBanned(order, level, pick, now)
  if (pick) order = enforceMode(order, level, pick, now)
  return localizeOrder(order, ctx?.country ?? 'TW')
}

/** meme.big 用的店名：模型寫的若是店名的一段（慣稱）且 ≤10 字就留；否則去分店字尾；還太長就截 10 字。 */
export function bigName(name: string, modelBig?: string): string {
  const b = modelBig?.trim()
  if (b && b.length >= 2 && b.length <= 10 && name.includes(b)) return b
  if (name.length <= 10) return name
  const core = stripBranch(name)
  return core.length <= 10 ? core : name.slice(0, 10)
}

/** T2：店一律是 pickPlace 的那家。模型寫的 place 欄位全丟，只留 id／name，其餘由 withPlace 填。 */
function overridePlace(order: Order, pick: PickResult): Order {
  const p = pick.place
  return { ...order, meme: { ...order.meme, big: bigName(p.name, order.meme.big) }, place: { id: p.id, name: p.name } }
}

/** 沒有 pick 時，模型寫的 place 只留 id／name／walkMin／openUntil；mode／band／priceText… 只准伺服器填。 */
function dropServerFields(order: Order): Order {
  if (!order.place) return order
  const { id, name, walkMin, openUntil, mapUrl } = order.place
  const keep: NonNullable<Order['place']> = { id, name }
  if (walkMin !== undefined) keep.walkMin = walkMin
  if (openUntil !== undefined) keep.openUntil = openUntil
  if (mapUrl !== undefined) keep.mapUrl = mapUrl // 留給 localizeOrder 丟（並計數 warn）
  return Object.keys(order.place).length === Object.keys(keep).length ? order : { ...order, place: keep }
}

const digits = (s: string) => (s.match(/\d[\d,]*/g) ?? []).map((d) => d.replace(/,/g, ''))

/**
 * T6／B7：口令裡的金額必須在 place.priceText 裡找得到（數字對得上、幣別對得上國家），否則拔掉。
 * 「約／大約／≈」跟著金額一起拔；拔完只剩標點的 step 整條刪（至少留一條）。
 */
export function scrubAmounts(order: Order, priceText: string, country: Country, placeName?: string): Order {
  const allowed = new Set(digits(priceText))
  const removed: string[] = []
  const wrongCurrency = (a: string) => (country === 'TW' && /[¥￥円]/.test(a)) || (country === 'JP' && /NT|元|塊/.test(a))
  const clean = (text: string): string => {
    let out = text
    // 店名本身的數字（「百元便當」「100元快炒」）不算金額
    for (const a of amountsIn(placeName ? text.split(placeName).join(' ') : text)) {
      const ok = !wrongCurrency(a) && digits(a).every((d) => allowed.has(d))
      if (ok) continue
      removed.push(a)
      const esc = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      out = placeName
        ? out.split(placeName).map((part) => part.replace(new RegExp(`(?:大約|約|≈|~)?\\s*${esc}`, 'g'), '')).join(placeName)
        : out.replace(new RegExp(`(?:大約|約|≈|~)?\\s*${esc}`, 'g'), '')
    }
    return out === text ? text : tidy(out)
  }
  const meme = { top: clean(order.meme.top), big: clean(order.meme.big), bot: clean(order.meme.bot) }
  let steps = order.steps.map(clean).filter((s) => /[\p{L}\p{N}]/u.test(s))
  if (steps.length === 0) steps = [NEUTRAL_STEP]
  const log = clean(order.log)
  if (!removed.length) return order
  console.warn(`[rules] 拔掉 ${removed.length} 個不在價位資料裡的金額`)
  return { ...order, meme, steps, log }
}

/** 拔字後收尾：重複空白、開頭結尾的標點、連續標點。 */
function tidy(s: string): string {
  return s
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/([，、。！？,])\s*(?=[，、。！？,])/g, '')
    .replace(/^[\s，、。,：:]+/, '')
    .replace(/[\s，、,：:]+(?=[。！？]?$)/, '')
    .trim()
}

/**
 * T7／B8／C3：伺服器端禁詞掃描（meme／steps／log）。店名本身不算（真店名可能剛好含禁字）。
 * 命中：top → mode 語料（沒有 pick 時用中性句）；bot → 中性句；big → 去掉禁字；step → 刪掉；log → 中性登記。
 */
function scrubBanned(order: Order, level: Level, pick: PickResult | null, now: Date): Order {
  const name = pick?.place.name
  const hit = (s: string) => findBanned(name ? s.split(name).join('') : s).length > 0
  const salt = lineSalt(`${pick?.place.id ?? ''}|${now.getTime()}`)
  let changed = 0
  const top = hit(order.meme.top) ? (changed++, pick ? modeLine(pick.exhausted ? 'exhausted' : pick.mode, level, pick.visits, salt) : neutralBot(level, salt)) : order.meme.top
  const bot = hit(order.meme.bot) ? (changed++, neutralBot(level, salt + 1)) : order.meme.bot
  let big = order.meme.big
  if (hit(big)) { changed++; for (const w of findBanned(big)) big = big.split(w).join(''); big = big.trim() || (name ? bigName(name) : '照令執行') }
  let steps = order.steps.filter((s) => !hit(s))
  if (steps.length !== order.steps.length) changed++
  if (steps.length === 0) steps = [NEUTRAL_STEP]
  const log = hit(order.log) ? (changed++, NEUTRAL_LOG) : order.log
  if (!changed) return order
  console.warn(`[rules] 禁詞命中 ${changed} 個欄位，已替換`)
  return { ...order, meme: { top, big, bot }, steps, log }
}

/**
 * T3／B6：mode 語意。new 要講沒去過、revisit 要講「第 N 次」（N = visits）、wildcard 要講偵察。
 * exhausted（全面偵察已無新店）→ top 一律換 exhausted 語料，mode 的話交給 bot。
 * 「第 N 次」寫錯（數字不是伺服器算的）→ 該欄位換掉，不讓模型編數字（T6）。
 */
function enforceMode(order: Order, level: Level, pick: PickResult, now: Date): Order {
  const { mode, visits } = pick
  const salt = lineSalt(`${pick.place.id}|${now.getTime()}`)
  let { top, bot } = order.meme
  const before = `${top}|${bot}`
  if (pick.exhausted) top = modeLine('exhausted', level, visits, salt)
  if (hasWrongCount(top, mode, visits)) top = pick.exhausted ? modeLine('exhausted', level, visits, salt) : modeLine(mode, level, visits, salt)
  if (hasWrongCount(bot, mode, visits)) bot = neutralBot(level, salt + 1)
  if (!satisfiesMode(`${top}\n${bot}`, mode, visits)) {
    if (pick.exhausted) bot = modeLine(mode, level, visits, salt + 2)
    else top = modeLine(mode, level, visits, salt)
  }
  // steps／log 裡的「第 N 次」也不准錯（例：「這是你第 5 次來」但其實第 2 次）
  const fixNth = (s: string) => (hasWrongCount(s, mode, visits) ? s.replace(/第\s*([0-9０-９]+|[一二兩三四五六七八九十]+)\s*次/g, mode === 'revisit' ? `第 ${visits} 次` : '第一次') : s)
  const steps = order.steps.map(fixNth)
  const log = fixNth(order.log)
  if (`${top}|${bot}` === before && steps.every((s, i) => s === order.steps[i]) && log === order.log) return order
  console.warn(`[rules] mode=${mode} 語意不符，已換語料`)
  return { ...order, meme: { ...order.meme, top, bot }, steps, log }
}

/**
 * 階段 D：台灣情境用語守門 + 模型輸出的 URL 一律拔掉（DEV-PLAN-2 規則 8、9）。
 * 涵蓋 meme.top / meme.big / meme.bot / steps[] / log。命中就地替換並 console.warn 一筆，
 * 讓 Vercel runtime log 看得出黑名單命中頻率。乾淨輸入原樣回傳（同一個 reference）。
 * Round 3：country 決定用哪套規則（人在日本不把「地鐵」換成「捷運」，反而把「捷運」換成當地說法）。
 */
export function localizeOrder(order: Order, country: Country = 'TW'): Order {
  const hits: string[] = []
  let out = order

  const meme = localizeFields(order.meme, ['top', 'big', 'bot'], country)
  if (meme.hits.length) { hits.push(...meme.hits.map((h) => `meme.${h}`)); out = { ...out, meme: meme.value } }

  const rest = localizeFields(out, ['steps', 'log'], country)
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
