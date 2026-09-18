import { describe, expect, it } from 'vitest'
import { parseOrder, ParseError } from '../../src/orderParse.ts'
import { attendVerdict, buyVerdict, enforceRules, lightsOut } from '../../src/rules.ts'
import { closingTime, toCandidates, walkMinutes, type RawPlace } from '../../src/places.ts'
import type { Order } from '../../src/types.ts'

const ORDER = {
  verdict: 'do',
  meme: { top: '去吃熱的', big: '阿財魯肉飯', bot: '這週兩天超商了' },
  steps: ['步行 6 分鐘。', '魯肉飯、滷蛋。', '12 分鐘吃完。'],
  log: '12:41 魯肉飯，12:58 完成。',
}
const RAW = JSON.stringify(ORDER)

describe('order parser 四層（第 11 節 / 13.1）', () => {
  it('第 1 層：合法 JSON', () => {
    expect(parseOrder(RAW).meme.big).toBe('阿財魯肉飯')
  })

  it('第 2 層：包在 ```json fence 裡', () => {
    expect(parseOrder('```json\n' + RAW + '\n```').meme.big).toBe('阿財魯肉飯')
  })

  it('第 3 層：前後有多餘文字', () => {
    expect(parseOrder('報告班長，這是口令：\n' + RAW + '\n以上。').meme.big).toBe('阿財魯肉飯')
  })

  it('第 4 層：非法 → 拋 ParseError', () => {
    expect(() => parseOrder('班長今天請假，沒有 JSON。')).toThrow(ParseError)
  })

  it('形狀不對（缺 steps）也算非法', () => {
    expect(() => parseOrder(JSON.stringify({ ...ORDER, steps: [] }))).toThrow(ParseError)
  })

  it('verdict 不是 do/stop 也算非法', () => {
    expect(() => parseOrder(JSON.stringify({ ...ORDER, verdict: 'maybe' }))).toThrow(ParseError)
  })

  it('字串裡有大括號不會把物件切斷', () => {
    const tricky = { ...ORDER, log: '他說「{收工}」然後走了' }
    expect(parseOrder('前言 ' + JSON.stringify(tricky) + ' 後語').log).toContain('收工')
  })

  it('steps 超過 3 條會截到 3 條（第 5 節上限）', () => {
    const many = { ...ORDER, steps: ['a', 'b', 'c', 'd', 'e'] }
    expect(parseOrder(JSON.stringify(many)).steps).toHaveLength(3)
  })
})

describe('attend 硬規則（第 13.1 節）', () => {
  it('★2 飯局 → stop', () => expect(attendVerdict(2, '飯局')).toBe('stop'))
  it('★2 婚禮 → do', () => expect(attendVerdict(2, '婚禮')).toBe('do'))
  it('★4 → do', () => expect(attendVerdict(4, '飯局')).toBe('do'))
  it('★1 公司聚會 → stop', () => expect(attendVerdict(1, '公司聚會')).toBe('stop'))

  it('Claude 講錯也會被本地規則蓋掉', () => {
    const wrong = { ...ORDER, verdict: 'do' } as Order
    const fixed = enforceRules(wrong, 'attend', { stars: 2, occasion: '飯局' }, new Date(), [])
    expect(fixed.verdict).toBe('stop')
  })
})

describe('sleep 硬規則（第 13.1 節）', () => {
  it('07:30 起床 → 23:30 熄燈', () => expect(lightsOut('07:30')).toBe('23:30'))
  it('06:30 起床 → 22:30 熄燈', () => expect(lightsOut('06:30')).toBe('22:30'))
  it('08:30 起床 → 00:30 熄燈', () => expect(lightsOut('08:30')).toBe('00:30'))
  it('格式不對就拋錯', () => expect(() => lightsOut('早上')).toThrow())
})

describe('buy 硬規則（第 6 節 72 小時）', () => {
  const now = new Date('2026-09-11T12:00:00+08:00')
  it('沒報告過 → stop', () => expect(buyVerdict([], now)).toBe('stop'))
  it('72 小時前報告過 → do', () => {
    const recent = [{ module: 'buy' as const, big: '不買。', at: '2026-09-07T12:00:00+08:00' }]
    expect(buyVerdict(recent, now)).toBe('do')
  })
  it('昨天才報告過 → 還是 stop', () => {
    const recent = [{ module: 'buy' as const, big: '不買。', at: '2026-09-10T12:00:00+08:00' }]
    expect(buyVerdict(recent, now)).toBe('stop')
  })
})

