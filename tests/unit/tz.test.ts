// W4：時區由座標決定（DEV-PLAN-3 B10）。伺服器跑在 UTC 也要對。
import { afterEach, describe, expect, it } from 'vitest'
import { hhmmIn, hourIn, tzOf, weekdayMondayIndex } from '../../src/tz.ts'

const TAIPEI = { lat: 25.033, lng: 121.5654 }
const TOKYO = { lat: 35.6812, lng: 139.7671 }

describe('tzOf', () => {
  it('台北 → Asia/Taipei；東京、沖繩 → Asia/Tokyo；金門 → Asia/Taipei', () => {
    expect(tzOf(TAIPEI)).toBe('Asia/Taipei')
    expect(tzOf(TOKYO)).toBe('Asia/Tokyo')
    expect(tzOf({ lat: 26.2124, lng: 127.6809 })).toBe('Asia/Tokyo')
    expect(tzOf({ lat: 24.4493, lng: 118.3767 })).toBe('Asia/Taipei')
  })
  it('沒有座標或其他地區 → Asia/Taipei（既有行為）', () => {
    expect(tzOf(undefined)).toBe('Asia/Taipei')
    expect(tzOf({ lat: 1.35, lng: 103.82 })).toBe('Asia/Taipei')
  })
})

const savedTz = process.env.TZ
afterEach(() => {
  if (savedTz === undefined) delete process.env.TZ
  else process.env.TZ = savedTz
})

// 2026-10-22 是週四。以 UTC 絕對時間建構，不依賴執行環境的 TZ。
// 台北 = UTC+8、東京 = UTC+9：同一個瞬間，兩地的日期與時間可以差一天。
const at = (h: number, m: number, dayOffset = 0) => new Date(Date.UTC(2026, 9, 22 + dayOffset, h, m))

describe('B10：台北／東京 × 00:30／08:30／23:30（TZ=UTC 與其他 TZ 結果相同）', () => {
  // [說明, 瞬間, tz, 當地週幾(週一=0), 當地小時, 當地 HH:MM]
  const table = [
    ['台北 週四 00:30', at(16, 30, -1), 'Asia/Taipei', 3, 0, '00:30'], // UTC 還在週三 16:30
    ['台北 週四 08:30', at(0, 30), 'Asia/Taipei', 3, 8, '08:30'],
    ['台北 週四 23:30', at(15, 30), 'Asia/Taipei', 3, 23, '23:30'],
    ['東京 週四 00:30', at(15, 30, -1), 'Asia/Tokyo', 3, 0, '00:30'], // UTC 還在週三 15:30
    ['東京 週四 08:30', at(23, 30, -1), 'Asia/Tokyo', 3, 8, '08:30'],
    ['東京 週四 23:30', at(14, 30), 'Asia/Tokyo', 3, 23, '23:30'],
  ] as const

  for (const tzEnv of ['UTC', 'Asia/Taipei', 'America/Los_Angeles']) {
    for (const [name, now, tz, wd, hr, hhmm] of table) {
      it(`${name}（process TZ=${tzEnv}）`, () => {
        process.env.TZ = tzEnv
        expect(weekdayMondayIndex(now, tz)).toBe(wd)
        expect(hourIn(now, tz)).toBe(hr)
        expect(hhmmIn(now.toISOString(), tz)).toBe(hhmm)
      })
    }
  }

  it('同一個瞬間兩地差一天：台北週四 23:30 = 東京週五 00:30', () => {
    const now = at(15, 30)
    expect(weekdayMondayIndex(now, 'Asia/Taipei')).toBe(3)
    expect(weekdayMondayIndex(now, 'Asia/Tokyo')).toBe(4)
    expect(hourIn(now, 'Asia/Taipei')).toBe(23)
    expect(hourIn(now, 'Asia/Tokyo')).toBe(0)
    expect(hhmmIn(now.toISOString(), 'Asia/Tokyo')).toBe('00:30')
  })
  it('週日 → 週一換日：週一 = 0、週日 = 6', () => {
    const sunTaipei2330 = new Date(Date.UTC(2026, 9, 25, 15, 30)) // 台北週日 23:30、東京週一 00:30
    expect(weekdayMondayIndex(sunTaipei2330, 'Asia/Taipei')).toBe(6)
    expect(weekdayMondayIndex(sunTaipei2330, 'Asia/Tokyo')).toBe(0)
  })
  it('一週七天的索引：2026-10-19（一）到 10-25（日）= 0..6', () => {
    for (let i = 0; i < 7; i++) expect(weekdayMondayIndex(new Date(Date.UTC(2026, 9, 19 + i, 4, 0)), 'Asia/Taipei')).toBe(i)
  })
})

describe('hhmmIn', () => {
  it('午夜顯示 00:xx，不是 24:xx', () => {
    expect(hhmmIn('2026-10-22T00:05:00+08:00', 'Asia/Taipei')).toBe('00:05')
    expect(hhmmIn('2026-10-22T00:05:00+09:00', 'Asia/Tokyo')).toBe('00:05')
    expect(hhmmIn('2026-10-21T16:00:00Z', 'Asia/Taipei')).toBe('00:00')
  })
  it('補零、24 小時制', () => {
    expect(hhmmIn('2026-10-22T09:05:00+08:00', 'Asia/Taipei')).toBe('09:05')
    expect(hhmmIn('2026-10-22T21:00:00+08:00', 'Asia/Taipei')).toBe('21:00')
    expect(hhmmIn('2026-10-22T13:07:00+09:00', 'Asia/Tokyo')).toBe('13:07')
  })
  it('ISO 帶任何偏移都換算成當地：UTC 與 +09:00 的字串進東京都對', () => {
    expect(hhmmIn('2026-10-22T03:30:00Z', 'Asia/Tokyo')).toBe('12:30')
    expect(hhmmIn('2026-10-22T03:30:00Z', 'Asia/Taipei')).toBe('11:30')
    expect(hhmmIn('2026-10-22T12:30:00+09:00', 'Asia/Taipei')).toBe('11:30')
  })
})

describe('hourIn', () => {
  it('0–23；午餐時段 11–13 在兩地各自成立', () => {
    expect(hourIn(new Date('2026-10-22T11:59:00+08:00'), 'Asia/Taipei')).toBe(11)
    expect(hourIn(new Date('2026-10-22T12:00:00+09:00'), 'Asia/Tokyo')).toBe(12)
    expect(hourIn(new Date('2026-10-22T03:30:00Z'), 'Asia/Tokyo')).toBe(12)
    expect(hourIn(new Date('2026-10-22T03:30:00Z'), 'Asia/Taipei')).toBe(11)
  })
})
