// 候選池 lane — DEV-PLAN-3 W1.2、R3§1.3。
// Nearby Search 沒有分頁、預設照 POPULARITY 排，同一個 type 永遠回同樣 20 家；
// 輪替「細類 type × rankPreference」才撈得到不同的 20 家，池子擴了，pickPlace 才有得挑。
// 鐵則：只在 verified 的 lane 裡挑。新 type 沒實測過可能讓整次查詢 400（R2 風險），
// 只有 Team Lead／Cross 跑完 `npm run probe:lanes` 回 200 才把 verified 翻成 true。
import { betaSample, cuisineOf, type Rng } from './discovery.ts'
import { WIDEN_FACTOR } from './places.ts'
import type { Country, CuisineStats, ModuleCard } from './types.ts'

export interface Lane {
  id: string
  types: string[]
  /** src/discovery.ts cuisineOf 的細類鍵；細類偏好 Beta 抽樣以它為單位。 */
  group: string
  verified: boolean
  /** 這個 type 何時進 Table A（R3§1.3；新型別的批次是粗標，以 probe-lanes 實測為準）。 */
  since: '2023' | '2024-11' | '2026-02'
  /** 只在這個國家用（例：台式料理在日本撈不到幾家）。 */
  only?: Country
}

const L = (id: string, verified: boolean, since: Lane['since'], extra: Partial<Lane> = {}): Lane =>
  ({ id, types: [id], group: cuisineOf(id), verified, since, ...extra })

export const LANES: Lane[] = [
  // 2023 就在 Table A：已驗證
  L('ramen_restaurant', true, '2023'),
  L('sushi_restaurant', true, '2023'),
  L('japanese_restaurant', true, '2023'),
  L('chinese_restaurant', true, '2023'),
  L('korean_restaurant', true, '2023'),
  L('italian_restaurant', true, '2023'),
  L('thai_restaurant', true, '2023'),
  L('vietnamese_restaurant', true, '2023'),
  L('indian_restaurant', true, '2023'),
  L('american_restaurant', true, '2023'),
  L('pizza_restaurant', true, '2023'),
  L('hamburger_restaurant', true, '2023'),
  L('seafood_restaurant', true, '2023'),
  L('steak_house', true, '2023'),
  L('vegetarian_restaurant', true, '2023'),
  L('vegan_restaurant', true, '2023'),
  L('breakfast_restaurant', true, '2023'),
  L('brunch_restaurant', true, '2023'),
  L('fast_food_restaurant', true, '2023'),
  L('bakery', true, '2023'),
  L('cafe', true, '2023'),
  L('coffee_shop', true, '2023'),
  L('ice_cream_shop', true, '2023'),
  // R3§1.3 標為新增：未實測，pickLane 不挑
  L('taiwanese_restaurant', false, '2026-02', { only: 'TW' }),
  L('noodle_shop', false, '2026-02'),
  L('chinese_noodle_restaurant', false, '2026-02'),
  L('hot_pot_restaurant', false, '2026-02'),
  L('japanese_izakaya_restaurant', false, '2026-02'),
  L('yakiniku_restaurant', false, '2026-02'),
  L('yakitori_restaurant', false, '2026-02'),
  L('tonkatsu_restaurant', false, '2026-02'),
  L('japanese_curry_restaurant', false, '2026-02'),
  L('fine_dining_restaurant', false, '2024-11'),
]

/** 第二次呼叫與 400 退路用的泛用 lane。 */
export const RESTAURANT_LANE: Lane = { id: 'restaurant', types: ['restaurant'], group: 'other', verified: true, since: '2023' }
/** 甜食的退路：沿用 Round 2 的三種 type 一次查（placesTypesFor）。 */
export const SWEET_LANE: Lane = { id: 'sweet', types: ['bakery', 'cafe', 'ice_cream_shop'], group: 'sweet', verified: true, since: '2023' }
/** 吃素：素食＋純素一次查。第二次也不准退回 restaurant（會派到牛排館）。 */
export const VEG_LANE: Lane = { id: 'veg', types: ['vegetarian_restaurant', 'vegan_restaurant'], group: 'veg', verified: true, since: '2023' }

const SWEET_GROUPS = new Set(['sweet', 'cafe'])
const BREAKFAST = new Set(['breakfast_restaurant', 'brunch_restaurant'])
/** 忌口 → 主力就是踩雷的 lane。只排除 lane（撈池子），個別店家的衝突不在這裡判。 */
const DIET_BLOCK: Record<string, Set<string>> = {
  不吃牛: new Set(['steak_house']),
  不辣: new Set(['thai_restaurant', 'indian_restaurant']),
}

export type NearbyRank = 'POPULARITY' | 'DISTANCE'
export type TextRank = 'DISTANCE' | 'RELEVANCE'
export type LanePlan =
  | { kind: 'nearby'; lane: string; includedTypes: string[]; radius: number; rank: NearbyRank }
  | { kind: 'text'; lane: string; textQuery: string; radius: number; rank: TextRank; openNow?: boolean }

/** eat 卡（非甜食、非素）可輪替的 lane。 */
export function mealLanes(choices: Record<string, string | number>, country: Country, hour?: number): Lane[] {
  const block = DIET_BLOCK[String(choices.diet ?? '')]
  return LANES.filter((l) =>
    l.verified
    && !SWEET_GROUPS.has(l.group)
    && (!l.only || l.only === country)
    && !block?.has(l.id)
    && !(hour !== undefined && hour >= 14 && BREAKFAST.has(l.id)),
  )
}

