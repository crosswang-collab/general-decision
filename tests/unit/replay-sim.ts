// 離線重播的合成池與模擬器（DEV-PLAN-3 附錄 1）。不是測試檔（vitest 只收 *.test.ts），由 discovery-replay.test.ts 使用；
// 調參時也可以直接用 node 匯入（PARAMS 是可改的物件）。不用任何 Google 真實資料（R4）。
import { bayes, mulberry32, gauss, pickPlace, type Rng } from '../../src/discovery.ts'
import { bandOf } from '../../src/price.ts'
import { brandKeyOf, clusterKeys } from '../../src/chains.ts'
import type { Band, CuisineStats, Novelty, PlaceCandidate, PlaceMemSummary } from '../../src/types.ts'

const DAY = 86_400_000
export const SEEDS = 200
const START = Date.parse('2026-09-07T12:00:00+08:00')

const GROUPS: [string, number, string][] = [
  ['tw', 0.25, 'taiwanese_restaurant'], ['noodle', 0.15, 'noodle_shop'], ['jp', 0.12, 'japanese_restaurant'],
  ['cn', 0.1, 'chinese_restaurant'], ['ramen', 0.08, 'ramen_restaurant'], ['western', 0.08, 'italian_restaurant'],
  ['kr', 0.06, 'korean_restaurant'], ['hotpot', 0.06, 'hot_pot_restaurant'], ['cafe', 0.05, 'cafe'], ['fast', 0.05, 'fast_food_restaurant'],
]
const BRAND_NAMES = ['八方雲集', '摩斯漢堡', '鼎泰豐', '吉野家', '薩莉亞', '麥當勞', '肯德基', '路易莎']
const BRANCHES = ['南京', '復興', '信義', '民生', '松江', '中山', '大安', '忠孝']
const PRICE: Record<Band, { start: number; end: number }> = { 1: { start: 80, end: 150 }, 2: { start: 200, end: 400 }, 3: { start: 400, end: 1000 }, 4: { start: 1000, end: 2000 } }

function weighted<T>(rng: Rng, items: [T, number][]): T {
  let u = rng()
  for (const [v, w] of items) { if ((u -= w) < 0) return v }
  return items.at(-1)![0]
}

/** 附錄 1：40 家合成店。 */
export function makePool(seed: number): PlaceCandidate[] {
  const rng = mulberry32(seed * 7919 + 17)
  const out: PlaceCandidate[] = []
  // 30% 掛品牌：同品牌 2–3 家
  const chainSlots: string[] = []
  const brands = [...BRAND_NAMES].sort(() => rng() - 0.5)
  for (const b of brands) {
    if (chainSlots.length >= 12) break
    const n = Math.min(12 - chainSlots.length, rng() < 0.5 ? 2 : 3)
    for (let k = 0; k < n; k++) chainSlots.push(b)
  }
  for (let i = 0; i < 40; i++) {
    const rating = Math.min(4.9, Math.max(3.0, Math.round((4.1 + 0.35 * gauss(rng)) * 10) / 10))
    const ratingCount = Math.min(3000, Math.max(3, Math.round(Math.exp(Math.log(120) + 1.0 * gauss(rng)))))
    const walkMin = 1 + Math.floor(rng() * 15)
    const [, , primaryType] = weighted(rng, GROUPS.map((g) => [g, g[1]] as [typeof g, number]))
    const brand = i < chainSlots.length ? chainSlots[i] : undefined
    const name = brand ? `${brand} ${BRANCHES[i % BRANCHES.length]}店` : `在地${seed}之${i}號小館`
    const c: PlaceCandidate = { id: `s${seed}-${i}`, name, walkMin, openUntil: '21:00', primaryType, rating, ratingCount }
    if (rng() < 0.55) {
      const band = weighted<Band>(rng, [[1, 0.3], [2, 0.45], [3, 0.2], [4, 0.05]])
      c.priceRange = { ...PRICE[band], currency: 'TWD' }
    }
    out.push(c)
  }
  return out
}

interface SimMem { id: string; sh: number[]; dn: number[]; x?: number | 'forever'; b?: string }

interface SimOut {
  picks: { id: string; t: number; mode: string; exhausted: boolean }[]
  pool: PlaceCandidate[]
  dislikedHit: number
}

