// 時區由座標決定（DEV-PLAN-3 B2）。伺服器跑在 UTC 也要算對：不准用 Date#getDay()/getHours()。
import { countryOf } from './price.ts'

export type Tz = 'Asia/Taipei' | 'Asia/Tokyo'

/** 日本座標 → Asia/Tokyo；其餘（含沒座標）→ Asia/Taipei。 */
export function tzOf(loc: { lat: number; lng: number } | undefined): Tz {
  return countryOf(loc) === 'JP' ? 'Asia/Tokyo' : 'Asia/Taipei'
}

/** ISO → 當地 HH:MM（24 小時制）。 */
export function hhmmIn(iso: string, tz: Tz): string {
  const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).formatToParts(new Date(iso))
  const h = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return `${h === '24' ? '00' : h}:${m}`
}

const WEEKDAY_MON0: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

/** 當地星期幾，週一 = 0（對 Google weekdayDescriptions 的順序）。 */
export function weekdayMondayIndex(now: Date, tz: Tz): number {
  const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz }).format(now)
  return WEEKDAY_MON0[wd] ?? (now.getDay() + 6) % 7
}

/** 當地小時 0–23。 */
export function hourIn(now: Date, tz: Tz): number {
  const h = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(now)
  const n = Number(h) % 24
  return Number.isFinite(n) ? n : now.getHours()
}