/**
 * 這次第一個 Places 呼叫查什麼。
 * - rest 卡：Text Search（居酒屋、熱炒沒有 type），rankPreference 在 DISTANCE／RELEVANCE 交替。
 * - eat 甜食 → 甜食 lane 組；忌口「素」→ 素食 lane（STRATEGY §2 次要問題：以前素食者會被派去一般餐廳）。
 * - 其餘：75% 依細類偏好 Beta 抽樣挑細類、再在細類內均勻挑 lane；25% 所有 lane 均勻隨機。
 *   rankPreference 在 POPULARITY／DISTANCE 交替。
 * hour = 當地小時（14 點後不排早午餐 lane，省得撈回一堆打烊的店、多花第二次呼叫）。
 */
export function pickLane(
  card: Pick<ModuleCard, 'id' | 'intake' | 'placesQuery'>,
  choices: Record<string, string | number>,
  cuisine: CuisineStats | undefined,
  country: Country,
  rng: Rng,
  hour?: number,
): LanePlan {
  const radius = card.placesQuery?.radiusByTransport?.default ?? 800
  const tq = card.placesQuery?.textQuery
  if (tq) {
    const fallback = card.intake.find((f) => f.key === tq.key)?.default
    const q = tq.byOption[String(choices[tq.key] ?? '')] ?? tq.byOption[String(fallback ?? '')]
    if (q) return { kind: 'text', lane: `text:${q}`, textQuery: q, radius, rank: rng() < 0.5 ? 'DISTANCE' : 'RELEVANCE' }
  }
  const nearbyRank = (): NearbyRank => (rng() < 0.5 ? 'POPULARITY' : 'DISTANCE')
  const plan = (l: Lane): LanePlan => ({ kind: 'nearby', lane: l.id, includedTypes: l.types, radius, rank: nearbyRank() })

  if (card.id !== 'eat') {
    // 目前只有 eat 用 lane；其他需要 Places 的卡照卡片設定的 type。
    return { kind: 'nearby', lane: (card.placesQuery?.includedTypes ?? ['restaurant']).join('|'), includedTypes: card.placesQuery?.includedTypes ?? ['restaurant'], radius, rank: nearbyRank() }
  }
  if (choices.taste === '甜食') {
    const sweet = LANES.filter((l) => l.verified && SWEET_GROUPS.has(l.group))
    const all = [SWEET_LANE, ...sweet]
    return plan(all[Math.floor(rng() * all.length)]!)
  }
  if (choices.diet === '素') return plan(VEG_LANE)

  const lanes = mealLanes(choices, country, hour)
  if (lanes.length === 0) return plan(RESTAURANT_LANE)
  if (rng() < 0.75) {
    // 細類 Thompson：每個細類抽一次 Beta(a,b)，取最大；沒有統計的細類當 (1,1)。
    const groups = [...new Set(lanes.map((l) => l.group))]
    let best = groups[0]!
    let bestV = -1
    for (const g of groups) {
      const [a, b] = cuisine?.[g] ?? [1, 1]
      const v = betaSample(a, b, rng)
      if (v > bestV) { bestV = v; best = g }
    }
    const inGroup = lanes.filter((l) => l.group === best)
    return plan(inGroup[Math.floor(rng() * inGroup.length)]!)
  }
  return plan(lanes[Math.floor(rng() * lanes.length)]!)
}

/**
 * 第二次呼叫（有效候選 < 5，或第一次失敗）：半徑 ×2.5、換另一種 rankPreference。
 * - Text Search：同一個關鍵字。
 * - Nearby 一般 lane：改 Text Search「餐廳／レストラン／restaurant」＋ openNow、依距離（深夜也查得到營業中的店）。
 *   甜食／素食保留自己的 type（不然會派甜食的人去吃牛排）。
 * - forceRestaurant：第一次回 400（lane 的 type 不被接受）→ 一律退回營業中的餐廳 Text Search。
 */
export function widenPlan(first: LanePlan, opts: { forceRestaurant?: boolean; country?: Country } = {}): LanePlan {
  const radius = Math.round(first.radius * WIDEN_FACTOR)
  // 正式站實測（2026-10-26 深夜，東京站／台北市府）：Nearby 照熱門排序撈回的 20 家幾乎全打烊 → no_places。
  // 第二次一律要求「現在營業中」（Text Search 才有 openNow；Nearby 沒有）。
  if (first.kind === 'text') {
    return { ...first, radius, rank: first.rank === 'DISTANCE' ? 'RELEVANCE' : 'DISTANCE', openNow: true }
  }
  const rank: NearbyRank = first.rank === 'POPULARITY' ? 'DISTANCE' : 'POPULARITY'
  const sweet = first.lane === SWEET_LANE.id || LANES.some((l) => l.id === first.lane && SWEET_GROUPS.has(l.group))
  const veg = first.lane === VEG_LANE.id
  const keep = !opts.forceRestaurant && (sweet || veg)
  if (keep) {
    const lane = sweet ? SWEET_LANE : VEG_LANE
    return { kind: 'nearby', lane: lane.id, includedTypes: lane.types, radius, rank }
  }
  // 一般餐廳的廣域後備：Text Search「餐廳／レストラン」＋ openNow，依距離。
  return { kind: 'text', lane: 'text:open-now', textQuery: opts.country === 'JP' ? 'レストラン' : opts.country === 'other' ? 'restaurant' : '餐廳', radius, rank: 'DISTANCE', openNow: true }
}
