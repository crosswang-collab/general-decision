// B13：PlaceMem 五種事件與愛店對記憶的影響逐一斷言；memSummary 不含店名／評分／座標。
// idb-keyval 換成記憶體 Map（沿用 repo 不依賴真 IndexedDB 的做法；jsdom 沒有 indexedDB）。
import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
  get: async (k: string) => structuredClone(store.get(k)),
  set: async (k: string, v: unknown) => { store.set(k, structuredClone(v)) },
  del: async (k: string) => { store.delete(k) },
}))

const {
  CLOSED_MS, KEEP_EVENTS, NEVER_AGAIN_MS, MAX_ENTRIES,
  allMem, clearPlaceMem, cuisineStats, discoveryStats, getMem, markClosed, markDone, markNeverAgain,
  markNotThisKind, markShown, memSummary, setFav,
} = await import('../../src/placeMem.ts')

const DAY = 24 * 3600 * 1000
const T0 = new Date('2026-10-21T12:00:00+08:00').getTime()
const meta = { module: 'eat' as const }

beforeEach(async () => { store.clear() })

describe('shown：拿到口令的當下就記', () => {
  it('記時間戳、品牌鍵、細類；新的在前；最多 10 筆', async () => {
    await markShown('p1', { module: 'eat', brand: 'mos', cuisine: 'fast' }, T0)
    const e = (await getMem('p1'))!
    expect(e).toMatchObject({ id: 'p1', module: 'eat', shown: [T0], done: [], dislikes: 0, brand: 'mos', cuisine: 'fast' })
    for (let i = 1; i <= KEEP_EVENTS + 3; i++) await markShown('p1', meta, T0 + i)
    const after = (await getMem('p1'))!
    expect(after.shown).toHaveLength(KEEP_EVENTS)
    expect(after.shown[0]).toBe(T0 + KEEP_EVENTS + 3)
    expect(after.brand).toBe('mos') // 後來沒帶 brand 不會把它洗掉
  })

  it('同一毫秒重複呼叫只記一筆（冪等）', async () => {
    await markShown('p1', meta, T0)
    await markShown('p1', meta, T0)
    expect((await getMem('p1'))!.shown).toEqual([T0])
  })

  it('連點也不會互相覆蓋（讀改寫串行化）', async () => {
    await Promise.all(Array.from({ length: 8 }, (_, i) => markShown(`p${i}`, meta, T0 + i)))
    expect(await allMem()).toHaveLength(8)
  })
})

describe('done：去過', () => {
  it('記 done，細類 a += 1，b 不動', async () => {
    await markShown('p1', { module: 'eat', cuisine: 'ramen' }, T0)
    await markDone('p1', 'ramen', T0 + 1000)
    await markDone('p2', 'ramen', T0 + 2000)
    expect((await getMem('p1'))!.done).toEqual([T0 + 1000])
    expect((await cuisineStats()).ramen).toEqual([3, 1])
  })
  it('沒有細類就只記 done', async () => {
    await markDone('p1', undefined, T0)
    expect(await cuisineStats()).toEqual({})
    expect((await getMem('p1'))!.done).toEqual([T0])
  })
})

describe('closed：店關了', () => {
  it('24 小時內不再出現；不動細類；不增加不要再來次數', async () => {
    await markShown('p1', { module: 'eat', cuisine: 'tw' }, T0)
    await markClosed('p1', T0)
    const e = (await getMem('p1'))!
    expect(e.dislikeUntil).toBe(T0 + CLOSED_MS)
    expect(e.dislikes).toBe(0)
    expect(await cuisineStats()).toEqual({})
  })
  it('不會把已經更長（90 天／永久）的封鎖縮短', async () => {
    await markNeverAgain('p1', T0)
    await markClosed('p1', T0 + 1000)
    expect((await getMem('p1'))!.dislikeUntil).toBe(T0 + NEVER_AGAIN_MS)
    await markNeverAgain('p1', T0)
    await markClosed('p1', T0 + 2000)
    expect((await getMem('p1'))!.dislikeUntil).toBe('forever')
  })
})

describe('not_this_kind：今天不想吃這類', () => {
  it('細類 b += 0.5；不動任何一家店', async () => {
    await markShown('p1', { module: 'eat', cuisine: 'tw' }, T0)
    await markNotThisKind('tw')
    await markNotThisKind('tw')
    expect((await cuisineStats()).tw).toEqual([1, 2])
    expect((await getMem('p1'))!.dislikeUntil).toBeUndefined()
  })
  it('沒有細類就什麼都不做', async () => {
    await markNotThisKind(undefined)
    expect(await cuisineStats()).toEqual({})
  })
})

describe('never_again：這家不要再來', () => {
  it('第 1 次 90 天；第 2 次永久', async () => {
    await markNeverAgain('p1', T0)
    expect(await getMem('p1')).toMatchObject({ dislikes: 1, dislikeUntil: T0 + 90 * DAY })
    await markNeverAgain('p1', T0 + DAY)
    expect(await getMem('p1')).toMatchObject({ dislikes: 2, dislikeUntil: 'forever' })
    await markNeverAgain('p1', T0 + 2 * DAY)
    expect((await getMem('p1'))!.dislikeUntil).toBe('forever')
  })
})

