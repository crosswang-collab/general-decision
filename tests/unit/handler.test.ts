// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api/order.ts'
import { findBanned } from '../../src/banned.ts'
import { CARD_BY_ID } from '../../src/cards.ts'
import { clusterKeys } from '../../src/chains.ts'
import { mulberry32, pickPlace } from '../../src/discovery.ts'
import { pickLane } from '../../src/lanes.ts'
import { toCandidates, type RawPlace } from '../../src/places.ts'
import { hourIn } from '../../src/tz.ts'
import type { Order, OrderDebug, OrderRequest, PlaceMemSummary } from '../../src/types.ts'

// Vercel 走的入口是 default.fetch（函式型 default 會被當成舊式 (req,res)），測試走同一條。
const handler = api.fetch

const ORDER_JSON = JSON.stringify({
  verdict: 'do',
  meme: { top: '去吃熱的', big: '阿財魯肉飯', bot: '這週兩天超商了' },
  steps: ['步行 6 分鐘。', '魯肉飯、滷蛋。', '12 分鐘吃完。'],
  place: { id: 'p1', name: '阿財魯肉飯' },
  log: '12:41 魯肉飯，12:58 完成。',
})

const claudeOk = (text: string) =>
  new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { status: 200 })

const placesOk = () =>
  new Response(
    JSON.stringify({
      places: [{
        id: 'p1', displayName: { text: '阿財魯肉飯' },
        location: { latitude: 25.0335, longitude: 121.5658 },
        currentOpeningHours: { openNow: true },
      }],
    }),
    { status: 200 },
  )

const post = (body: Partial<OrderRequest>) =>
  new Request('http://localhost/api/order', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      // 2026-09-18 起 eat 沒定位是 400（見下），所以預設帶定位；要測沒定位就傳 loc: undefined。
      module: 'eat', level: 1, choices: { diet: '都可以' }, loc: { lat: 25.033, lng: 121.5654 },
      now: '2026-09-11T12:40:00+08:00', recentOrders: [], ...body,
    }),
  })

