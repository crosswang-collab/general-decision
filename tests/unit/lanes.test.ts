// @vitest-environment node
// lane 輪替（DEV-PLAN-3 W1.2）：素食 lane、甜食 lane、只挑 verified、rankPreference 交替、細類偏好、400 退路。
import { describe, expect, it } from 'vitest'
import { CARD_BY_ID } from '../../src/cards.ts'
import { mulberry32 } from '../../src/discovery.ts'
import { LANES, mealLanes, pickLane, widenPlan, type LanePlan } from '../../src/lanes.ts'

const many = (n: number, f: (seed: number) => LanePlan) => Array.from({ length: n }, (_, s) => f(s + 1))

describe('LANES 表', () => {
  it('2023 Table A 的 type 標 verified；R3§1.3 新增的標 verified:false', () => {
    const unverified = LANES.filter((l) => !l.verified).map((l) => l.id).sort()
    expect(unverified).toEqual([
      'chinese_noodle_restaurant', 'fine_dining_restaurant', 'hot_pot_restaurant', 'japanese_curry_restaurant', 'japanese_izakaya_restaurant',
      'noodle_shop', 'taiwanese_restaurant', 'tonkatsu_restaurant', 'yakiniku_restaurant', 'yakitori_restaurant',
    ])
    for (const l of LANES.filter((x) => x.verified)) expect(l.since).toBe('2023')
    expect(new Set(LANES.map((l) => l.id)).size).toBe(LANES.length)
  })
})

describe('pickLane', () => {
  it('只在 verified 的 lane 裡挑（500 個種子）', () => {
    const verified = new Set(LANES.filter((l) => l.verified).map((l) => l.id))
    for (const p of many(500, (s) => pickLane(CARD_BY_ID.eat, {}, undefined, 'TW', mulberry32(s)))) {
      expect(p.kind).toBe('nearby')
      expect(verified.has(p.lane), p.lane).toBe(true)
    }
  })

  it('一般 eat 不會挑甜點／咖啡 lane，會輪替出很多種', () => {
    const lanes = new Set(many(500, (s) => pickLane(CARD_BY_ID.eat, { taste: '鹹食' }, undefined, 'TW', mulberry32(s))).map((p) => p.lane))
    for (const l of ['bakery', 'cafe', 'coffee_shop', 'ice_cream_shop']) expect(lanes.has(l)).toBe(false)
    expect(lanes.size).toBeGreaterThan(10)
  })

  it('忌口「素」→ 素食 lane（素食＋純素）', () => {
    for (const p of many(50, (s) => pickLane(CARD_BY_ID.eat, { diet: '素' }, undefined, 'TW', mulberry32(s)))) {
      expect(p.kind === 'nearby' && p.includedTypes).toEqual(['vegetarian_restaurant', 'vegan_restaurant'])
    }
  })

  it('甜食 → 甜食 lane 組（麵包／咖啡／冰店）', () => {
    const sweet = new Set(['bakery', 'cafe', 'ice_cream_shop', 'coffee_shop'])
    for (const p of many(100, (s) => pickLane(CARD_BY_ID.eat, { taste: '甜食' }, undefined, 'TW', mulberry32(s)))) {
      expect(p.kind === 'nearby' && p.includedTypes.every((t) => sweet.has(t))).toBe(true)
    }
  })

  it('不吃牛 → 不排牛排館；14 點後不排早午餐', () => {
    const noBeef = many(500, (s) => pickLane(CARD_BY_ID.eat, { diet: '不吃牛' }, undefined, 'TW', mulberry32(s)))
    expect(noBeef.some((p) => p.lane === 'steak_house')).toBe(false)
    const dinner = many(500, (s) => pickLane(CARD_BY_ID.eat, {}, undefined, 'TW', mulberry32(s), 19))
    expect(dinner.some((p) => p.lane === 'breakfast_restaurant' || p.lane === 'brunch_restaurant')).toBe(false)
    expect(mealLanes({}, 'TW', 9).some((l) => l.id === 'breakfast_restaurant')).toBe(true)
  })

  it('rankPreference：eat 在 POPULARITY／DISTANCE 交替，rest 在 DISTANCE／RELEVANCE 交替', () => {
    const eat = many(200, (s) => pickLane(CARD_BY_ID.eat, {}, undefined, 'TW', mulberry32(s)))
    const eatRanks = eat.map((p) => p.rank)
    expect(new Set(eatRanks)).toEqual(new Set(['POPULARITY', 'DISTANCE']))
    const share = eatRanks.filter((r) => r === 'POPULARITY').length / eatRanks.length
    expect(share).toBeGreaterThan(0.35)
    expect(share).toBeLessThan(0.65)
    const rest = many(200, (s) => pickLane(CARD_BY_ID.rest, { drink: '酒吧' }, undefined, 'TW', mulberry32(s)))
    expect(rest.every((p) => p.kind === 'text' && p.textQuery === '酒吧')).toBe(true)
    expect(new Set(rest.map((p) => p.rank))).toEqual(new Set(['DISTANCE', 'RELEVANCE']))
  })

  it('細類偏好：拉麵 Beta(30,1) 時，拉麵 lane 的比例遠高於沒有偏好', () => {
    const count = (cuisine?: Record<string, [number, number]>) =>
      many(1000, (s) => pickLane(CARD_BY_ID.eat, {}, cuisine, 'TW', mulberry32(s))).filter((p) => p.lane === 'ramen_restaurant').length
    const liked = count({ ramen: [30, 1], jp: [1, 5], cn: [1, 5], kr: [1, 5], western: [1, 5], other: [1, 5], seafood: [1, 5], veg: [1, 5], fast: [1, 5] })
    expect(liked).toBeGreaterThan(600) // 75% 走偏好，加上 25% 均勻裡也可能抽到
    expect(count()).toBeLessThan(250)
  })

  it('同種子 → 同一條 lane', () => {
    expect(pickLane(CARD_BY_ID.eat, {}, undefined, 'TW', mulberry32(99))).toEqual(pickLane(CARD_BY_ID.eat, {}, undefined, 'TW', mulberry32(99)))
  })
})

