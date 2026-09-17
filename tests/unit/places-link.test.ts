// @vitest-environment node
// 階段 B：店名 → Google Maps 連結。withPlace() 是純函式，完全確定性。
import { describe, expect, it } from 'vitest'
import { withPlace } from '../../api/order.ts'
import { placeMapUrl } from '../../src/places.ts'
import type { PlaceCandidate } from '../../src/prompt.ts'
import type { Order } from '../../src/types.ts'

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

describe('withPlace（B-4 四種情形）', () => {
  it('id 比中 → 用真實資料覆寫並補 mapUrl', () => {
    const out = withPlace({ ...base, place: { id: 'ChIJxxx', name: '阿財魯肉飯' } }, places)
    expect(out.place).toEqual({
      id: 'ChIJxxx', name: '阿財魯肉飯', walkMin: 6, openUntil: '21:00',
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=%E9%98%BF%E8%B2%A1%E9%AD%AF%E8%82%89%E9%A3%AF&query_place_id=ChIJxxx',
    })
  })
  it('模型只寫對店名、id 亂填 → 仍比中，且 mapUrl 用的是伺服器端的真 id', () => {
    const out = withPlace({ ...base, place: { id: 'made-up', name: 'Mr. Wu & Sons 牛肉麵' } }, places)
    expect(out.place?.id).toBe('ChIJyyy')
    expect(out.place?.mapUrl).toContain('query_place_id=ChIJyyy')
    expect(out.place?.mapUrl).not.toContain('made-up')
  })
  it('比不中 → 原樣回傳，不得產生 mapUrl', () => {
    const order = { ...base, place: { id: 'nope', name: '不存在的店' } }
    const out = withPlace(order, places)
    expect(out).toBe(order)
    expect(out.place?.mapUrl).toBeUndefined()
  })
  it('places 為空（Places 降級）→ 沒有 mapUrl，不會出現 undefined 字串', () => {
    const out = withPlace({ ...base, place: { id: 'ChIJxxx', name: '阿財魯肉飯' } }, [])
    expect(out.place?.mapUrl).toBeUndefined()
    expect(JSON.stringify(out)).not.toContain('undefined')
  })
  it('order.place 為 undefined → 不炸，原樣回傳', () => {
    expect(withPlace(base, places)).toBe(base)
  })
})