const routed = (claude: () => Response, places: () => Response = placesOk) =>
  vi.fn(async (url: string | URL | Request) => {
    const u = String(typeof url === 'object' && 'url' in url ? url.url : url)
    return u.includes('anthropic') ? claude() : places()
  })

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key'
  process.env.GOOGLE_PLACES_KEY = 'test-places-key'
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('/api/order handler（第 12 節 S5）', () => {
  it('正常路徑：回 200 + 合法 Order JSON', async () => {
    vi.stubGlobal('fetch', routed(() => claudeOk(ORDER_JSON)))
    const res = await handler(post({ loc: { lat: 25.033, lng: 121.5654 } }))
    expect(res.status).toBe(200)
    const order = (await res.json()) as Order
    expect(order.verdict).toBe('do')
    expect(order.meme.big).toBe('阿財魯肉飯')
    expect(order.steps.length).toBeGreaterThan(0)
    // Round 3：這個 mock 只有 1 家店，< 5 家有效候選 → 第二次（restaurant、半徑 2000）。足量池子只打 1 次的情形見下方 B1／B5。
    expect(res.headers.get('x-places-calls')).toBe('2')
  })

  it('Claude 回 fenced JSON 也能吃', async () => {
    vi.stubGlobal('fetch', routed(() => claudeOk('```json\n' + ORDER_JSON + '\n```')))
    const res = await handler(post({ loc: { lat: 25.033, lng: 121.5654 } }))
    expect(res.status).toBe(200)
  })

  it('Claude 回非法 JSON → 502 + 班長口吻訊息（第 11 節）', async () => {
    vi.stubGlobal('fetch', routed(() => claudeOk('班長今天請假。')))
    const res = await handler(post({}))
    expect(res.status).toBe(502)
    expect((await res.json()).message).toContain('班長在開會')
  })

  it('Claude 429 → 重試後回 429', async () => {
    const claude = vi.fn(() => new Response('rate limited', { status: 429 }))
    vi.stubGlobal('fetch', routed(claude))
    const res = await handler(post({}))
    expect(res.status).toBe(429)
    expect(claude).toHaveBeenCalledTimes(3) // 首次 + 兩次重試
  }, 15_000)

  // 2026-09-18 斷言改了（Cross：只講類別一律視為失敗）。以下兩條原本是「降級仍出口令」，現在是明確的失敗碼。
  it('Places 掛掉 → 兩個半徑都試過後回 502 no_places，不打 Claude', async () => {
    const claude = vi.fn(() => claudeOk(ORDER_JSON))
    vi.stubGlobal('fetch', routed(claude, () => new Response('boom', { status: 500 })))
    const res = await handler(post({}))
    expect(res.status).toBe(502)
    expect((await res.json()).error).toBe('no_places')
    expect(claude).not.toHaveBeenCalled()
  }, 15_000)

  it('沒有定位 → 400 no_location，不打 Places 也不打 Claude（吃／歇一定要真店）', async () => {
    const f = routed(() => claudeOk(ORDER_JSON))
    vi.stubGlobal('fetch', f)
    const res = await handler(post({ loc: undefined }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('no_location')
    expect(f).not.toHaveBeenCalled()
  })

  it('lane 有效候選 < 5 → 第二次 restaurant＋半徑 2000，第二次有就用', async () => {
    const bodies: string[] = []
    const places = vi.fn((init?: RequestInit) => {
      bodies.push(String(init?.body ?? ''))
      return bodies.length === 1
        ? new Response(JSON.stringify({ places: [] }), { status: 200 })
        : placesOk()
    })
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
      String(url).includes('anthropic') ? claudeOk(ORDER_JSON) : places(init)))
    const res = await handler(post({}))
    expect(res.status).toBe(200)
    expect(res.headers.get('x-places-calls')).toBe('2')
    expect(JSON.parse(bodies[0]!).locationRestriction.circle.radius).toBe(800)
    expect(JSON.parse(bodies[1]!).locationRestriction.circle.radius).toBe(2000)
    expect(JSON.parse(bodies[1]!).includedTypes).toEqual(['restaurant'])
    expect(JSON.parse(bodies[1]!).rankPreference).not.toBe(JSON.parse(bodies[0]!).rankPreference)
  })

  it('模型只講類別 → 不重打，place 被 pickPlace 的結果覆寫，dbg.forced 有值', async () => {
    const category = JSON.stringify({
      verdict: 'do', meme: { top: '去吃', big: '附近的小吃店', bot: 'x' }, steps: ['找一家小吃店。'], log: 'x',
    })
    const claude = vi.fn(() => claudeOk(category))
    vi.stubGlobal('fetch', routed(claude))
    const res = await handler(post({}))
    expect(res.status).toBe(200)
    expect(claude).toHaveBeenCalledTimes(1)
    const order = (await res.json()) as Order & { debug: OrderDebug }
    expect(order.meme.big).toBe('阿財魯肉飯')
    expect(order.place?.id).toBe('p1')
    expect(order.place?.mapUrl).toContain('query_place_id=p1')
    expect(order.debug.forced).toBe('阿財魯肉飯')
  })

  it('模型第一次推掉不答（nonanswer）→ 重打一次，用第二次的', async () => {
    let n = 0
    const claude = vi.fn(() => claudeOk(n++ === 0
      ? JSON.stringify({ verdict: 'stop', meme: { top: 'a', big: '大事不受理', bot: '去找連長' }, steps: ['去找連長。'], log: 'x' })
      : ORDER_JSON))
    vi.stubGlobal('fetch', routed(claude))
    const res = await handler(post({}))
    expect(claude).toHaveBeenCalledTimes(2)
    const body = (await res.json()) as Order & { debug: OrderDebug }
    expect(body.place?.id).toBe('p1')
    expect(body.debug.retry).toBe('nonanswer')
  })

  // 除錯畫面（長按班長名牌）的資料來源：Vercel log 保存期太短，這份跟著回應送到手機上。
  it('成功時回應帶 debug：查了幾圈、候選與評分、挑中誰、各段幾毫秒', async () => {
    vi.stubGlobal('fetch', routed(() => claudeOk(ORDER_JSON)))
    const res = await handler(post({}))
    const body = (await res.json()) as Order & { debug: OrderDebug }
    expect(body.debug.module).toBe('eat')
    expect(body.debug.model).toBe('claude-haiku-4-5')
    expect(body.debug.places?.how).toMatch(/^lane=\S+ rank=(POPULARITY|DISTANCE) → lane=restaurant rank=(POPULARITY|DISTANCE)$/)
    expect(body.debug.places?.tries).toEqual([{ r: 800, raw: 1, kept: 1 }, { r: 2000, raw: 1, kept: 1 }])
    expect(body.debug.places?.candidates[0]).toMatchObject({ name: '阿財魯肉飯' })
    expect(body.debug.picked).toBe('阿財魯肉飯')
    expect(body.debug.ms?.total).toBeGreaterThanOrEqual(0)
    expect(body.debug.retry).toBeUndefined()
  })

  it('失敗時回應也帶 debug：no_places 看得到兩圈半徑各查到什麼', async () => {
    vi.stubGlobal('fetch', routed(() => claudeOk(ORDER_JSON), () => new Response('boom', { status: 500 })))
    const res = await handler(post({}))
    const body = (await res.json()) as { error: string; debug: OrderDebug }
    expect(body.debug.error).toBe('no_places')
    expect(body.debug.places?.tries).toEqual([{ r: 800, raw: -1, kept: 0 }, { r: 2000, raw: -1, kept: 0 }])
  }, 15_000)

  it('模型寫別家店 → 不重打（retry 只給 nonanswer），forced 記下來', async () => {
    const other = JSON.stringify({
      verdict: 'do', meme: { top: 'a', big: '隔壁牛肉麵', bot: 'c' }, steps: ['去。'], place: { id: 'zzz', name: '隔壁牛肉麵' }, log: 'x',
    })
    vi.stubGlobal('fetch', routed(() => claudeOk(other)))
    const res = await handler(post({}))
    const body = (await res.json()) as Order & { debug: OrderDebug }
    expect(body.debug.retry).toBeUndefined()
    expect(body.debug.forced).toBe('阿財魯肉飯')
    expect(body.place?.id).toBe('p1')
    expect(body.meme.big).toBe('阿財魯肉飯')
  })

  it('不需要 Places 的模組不打 Places', async () => {
    const f = routed(() => claudeOk(ORDER_JSON))
    vi.stubGlobal('fetch', f)
    await handler(post({ module: 'sleep', choices: { wake: '07:30' }, loc: { lat: 25, lng: 121 } }))
    for (const call of f.mock.calls) expect(String(call[0])).not.toContain('googleapis')
  })

  it('attend 的硬規則在伺服器端被強制執行', async () => {
    // Claude 故意回錯（★2 飯局卻說 do）
    vi.stubGlobal('fetch', routed(() => claudeOk(JSON.stringify({
      verdict: 'do', meme: { top: 'a', big: '去！', bot: 'c' }, steps: ['去。'], log: 'x',
    }))))
    const res = await handler(post({ module: 'attend', choices: { occasion: '飯局', stars: 2 } }))
    expect(((await res.json()) as Order).verdict).toBe('stop')
  })

  it('GET → 405；壞 JSON → 400；未知模組 → 400', async () => {
    expect((await handler(new Request('http://localhost/api/order'))).status).toBe(405)
    expect((await handler(new Request('http://localhost/api/order', {
      method: 'POST', body: 'not json',
    }))).status).toBe(400)
    expect((await handler(post({ module: 'nope' as never }))).status).toBe(400)
  })

  it('沒設 ANTHROPIC_API_KEY → 502，不會洩漏 key 內容', async () => {
    delete process.env.ANTHROPIC_API_KEY
    vi.stubGlobal('fetch', routed(() => claudeOk(ORDER_JSON)))
    const res = await handler(post({}))
    expect(res.status).toBe(502)
    expect(JSON.stringify(await res.json())).not.toContain('ANTHROPIC_API_KEY')
  })
})

