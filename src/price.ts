// 價位檔、國家判定、顯示字串（DEV-PLAN-3 §B.2、R3§4.2–4.3）。純函式，無 I/O。
// 鐵則（T6）：顯示給使用者的金額只能來自 Google 當次回傳的 priceRange；只有 priceLevel 時用文字描述，不換算成金額。
import type { Band, Country, PlaceCandidate, PriceLevel } from './types.ts'

/** 每人每餐的檔位切點：≤c0 → 1；≤c1 → 2；≤c2 → 3；其上 → 4。 */
export const CUTS: Record<'TW' | 'JP', readonly [number, number, number]> = { TW: [150, 400, 1000], JP: [1000, 2500, 6000] }

/** 座標 → 國家。台灣：lat 21.5–26.5 且 lng 118.0–122.5（含金門、馬祖）；日本：lat 24.0–45.6 且 lng 122.9–146.0；其餘 other。 */
export function countryOf(loc: { lat: number; lng: number } | undefined): Country {
  if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return 'TW'
  const { lat, lng } = loc
  if (lat >= 21.5 && lat <= 26.5 && lng >= 118.0 && lng <= 122.5) return 'TW'
  if (lat >= 24.0 && lat <= 45.6 && lng >= 122.9 && lng <= 146.0) return 'JP'
  return 'other'
}

/** priceRange.currency 'TWD'→TW、'JPY'→JP，其餘 undefined。 */
export function currencyCountry(code?: string): Country | undefined {
  if (code === 'TWD') return 'TW'
  if (code === 'JPY') return 'JP'
  return undefined
}

const LEVEL_BAND: Partial<Record<PriceLevel, number>> = {
  PRICE_LEVEL_INEXPENSIVE: 1.5,
  PRICE_LEVEL_MODERATE: 2.5,
  PRICE_LEVEL_EXPENSIVE: 3.5,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
}

function bandFromAmount(mid: number, cuts: readonly [number, number, number]): Band {
  if (mid <= cuts[0]) return 1
  if (mid <= cuts[1]) return 2
  if (mid <= cuts[2]) return 3
  return 4
}

/**
 * 1–4，可為 x.5（priceLevel 粗映射，代表跨兩檔）；null = 無資料／FREE／UNSPECIFIED。
 * priceRange 有 start：mid = end ? (start+end)/2 : start×1.3，用「幣別所屬國」的切點（沒幣別才用座標國）。
 */
export function bandOf(p: Pick<PlaceCandidate, 'priceLevel' | 'priceRange'>, country: Country): number | null {
  const r = p.priceRange
  if (r && typeof r.start === 'number' && Number.isFinite(r.start)) {
    const c = currencyCountry(r.currency) ?? country
    if (c === 'TW' || c === 'JP') {
      const mid = typeof r.end === 'number' && Number.isFinite(r.end) ? (r.start + r.end) / 2 : r.start * 1.3
      return bandFromAmount(mid, CUTS[c])
    }
  }
  return (p.priceLevel && LEVEL_BAND[p.priceLevel]) ?? null
}

/** x.5 代表同時落在兩檔。 */
function bandsCovered(band: number): number[] {
  return Number.isInteger(band) ? [band] : [Math.floor(band), Math.ceil(band)]
}

/** 命中 1.0；相鄰 0.35；未知 0.5；其餘 0。wanted 空 = 不限 → 1.0。strict 時相鄰與未知都 0。 */
export function priceFit(band: number | null, wanted: Band[] | undefined, strict = false): number {
  if (!wanted || wanted.length === 0) return 1
  if (band === null || !Number.isFinite(band)) return strict ? 0 : 0.5
  let dist = Infinity
  for (const c of bandsCovered(band)) for (const w of wanted) dist = Math.min(dist, Math.abs(c - w))
  if (dist === 0) return 1
  if (dist === 1) return strict ? 0 : 0.35
  return 0
}

const LABELS: Record<'TW' | 'JP', [string, string, string, string]> = {
  TW: ['≤150', '150–400', '400–1,000', '1,000+'],
  JP: ['〜¥1,000', '¥1,000〜2,500', '¥2,500〜6,000', '¥6,000〜'],
}

/** chips 文字（每人每餐）。other 回空陣列（預算列隱藏）。 */
export function bandLabels(country: Country): { band: Band; label: string }[] {
  if (country !== 'TW' && country !== 'JP') return []
  return LABELS[country].map((label, i) => ({ band: (i + 1) as Band, label }))
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

const LEVEL_TEXT: Partial<Record<PriceLevel, string>> = {
  PRICE_LEVEL_INEXPENSIVE: '平價',
  PRICE_LEVEL_MODERATE: '中價位',
  PRICE_LEVEL_EXPENSIVE: '偏高價位',
  PRICE_LEVEL_VERY_EXPENSIVE: '高價位',
}

/**
 * 顯示字串：只用 Google 當次回傳值。priceRange → 「≈NT$150–400」「≈¥1,000〜2,500」「≈NT$1,000+」；
 * 只有 priceLevel → Google 的價位描述（平價／中價位…），**不換算成金額**；沒有資料 → undefined（卡上顯示「價位未知」）。
 */
export function priceText(p: Pick<PlaceCandidate, 'priceLevel' | 'priceRange'>, country: Country): string | undefined {
  const r = p.priceRange
  if (r && typeof r.start === 'number' && Number.isFinite(r.start)) {
    const c = currencyCountry(r.currency) ?? (r.currency ? undefined : country)
    const hasEnd = typeof r.end === 'number' && Number.isFinite(r.end)
    if (c === 'JP') return hasEnd ? `≈¥${fmt(r.start)}〜${fmt(r.end!)}` : `≈¥${fmt(r.start)}〜`
    if (c === 'TW') return hasEnd ? `≈NT$${fmt(r.start)}–${fmt(r.end!)}` : `≈NT$${fmt(r.start)}+`
    if (r.currency) return hasEnd ? `≈${r.currency} ${fmt(r.start)}–${fmt(r.end!)}` : `≈${r.currency} ${fmt(r.start)}+`
  }
  return p.priceLevel ? LEVEL_TEXT[p.priceLevel] : undefined
}

const AMOUNT_RES: RegExp[] = [
  /NT\$?\s?\d[\d,]*(?:\s?[–~〜-]\s?\d[\d,]*)?/g,
  /[¥￥]\s?\d[\d,]*(?:\s?[–~〜-]\s?\d[\d,]*)?/g,
  /\d[\d,]*(?:\s?[–~〜-]\s?\d[\d,]*)?\s?(?:元|円|塊)/g,
]

/**
 * 抓文字裡的金額片段（NT$120、¥1,000、120元、1000円、NT$150–400），給 enforceRules 比對。去重、保留出現順序。
 * 刻意不抓沒有幣別記號的「150–400」：口令裡天天有「10–15 分鐘」「11:30–14:00」，誤刪的代價比漏抓大。
 */
export function amountsIn(text: string): string[] {
  const out: string[] = []
  const taken: [number, number][] = []
  for (const re of AMOUNT_RES) {
    re.lastIndex = 0
    for (const m of text.matchAll(re)) {
      const s = m.index ?? 0
      const e = s + m[0].length
      if (taken.some(([a, b]) => s < b && e > a)) continue // 被更具體的規則抓過
      taken.push([s, e])
      out.push(m[0].trim())
    }
  }
  return [...new Set(out)]
}
