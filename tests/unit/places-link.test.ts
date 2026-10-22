// @vitest-environment node
// 階段 B：店名 → Google Maps 連結。withPlace() 是純函式，完全確定性。
import { describe, expect, it } from 'vitest'
import { withPlace } from '../../api/order.ts'
import { placeMapUrl } from '../../src/places.ts'
import type { PlaceCandidate } from '../../src/prompt.ts'
import type { Order, PickResult } from '../../src/types.ts'

const base: Order = {
  verdict: 'do',
  meme: { top: '去吃熱的', big: '阿財魯肉飯', bot: '這週兩天超商了' },
  steps: ['步行 6 分鐘。'],
  log: '12:41 魯肉飯。',
}
const places: PlaceCandidate[] = [
  { id: 'ChIJxxx', name: '阿財魯肉飯', walkMin: 6, openUntil: '21:00' },
  { id: 'ChIJyyy', name: 'Mr. Wu & Sons 牛肉麵', walkMin: 3 },
]

describe('placeMapUrl（Google 官方 Maps URLs scheme）', () => {
  it('帶 query 與 query_place_id 兩個參數', () => {
    expect(placeMapUrl('ChIJxxx', '阿財魯肉飯')).toBe(
      'https://www.google.com/maps/search/?api=1&query=%E9%98%BF%E8%B2%A1%E9%AD%AF%E8%82%89%E9%A3%AF&query_place_id=ChIJxxx',
    )
  })
  it('店名含空白／中文／& 都正確 encode', () => {
    const url = placeMapUrl('ChIJyyy', 'Mr. Wu & Sons 牛肉麵')
    expect(url).toContain('query=Mr.%20Wu%20%26%20Sons%20%E7%89%9B%E8%82%89%E9%BA%B5&')
    expect(new URL(url).searchParams.get('query')).toBe('Mr. Wu & Sons 牛肉麵')
    expect(new URL(url).searchParams.get('query_place_id')).toBe('ChIJyyy')
  })
})

// DEV-PLAN-3 §E.3：withPlace(order, places) → withPlace(order, pick, country)。四種情形語意不變：
// 店的資料與 mapUrl 只來自伺服器（這輪起是 pickPlace 的結果），模型寫的 id／店名都不採用。
const pickOf = (place: PlaceCandidate, extra: Partial<PickResult> = {}): PickResult =>
  ({ place, mode: 'new', visits: 1, relaxed: [], exhausted: false, ...extra })

describe('withPlace（B-4 四種情形）', () => {
  it('有 pick → 用真實資料覆寫並補 mapUrl', () => {
    const out = withPlace({ ...base, place: { id: 'ChIJxxx', name: '阿財魯肉飯' } }, pickOf(places[0]!), 'TW')
    expect(out.place).toMatchObject({
      id: 'ChIJxxx', name: '阿財魯肉飯', walkMin: 6, openUntil: '21:00',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=%E9%98%BF%E8%B2%A1%E9%AD%AF%E8%82%89%E9%A3%AF&query_place_id=ChIJxxx',
    })
  })
  it('模型只寫對店名、id 亂填 → mapUrl 用的是伺服器端的真 id', () => {
    const out = withPlace({ ...base, place: { id: 'made-up', name: 'Mr. Wu & Sons 牛肉麵' } }, pickOf(places[1]!), 'TW')
    expect(out.place?.id).toBe('ChIJyyy')
    expect(out.place?.mapUrl).toContain('query_place_id=ChIJyyy')
    expect(out.place?.mapUrl).not.toContain('made-up')
  })
  it('模型寫了別家店 → 一律換成 pick 的那家（T2）；沒有 pick → 原樣回傳，不得產生 mapUrl', () => {
    const order = { ...base, place: { id: 'nope', name: '不存在的店' } }
    expect(withPlace(order, pickOf(places[0]!), 'TW').place?.id).toBe('ChIJxxx')
    const out = withPlace(order, null, 'TW')
    expect(out).toBe(order)
    expect(out.place?.mapUrl).toBeUndefined()
  })
  it('沒有 pick（不需要 Places 的卡）→ 沒有 mapUrl，不會出現 undefined 字串', () => {
    const out = withPlace({ ...base, place: { id: 'ChIJxxx', name: '阿財魯肉飯' } }, null, 'TW')
    expect(out.place?.mapUrl).toBeUndefined()
    expect(JSON.stringify(out)).not.toContain('undefined')
  })
  it('order.place 為 undefined、沒有 pick → 不炸，原樣回傳', () => {
    expect(withPlace(base, null, 'TW')).toBe(base)
  })
})

describe('withPlace：Round 3 欄位只由伺服器填', () => {
  it('mode／visits／band／priceText／country／cuisine／brand／exhausted', () => {
    const cand: PlaceCandidate = {
      id: 'ChIJzzz', name: '摩斯漢堡 南京店', walkMin: 4, opensAt: '11:00', primaryType: 'hamburger_restaurant',
      priceRange: { start: 150, end: 300, currency: 'TWD' },
    }
    const out = withPlace(base, pickOf(cand, { mode: 'revisit', visits: 3, exhausted: true }), 'TW')
    expect(out.place).toMatchObject({
      id: 'ChIJzzz', opensAt: '11:00', mode: 'revisit', visits: 3, band: 2, priceText: '≈NT$150–300',
      country: 'TW', cuisine: 'fast', brand: 'mos', exhausted: true,
    })
  })
  it('沒有價位資料 → band null、沒有 priceText（口令卡顯示「價位未知」）；非字典店不給 brand（不存店名片段）', () => {
    const out = withPlace(base, pickOf(places[0]!), 'TW')
    expect(out.place?.band).toBeNull()
    expect(out.place?.priceText).toBeUndefined()
    expect(out.place?.brand).toBeUndefined()
  })
  it('日本：¥ 字串、country JP', () => {
    const cand: PlaceCandidate = { id: 'j1', name: 'すき家 渋谷店', priceRange: { start: 500, end: 1000, currency: 'JPY' } }
    const out = withPlace(base, pickOf(cand), 'JP')
    expect(out.place).toMatchObject({ band: 1, priceText: '≈¥500〜1,000', country: 'JP', brand: 'sukiya' })
  })
})