// ── Round 3（DEV-PLAN-3 W1）：發掘引擎接上 handler ─────────────────────────
// 合成 40 家池（不是 Google 真實資料）。Places mock 依 request body 的 lane／rank 回不同的 20 家，模擬 lane 輪替。
const POOL: RawPlace[] = Array.from({ length: 40 }, (_, i) => ({
  id: `g${i}`,
  displayName: { text: i % 10 === 0 ? `八方雲集 ${['南京', '復興', '信義', '民生'][i / 10]}店` : `測試小館第${i}號` },
  location: { latitude: 25.033 + (i % 7) * 0.0008, longitude: 121.5654 + (i % 5) * 0.0008 },
  currentOpeningHours: { openNow: true },
  primaryType: ['ramen_restaurant', 'japanese_restaurant', 'chinese_restaurant', 'korean_restaurant'][i % 4],
  rating: 3.9 + (i % 9) * 0.1,
  userRatingCount: 30 + i * 7,
  ...(i % 3 === 0 ? { priceRange: { startPrice: { currencyCode: 'TWD', units: String(80 + (i % 4) * 150) }, endPrice: { currencyCode: 'TWD', units: String(200 + (i % 4) * 300) } } } : {}),
}))

const hash = (s: string) => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h }
const poolPlaces = (init?: RequestInit) => {
  const off = hash(String(init?.body ?? '')) % 40
  const places = Array.from({ length: 20 }, (_, k) => POOL[(off + k) % 40]!)
  return new Response(JSON.stringify({ places }), { status: 200 })
}
const poolFetch = (claude: () => Response = () => claudeOk(ORDER_JSON), places = poolPlaces) =>
  vi.fn(async (url: string | URL | Request, init?: RequestInit) => (String(url).includes('anthropic') ? claude() : places(init)))