describe('fav：愛店', () => {
  it('列入、取消', async () => {
    await markShown('p1', meta, T0)
    await setFav('p1', true)
    expect((await getMem('p1'))!.fav).toBe(true)
    await setFav('p1', false)
    expect((await getMem('p1'))!.fav).toBeUndefined()
  })
})

describe('skip（沒做）不呼叫任何函式 → PlaceMem 不變', () => {
  it('只有 shown 的店：沒有 done、沒有封鎖、細類沒動', async () => {
    await markShown('p1', { module: 'eat', cuisine: 'tw' }, T0)
    const e = (await getMem('p1'))!
    expect(e.done).toEqual([])
    expect(e.dislikeUntil).toBeUndefined()
    expect(await cuisineStats()).toEqual({})
  })
})

describe('memSummary：送給伺服器的摘要', () => {
  it('只有 id／sh／dn／x／fav／b；序列化後沒有 name／rating／lat／lng', async () => {
    await markShown('p1', { module: 'eat', brand: 'mos', cuisine: 'fast' }, T0)
    await markDone('p1', 'fast', T0 + 1)
    await markNeverAgain('p1', T0 + 2)
    await setFav('p1', true)
    const s = await memSummary('eat', T0 + 3)
    expect(s).toEqual([{ id: 'p1', sh: [T0], dn: [T0 + 1], x: T0 + 2 + NEVER_AGAIN_MS, fav: true, b: 'mos' }])
    const json = JSON.stringify(s)
    expect(json).not.toMatch(/"(name|rating|lat|lng|priceLevel|priceRange)"/)
    expect(json).not.toMatch(/cuisine/) // 細類另外走 request.cuisine，不混在店的摘要裡
  })

  it('sh／dn 各最多 5 筆，新的在前', async () => {
    for (let i = 0; i < 9; i++) { await markShown('p1', meta, T0 + i); await markDone('p1', undefined, T0 + i) }
    const [row] = await memSummary('eat', T0 + 100)
    expect(row!.sh).toEqual([T0 + 8, T0 + 7, T0 + 6, T0 + 5, T0 + 4])
    expect(row!.dn).toHaveLength(5)
  })

  it('依最近事件排序、最多 limit 筆、只回該 module；過期封鎖不送', async () => {
    await markShown('old', meta, T0)
    await markShown('mid', meta, T0 + 10)
    await markShown('new', meta, T0 + 20)
    await markShown('cafe', { module: 'rest' }, T0 + 30)
    expect((await memSummary('eat', T0 + 50)).map((r) => r.id)).toEqual(['new', 'mid', 'old'])
    expect((await memSummary('eat', T0 + 50, 2)).map((r) => r.id)).toEqual(['new', 'mid'])
    expect((await memSummary('rest', T0 + 50)).map((r) => r.id)).toEqual(['cafe'])

    await markClosed('old', T0)
    expect((await memSummary('eat', T0 + 1000)).find((r) => r.id === 'old')!.x).toBe(T0 + CLOSED_MS)
    expect((await memSummary('eat', T0 + 2 * DAY)).find((r) => r.id === 'old')!.x).toBeUndefined()
  })
})

describe('discoveryStats：本週新占領／回防', () => {
  const weekStart = new Date('2026-10-19T00:00:00+08:00').toISOString() // 週一
  it('本週第一次去 = 新占領；本週前就去過、或本週再去 = 回防', async () => {
    await markDone('a', undefined, new Date('2026-10-20T12:00:00+08:00').getTime()) // 新
    await markDone('b', undefined, new Date('2026-10-12T12:00:00+08:00').getTime()) // 上週去過
    await markDone('b', undefined, new Date('2026-10-20T19:00:00+08:00').getTime()) // 本週回防
    await markDone('c', undefined, new Date('2026-10-20T12:00:00+08:00').getTime()) // 新
    await markDone('c', undefined, new Date('2026-10-21T12:00:00+08:00').getTime()) // 同店本週第二次 → 回防
    await markDone('d', undefined, new Date('2026-10-05T12:00:00+08:00').getTime()) // 更早，不算本週
    expect(await discoveryStats(weekStart, new Date('2026-10-22T12:00:00+08:00').getTime())).toEqual({ newPlaces: 2, revisits: 2 })
  })
  it('空的就是 0／0', async () => {
    expect(await discoveryStats(weekStart, T0)).toEqual({ newPlaces: 0, revisits: 0 })
  })
})

describe('容量', () => {
  it(`超過 ${MAX_ENTRIES} 家時清最舊的，但愛店與封鎖中的不清`, async () => {
    await markShown('keep-fav', meta, T0)
    await setFav('keep-fav', true)
    await markShown('keep-blocked', meta, T0 + 1)
    await markNeverAgain('keep-blocked', T0 + 1)
    for (let i = 0; i < MAX_ENTRIES + 20; i++) await markShown(`x${i}`, meta, T0 + 10 + i)
    const ids = new Set((await allMem()).map((e) => e.id))
    expect(ids.size).toBeLessThanOrEqual(MAX_ENTRIES)
    expect(ids.has('keep-fav')).toBe(true)
    expect(ids.has('keep-blocked')).toBe(true)
    expect(ids.has('x0')).toBe(false)
  })

  it('clearPlaceMem 清乾淨', async () => {
    await markDone('p1', 'tw', T0)
    await clearPlaceMem()
    expect(await allMem()).toEqual([])
    expect(await cuisineStats()).toEqual({})
  })
})
