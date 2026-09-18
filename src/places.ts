// Places 呼叫規則 — 第 8 節。純邏輯放這裡，實際 fetch 在 api/order.ts。
import type { PlaceCandidate } from './prompt.ts'
import type { ModuleCard } from './types.ts'

/** 第 8 節：固定 fieldMask，這組落在 Enterprise SKU。 */
export const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.location',
  'places.currentOpeningHours.openNow',
  'places.regularOpeningHours.weekdayDescriptions',
  'places.primaryType',
].join(',')

export const MAX_RESULTS = 8
/** 第 8 節硬上限：每日 40 次之後前端就不帶定位了。 */
export const DAILY_PLACES_CAP = 40

export interface RawPlace {
  id?: string
  displayName?: { text?: string }
  location?: { latitude?: number; longitude?: number }
  currentOpeningHours?: { openNow?: boolean }
  regularOpeningHours?: { weekdayDescriptions?: string[] }
  primaryType?: string
}

/**
 * 店名 → Google Maps 連結（DEV-PLAN-2 階段 B）。
 * 用 Google 官方 Maps URLs scheme：query 是 query_place_id 失效時的後備，兩個都帶。
 * 只能拿 Places API 回來的真 id 來組；模型講的 id 不可信。
 */
export function placeMapUrl(id: string, name: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(id)}`
}

/**
 * 依使用者的「想吃」決定 Places 查什麼類型。甜食 → 麵包／咖啡／冰店；其餘照卡片預設。
 * 只用 Places API (New) Table A 裡長期存在的類型，避免一個不合法的 type 讓整次查詢 400。
 */
export function placesTypesFor(defaultTypes: string[], choices: Record<string, string | number>): string[] {
  return choices.taste === '甜食' ? ['bakery', 'cafe', 'ice_cream_shop'] : defaultTypes
}

/** 這次要怎麼查 Places：Nearby（照 type）或 Text Search（照中文關鍵字）。 */
export type PlacesSearch =
  | { kind: 'nearby'; includedTypes: string[]; radius: number }
  | { kind: 'text'; textQuery: string; radius: number }

/**
 * 卡片 + 使用者選擇 → 查法。有 textQuery 設定就走 Text Search：選項對不到關鍵字時用該欄 default 的關鍵字，
 * 再對不到就退回 Nearby。沒有 textQuery 的卡照舊走 Nearby（eat 的甜食改 type 也在這裡）。
 */
export function placesSearchFor(
  card: Pick<ModuleCard, 'intake' | 'placesQuery'>,
  choices: Record<string, string | number>,
): PlacesSearch {
  const radius = card.placesQuery?.radiusByTransport?.default ?? 800
  const tq = card.placesQuery?.textQuery
  if (tq) {
    const fallback = card.intake.find((f) => f.key === tq.key)?.default
    const q = tq.byOption[String(choices[tq.key] ?? '')] ?? tq.byOption[String(fallback ?? '')]
    if (q) return { kind: 'text', textQuery: q, radius }
  }
  return { kind: 'nearby', includedTypes: placesTypesFor(card.placesQuery?.includedTypes ?? [], choices), radius }
}

/** 公尺 → 步行分鐘（80 m/min，無條件進位，至少 1）。 */
export function walkMinutes(meters: number): number {
  return Math.max(1, Math.ceil(meters / 80))
}

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** 今天是星期幾的營業時間字串裡，抓最後一個 HH:MM 當關門時間。 */
export function closingTime(descriptions: string[] | undefined, now: Date): string | undefined {
  if (!descriptions?.length) return undefined
  const idx = (now.getDay() + 6) % 7 // Google 的 weekdayDescriptions 從星期一開始
  const line = descriptions[idx]
  if (!line) return undefined
  const times = [...line.matchAll(/(\d{1,2}):(\d{2})/g)]
  const last = times.at(-1)
  if (!last) return undefined
  return `${last[1]!.padStart(2, '0')}:${last[2]}`
}

/** 第 8 節：只保留 openNow，濾掉 exclude，轉成給 Claude 的候選清單。 */
export function toCandidates(
  raw: RawPlace[],
  origin: { lat: number; lng: number },
  now: Date,
  exclude: string[] = [],
): PlaceCandidate[] {
  return raw
    .filter((p) => p.id && p.displayName?.text)
    .filter((p) => p.currentOpeningHours?.openNow === true)
    .filter((p) => !exclude.includes(p.id!))
    .map((p) => {
      const loc = p.location
      const walkMin =
        loc?.latitude != null && loc?.longitude != null
          ? walkMinutes(haversineMeters(origin, { lat: loc.latitude, lng: loc.longitude }))
          : undefined
      return {
        id: p.id!,
        name: p.displayName!.text!,
        walkMin,
        openUntil: closingTime(p.regularOpeningHours?.weekdayDescriptions, now),
        primaryType: p.primaryType,
      }
    })
    .sort((a, b) => (a.walkMin ?? 99) - (b.walkMin ?? 99))
    .slice(0, MAX_RESULTS)
}