type Body = Order & { debug: OrderDebug }

describe('Round 3：同座標連按（B1）', () => {
  beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}) })

  async function tenTimes(novelty: 'balanced' | 'recon') {
    const f = poolFetch()
    vi.stubGlobal('fetch', f)
    const mem: PlaceMemSummary[] = []
    const out: Body[] = []
    for (let i = 0; i < 10; i++) {
      const now = new Date(Date.parse('2026-09-11T12:00:00+08:00') + i * 3600_000)
      const res = await handler(post({ now: now.toISOString(), mem, novelty, seed: 4242 + i }))
      expect(res.status).toBe(200)
      expect(Number(res.headers.get('x-places-calls'))).toBeLessThanOrEqual(2)
      const body = (await res.json()) as Body
      out.push(body)
      const id = body.place!.id
      const m = mem.find((x) => x.id === id)
      if (m) m.sh.unshift(now.getTime())
      else mem.unshift({ id, sh: [now.getTime()], dn: [], ...(body.place!.brand ? { b: body.place!.brand } : {}) })
    }
    return out
  }

  it('balanced：前 5 次 place.id 互不相同；10 次都是伺服器決定的真店', async () => {
    const out = await tenTimes('balanced')
    const ids = out.map((o) => o.place!.id)
    expect(new Set(ids.slice(0, 5)).size).toBe(5)
    for (const o of out) expect(POOL.some((p) => p.id === o.place!.id)).toBe(true)
  })

  it('recon：10 次互不相同，或池子耗盡時帶 exhausted:true', async () => {
    const out = await tenTimes('recon')
    const ids = out.map((o) => o.place!.id)
    const distinct = new Set(ids).size === 10
    expect(distinct || out.some((o) => o.place!.exhausted === true)).toBe(true)
    for (const o of out.filter((x) => !x.place!.exhausted)) expect(o.place!.mode).toBe('wildcard')
  })
})

describe('Round 3：店由程式決定（B5、T2）', () => {
  beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}) })

  it('模型回別家店／類別／亂寫 id：最終 place.id 100% 等於 pickPlace 的輸出（同種子重算）', async () => {
    const answers = [
      { place: { id: 'g1', name: '測試小館第1號' }, big: '測試小館第1號' },
      { place: { id: 'nope', name: '不存在的店' }, big: '不存在的店' },
      { big: '附近的拉麵店' },
    ]
    const fixed: RawPlace[] = POOL.slice(0, 20)
    const places = () => new Response(JSON.stringify({ places: fixed }), { status: 200 })
    for (let seed = 1; seed <= 30; seed++) {
      const a = answers[seed % answers.length]!
      const reply = JSON.stringify({ verdict: 'do', meme: { top: 't', big: a.big, bot: 'b' }, steps: ['去。'], ...(a.place ? { place: a.place } : {}), log: 'x' })
      const f = poolFetch(() => claudeOk(reply), places)
      vi.stubGlobal('fetch', f)
      const now = '2026-09-11T12:40:00+08:00'
      const res = await handler(post({ now, seed }))
      const body = (await res.json()) as Body
      expect(res.headers.get('x-places-calls')).toBe('1') // 20 家都營業 → 一次就夠
      // 同樣的種子、同樣的消耗順序重算一次
      const rng = mulberry32(seed)
      const loc = { lat: 25.033, lng: 121.5654 }
      pickLane(CARD_BY_ID.eat, { diet: '都可以' }, undefined, 'TW', rng, hourIn(new Date(now), 'Asia/Taipei'))
      const cands = toCandidates(fixed, loc, new Date(now), [], 'Asia/Taipei')
      const want = pickPlace(cands, [], undefined, {
        now: Date.parse(now), country: 'TW', novelty: 'balanced', exclude: new Set(), rejectedCuisines: new Set(), clusters: clusterKeys(cands), rng,
      })!
      expect(body.place!.id).toBe(want.place.id)
      expect(body.place!.mapUrl).toContain(`query_place_id=${want.place.id}`)
      expect(body.meme.big.length).toBeLessThanOrEqual(10)
    }
  })

  it('prompt 只帶已決定的那一家：模型看不到候選清單', async () => {
    const claude = vi.fn((_init?: RequestInit) => claudeOk(ORDER_JSON))
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
      (String(url).includes('anthropic') ? claude(init) : poolPlaces(init))))
    const res = await handler(post({ seed: 7 }))
    const body = (await res.json()) as Body
    const sent = JSON.parse(String(claude.mock.calls[0]![0]!.body)) as { max_tokens: number; messages: { content: string }[] }
    const user = sent.messages[0]!.content
    expect(sent.max_tokens).toBe(600)
    expect(user).toContain('【店已決定】')
    expect(user).toContain(`place.id=${body.place!.id}`)
    const mentioned = POOL.filter((p) => user.includes(`id=${p.id} `) || user.includes(`id=${p.id}　`))
    expect(mentioned.map((p) => p.id)).toEqual([body.place!.id])
    expect(user).not.toContain('候選店家')
  })
})