export function simulate(seed: number, novelty: Novelty, budget?: Band[]): SimOut {
  const pool = makePool(seed)
  const clusters = clusterKeys(pool)
  const user = mulberry32(seed * 31 + 7)
  const mem = new Map<string, SimMem>()
  const cuisine: CuisineStats = {}
  const disliked = new Set<string>()
  const picks: SimOut['picks'] = []
  let dislikedHit = 0
  let step = 0
  for (let day = 0; day < 14; day++) {
    for (const hour of [0, 7]) {
      const now = START + day * DAY + hour * 3600_000
      const summary: PlaceMemSummary[] = [...mem.values()].map((m) => ({ id: m.id, sh: m.sh.slice(0, 5), dn: m.dn.slice(0, 5), ...(m.x ? { x: m.x } : {}), ...(m.b ? { b: m.b } : {}) }))
      const r = pickPlace(pool, summary, cuisine, {
        now, country: 'TW', budget, novelty, exclude: new Set(), rejectedCuisines: new Set(), clusters, rng: mulberry32(seed * 100_003 + step++),
      })
      if (!r) continue
      const p = r.place
      if (disliked.has(p.id)) dislikedHit++
      picks.push({ id: p.id, t: now, mode: r.mode, exhausted: r.exhausted })
      const m = mem.get(p.id) ?? { id: p.id, sh: [], dn: [], b: brandKeyOf(p.name) }
      m.sh.unshift(now)
      m.sh.length = Math.min(m.sh.length, 10)
      const u = user()
      const g = r.cuisine
      if (u < 0.85 || (u >= 0.95 && day < 3)) {
        m.dn.unshift(now)
        m.dn.length = Math.min(m.dn.length, 10)
        const [a, b] = cuisine[g] ?? [1, 1]
        cuisine[g] = [a + 1, b]
      } else if (u < 0.95) {
        m.x = now + DAY // 店關了
      } else {
        m.x = now + 90 * DAY // 不要再來（90 天；重播只有 14 天，第二次 forever 由 W2 placeMem 測）
        disliked.add(p.id)
      }
      mem.set(p.id, m)
    }
  }
  return { picks, pool, dislikedHit }
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s[(s.length - 1) >> 1]! + s[s.length >> 1]!) / 2 : 0 }
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
const r3 = (x: number) => Math.round(x * 1000) / 1000

export function metrics(novelty: Novelty) {
  let total = 0
  let repeats = 0
  let top3 = 0
  let below = 0
  let chainPicks = 0
  let reconChainWhenFresh = 0
  let dislikedHit = 0
  let revisits = 0
  const distinct: number[] = []
  const drops: number[] = []
  const poolChain: number[] = []
  for (let seed = 1; seed <= SEEDS; seed++) {
    const { picks, pool, dislikedHit: dh } = simulate(seed, novelty)
    dislikedHit += dh
    const byId = new Map(pool.map((c) => [c.id, c]))
    const clusters = clusterKeys(pool)
    const ranked = [...pool].sort((a, b) => bayes(b) - bayes(a))
    const top3ids = new Set(ranked.slice(0, 3).map((c) => c.id))
    const top8avg = mean(ranked.slice(0, 8).map(bayes))
    poolChain.push(pool.filter((c) => clusters.has(c.id)).length / pool.length)
    const freshNonChain = new Set(pool.filter((c) => !clusters.has(c.id)).map((c) => c.id))
    picks.forEach((p, i) => {
      total++
      const c = byId.get(p.id)!
      if (picks.slice(0, i).some((q) => q.id === p.id && p.t - q.t < 7 * DAY)) repeats++
      if (top3ids.has(p.id)) top3++
      if (bayes(c) < 3.7 || (c.ratingCount ?? 0) < 5) below++
      if (clusters.has(p.id)) { chainPicks++; if (novelty === 'recon' && !p.exhausted && freshNonChain.size >= 3) reconChainWhenFresh++ }
      if (p.mode === 'revisit') revisits++
    })
    let minDistinct = Infinity
    for (let i = 0; i + 12 <= picks.length; i++) minDistinct = Math.min(minDistinct, new Set(picks.slice(i, i + 12).map((p) => p.id)).size)
    distinct.push(minDistinct)
    drops.push(top8avg - mean(picks.map((p) => bayes(byId.get(p.id)!))))
  }
  // 預算：budget [1] 另跑一輪
  let bTotal = 0
  let bHit = 0
  for (let seed = 1; seed <= SEEDS; seed++) {
    const { picks, pool } = simulate(seed, novelty, [1])
    const byId = new Map(pool.map((c) => [c.id, c]))
    for (const p of picks) {
      bTotal++
      const band = bandOf(byId.get(p.id)!, 'TW')
      if (band === null || band === 1) bHit++
    }
  }
  return {
    picks: total,
    repeat7d: r3(repeats / total),
    distinct12: median(distinct),
    top3Share: r3(top3 / total),
    bayesDrop: r3(mean(drops)),
    chainShare: r3(chainPicks / total / mean(poolChain)),
    reconChainWhenFresh,
    belowFloor: below,
    budgetHit: r3(bHit / bTotal),
    dislikedHit,
    familiarRevisit: r3(revisits / total),
  }
}