describe('reply 永遠 do（第 6 節）', () => {
  it('Claude 回 stop 也會被蓋成 do', () => {
    const wrong = { ...ORDER, verdict: 'stop' } as Order
    expect(enforceRules(wrong, 'reply', {}, new Date(), []).verdict).toBe('do')
  })
})

describe('Places 過濾（第 8 節）', () => {
  const origin = { lat: 25.033, lng: 121.5654 }
  const now = new Date('2026-09-11T12:40:00+08:00') // 週四
  const raw: RawPlace[] = [
    {
      id: 'p1', displayName: { text: '阿財魯肉飯' },
      location: { latitude: 25.0335, longitude: 121.5658 },
      currentOpeningHours: { openNow: true },
      regularOpeningHours: { weekdayDescriptions: ['星期一: 11:00 – 21:00', '星期二: 11:00 – 21:00', '星期三: 11:00 – 21:00', '星期四: 11:00 – 21:00', '星期五: 11:00 – 21:00', '星期六: 休息', '星期日: 休息'] },
    },
    { id: 'p2', displayName: { text: '關門的店' }, currentOpeningHours: { openNow: false } },
    { id: 'p3', displayName: { text: '換口令換掉的店' }, currentOpeningHours: { openNow: true } },
  ]

  it('只留 openNow', () => {
    expect(toCandidates(raw, origin, now).map((p) => p.id)).not.toContain('p2')
  })

  it('exclude 的店會被濾掉（換口令）', () => {
    expect(toCandidates(raw, origin, now, ['p3']).map((p) => p.id)).toEqual(['p1'])
  })

  it('算得出步行分鐘與今日打烊時間', () => {
    const c = toCandidates(raw, origin, now)[0]!
    expect(c.name).toBe('阿財魯肉飯')
    expect(c.walkMin).toBeGreaterThan(0)
    expect(c.openUntil).toBe('21:00')
  })

  it('步行分鐘：80 公尺/分，無條件進位', () => {
    expect(walkMinutes(0)).toBe(1)
    expect(walkMinutes(480)).toBe(6)
    expect(walkMinutes(481)).toBe(7)
  })

  it('沒有營業時間資料就不編（回 undefined）', () => {
    expect(closingTime(undefined, now)).toBeUndefined()
  })
})

describe('placesSearchFor（rest 走 Text Search、eat 走 Nearby）', () => {
  it('rest：四個選項各對到中文關鍵字；沒選就用 default 咖啡', async () => {
    const { placesSearchFor } = await import('../../src/places.ts')
    const { CARD_BY_ID } = await import('../../src/cards.ts')
    expect(placesSearchFor(CARD_BY_ID.rest, { drink: '居酒屋' })).toEqual({ kind: 'text', textQuery: '居酒屋', radius: 800 })
    expect(placesSearchFor(CARD_BY_ID.rest, { drink: '熱炒燒烤' })).toEqual({ kind: 'text', textQuery: '熱炒 燒烤', radius: 800 })
    expect(placesSearchFor(CARD_BY_ID.rest, { drink: '酒吧' })).toEqual({ kind: 'text', textQuery: '酒吧', radius: 800 })
    expect(placesSearchFor(CARD_BY_ID.rest, {})).toEqual({ kind: 'text', textQuery: '咖啡廳', radius: 800 })
  })
  it('eat：沒有 textQuery 就走 Nearby，甜食照舊改 type', async () => {
    const { placesSearchFor } = await import('../../src/places.ts')
    const { CARD_BY_ID } = await import('../../src/cards.ts')
    expect(placesSearchFor(CARD_BY_ID.eat, { taste: '甜食' })).toEqual({ kind: 'nearby', includedTypes: ['bakery', 'cafe', 'ice_cream_shop'], radius: 800 })
    expect(placesSearchFor(CARD_BY_ID.eat, {})).toEqual({ kind: 'nearby', includedTypes: ['restaurant'], radius: 800 })
  })
})

describe('placesTypesFor（甜食改查甜點店）', () => {
  it('甜食 → bakery / cafe / ice_cream_shop；其餘照卡片預設', async () => {
    const { placesTypesFor } = await import('../../src/places.ts')
    expect(placesTypesFor(['restaurant'], { taste: '甜食' })).toEqual(['bakery', 'cafe', 'ice_cream_shop'])
    expect(placesTypesFor(['restaurant'], { taste: '鹹食' })).toEqual(['restaurant'])
    expect(placesTypesFor(['restaurant'], {})).toEqual(['restaurant'])
    expect(placesTypesFor(['cafe'], { taste: '甜食' })).toEqual(['bakery', 'cafe', 'ice_cream_shop'])
  })
})