describe('Round 3：禁詞、價位、國家（B8、B7、T9）', () => {
  beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}) })

  it('B8：故意塞禁詞的回應，送到前端的 meme／steps／log 0 命中', async () => {
    const dirty = JSON.stringify({
      verdict: 'do', meme: { top: '你這個廢物快去', big: '阿財魯肉飯', bot: '胖子也要吃飯' },
      steps: ['步行 6 分鐘，白痴都會走。', '點魯肉飯。'], place: { id: 'p1', name: '阿財魯肉飯' }, log: '智障完成任務。',
    })
    vi.stubGlobal('fetch', routed(() => claudeOk(dirty)))
    const body = (await (await handler(post({}))).json()) as Body
    const text = [body.meme.top, body.meme.big, body.meme.bot, ...body.steps, body.log].join('\n')
    expect(findBanned(text)).toEqual([])
    expect(body.steps).toContain('點魯肉飯。')
  })

  it('B7：模型編的金額被拔掉；Google 給的價位留著', async () => {
    const priced = () => new Response(JSON.stringify({ places: [{
      id: 'p1', displayName: { text: '阿財魯肉飯' }, location: { latitude: 25.0335, longitude: 121.5658 }, currentOpeningHours: { openNow: true },
      priceRange: { startPrice: { currencyCode: 'TWD', units: '80' }, endPrice: { currencyCode: 'TWD', units: '150' } },
    }] }), { status: 200 })
    const reply = JSON.stringify({
      verdict: 'do', meme: { top: '這家你沒去過', big: '阿財魯肉飯', bot: '一碗只要 NT$35' },
      steps: ['魯肉飯 50元、滷蛋。', '預算 NT$80–150。'], place: { id: 'p1', name: '阿財魯肉飯' }, log: '花了 ¥500。',
    })
    vi.stubGlobal('fetch', routed(() => claudeOk(reply), priced))
    const body = (await (await handler(post({}))).json()) as Body
    expect(body.place!.priceText).toBe('≈NT$80–150')
    const text = [body.meme.top, body.meme.bot, ...body.steps, body.log].join('\n')
    expect(text).not.toMatch(/35|50元|¥500/)
    expect(text).toContain('NT$80–150')
  })

  it('東京座標：country JP、口令不出現「捷運」、時區是東京', async () => {
    const tokyo = () => new Response(JSON.stringify({ places: [{
      id: 'j1', displayName: { text: 'すき家 渋谷店' }, location: { latitude: 35.6813, longitude: 139.7672 },
      currentOpeningHours: { openNow: false, nextOpenTime: '2026-09-11T04:00:00Z' }, // 東京 13:00
    }] }), { status: 200 })
    const reply = JSON.stringify({ verdict: 'do', meme: { top: '這家你沒去過', big: 'すき家', bot: '搭捷運也行' }, steps: ['走到捷運站旁。'], log: 'x' })
    vi.stubGlobal('fetch', routed(() => claudeOk(reply), tokyo))
    const res = await handler(post({ loc: { lat: 35.6812, lng: 139.7671 }, now: '2026-09-11T12:30:00+09:00' }))
    const body = (await res.json()) as Body
    expect(body.place).toMatchObject({ id: 'j1', country: 'JP', opensAt: '13:00', brand: 'sukiya' })
    expect(JSON.stringify(body)).not.toContain('捷運')
    expect(body.debug.price?.country).toBe('JP')
  })
})