describe('widenPlan（第二次呼叫）', () => {
  // 2026-10-26 正式站實測後改：深夜 Nearby 熱門排序撈回的店幾乎全打烊 → 第二次一律 Text Search + openNow。
  it('Nearby 一般 lane：改 Text Search「餐廳」＋ openNow、半徑 ×2.5、依距離；日本用「レストラン」', () => {
    const first: LanePlan = { kind: 'nearby', lane: 'ramen_restaurant', includedTypes: ['ramen_restaurant'], radius: 800, rank: 'POPULARITY' }
    expect(widenPlan(first)).toEqual({ kind: 'text', lane: 'text:open-now', textQuery: '餐廳', radius: 2000, rank: 'DISTANCE', openNow: true })
    expect(widenPlan(first, { country: 'JP' })).toMatchObject({ kind: 'text', textQuery: 'レストラン', openNow: true })
  })
  it('甜食／素食保留自己的 type；400 時一律退回營業中的餐廳 Text Search', () => {
    const veg = pickLane(CARD_BY_ID.eat, { diet: '素' }, undefined, 'TW', mulberry32(1))
    expect((widenPlan(veg) as { includedTypes: string[] }).includedTypes).toEqual(['vegetarian_restaurant', 'vegan_restaurant'])
    expect(widenPlan(veg, { forceRestaurant: true })).toMatchObject({ kind: 'text', textQuery: '餐廳', openNow: true })
    const sweet = pickLane(CARD_BY_ID.eat, { taste: '甜食' }, undefined, 'TW', mulberry32(1))
    expect((widenPlan(sweet) as { includedTypes: string[] }).includedTypes).toEqual(['bakery', 'cafe', 'ice_cream_shop'])
  })
  it('Text Search：同關鍵字、半徑 ×2.5、換 rankPreference、只要營業中', () => {
    expect(widenPlan({ kind: 'text', lane: 'text:咖啡廳', textQuery: '咖啡廳', radius: 800, rank: 'DISTANCE' }))
      .toEqual({ kind: 'text', lane: 'text:咖啡廳', textQuery: '咖啡廳', radius: 2000, rank: 'RELEVANCE', openNow: true })
  })
})