describe('Round 3：Places 呼叫規則', () => {
  beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}) })

  it('lane 回 400 → 第二次自動退回 restaurant（算在 2 次裡）', async () => {
    const bodies: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes('anthropic')) return claudeOk(ORDER_JSON)
      bodies.push(String(init?.body))
      return bodies.length === 1 ? new Response('bad type', { status: 400 }) : poolPlaces(init)
    }))
    const res = await handler(post({ seed: 3 }))
    expect(res.status).toBe(200)
    expect(res.headers.get('x-places-calls')).toBe('2')
    expect(JSON.parse(bodies[1]!).includedTypes).toEqual(['restaurant'])
  })

  it('甜食走甜食 lane、素走素食 lane；第二次也不退回 restaurant', async () => {
    for (const [choices, types] of [[{ taste: '甜食' }, ['bakery', 'cafe', 'ice_cream_shop']], [{ diet: '素' }, ['vegetarian_restaurant', 'vegan_restaurant']]] as const) {
      const bodies: string[] = []
      vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        if (String(url).includes('anthropic')) return claudeOk(ORDER_JSON)
        bodies.push(String(init?.body))
        return new Response(JSON.stringify({ places: [] }), { status: 200 })
      }))
      await handler(post({ choices: { ...choices }, seed: 11 }))
      expect(bodies).toHaveLength(2)
      if ('diet' in choices) expect(JSON.parse(bodies[0]!).includedTypes).toEqual(types)
      expect(JSON.parse(bodies[1]!).includedTypes).toEqual(types)
    }
  })

  it('rest 走 Text Search；rankPreference 只用 DISTANCE／RELEVANCE', async () => {
    const ranks = new Set<string>()
    for (let seed = 1; seed <= 12; seed++) {
      const bodies: string[] = []
      vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        if (String(url).includes('anthropic')) return claudeOk(ORDER_JSON)
        bodies.push(String(init?.body))
        return poolPlaces(init)
      }))
      await handler(post({ module: 'rest', choices: { drink: '居酒屋' }, seed }))
      const b = JSON.parse(bodies[0]!)
      expect(b.textQuery).toBe('居酒屋')
      ranks.add(b.rankPreference)
    }
    expect([...ranks].sort()).toEqual(['DISTANCE', 'RELEVANCE'])
  })

  it('匿名 log：[pick] 一行，不記 place_id、不記座標、不記店名；debug 不含 place_id', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.stubGlobal('fetch', poolFetch())
    const res = await handler(post({ seed: 5 }))
    const body = (await res.json()) as Body
    const pickLine = info.mock.calls.map((c) => String(c[0])).find((l) => l.startsWith('[pick]'))!
    expect(pickLine).toMatch(/^\[pick\] module=eat mode=\w+ lane=\S+ pool=\d+ kept=\d+ known_price=[\d.]+ country=TW seen14d=(true|false) relaxed=\S+$/)
    const logs = info.mock.calls.map((c) => String(c[0])).join('\n')
    expect(logs).not.toContain(body.place!.id)
    expect(logs).not.toContain('25.033')
    expect(logs).not.toContain(body.place!.name)
    expect(JSON.stringify(body.debug)).not.toContain(body.place!.id)
    expect(body.debug.pick).toMatchObject({ seed: 5, relaxed: expect.any(Array) })
  })

  it('記憶裡 never_again／本次換掉的店，0 次被派', async () => {
    vi.stubGlobal('fetch', poolFetch(undefined, () => new Response(JSON.stringify({ places: POOL.slice(0, 20) }), { status: 200 })))
    const banned = ['g1', 'g2', 'g3']
    for (let seed = 1; seed <= 20; seed++) {
      const res = await handler(post({ seed, mem: [{ id: 'g1', sh: [], dn: [], x: 'forever' }, { id: 'g2', sh: [], dn: [], x: Date.parse('2026-12-01') }], exclude: ['g3'] }))
      expect(banned).not.toContain(((await res.json()) as Body).place!.id)
    }
  })
})
