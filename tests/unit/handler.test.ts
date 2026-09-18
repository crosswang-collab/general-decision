// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api/order.ts'
import type { Order, OrderDebug, OrderRequest } from '../../src/types.ts'

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
    expect(res.headers.get('x-places-calls')).toBe('1')
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

  it('第一圈沒有營業中的店 → 半徑放大再查一次，第二圈有就用第二圈', async () => {
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
  })

  it('模型只講類別、沒挑清單裡的店 → 重打一次；還是沒有 → 伺服器指定評價最高那家', async () => {
    const category = JSON.stringify({
      verdict: 'do', meme: { top: '去吃', big: '附近的小吃店', bot: 'x' }, steps: ['找一家小吃店。'], log: 'x',
    })
    const claude = vi.fn(() => claudeOk(category))
    vi.stubGlobal('fetch', routed(claude))
    const res = await handler(post({}))
    expect(res.status).toBe(200)
    expect(claude).toHaveBeenCalledTimes(2)
    const order = (await res.json()) as Order
    expect(order.meme.big).toBe('阿財魯肉飯')
    expect(order.place?.id).toBe('p1')
    expect(order.place?.mapUrl).toContain('query_place_id=p1')
  })

  it('模型第一次講類別、第二次挑對 → 用第二次的', async () => {
    let n = 0
    const claude = vi.fn(() => claudeOk(n++ === 0
      ? JSON.stringify({ verdict: 'do', meme: { top: 'a', big: '甜點店', bot: 'c' }, steps: ['去。'], log: 'x' })
      : ORDER_JSON))
    vi.stubGlobal('fetch', routed(claude))
    const res = await handler(post({}))
    expect(claude).toHaveBeenCalledTimes(2)
    expect(((await res.json()) as Order).place?.id).toBe('p1')
  })

  // 除錯畫面（長按班長名牌）的資料來源：Vercel log 保存期太短，這份跟著回應送到手機上。
  it('成功時回應帶 debug：查了幾圈、候選與評分、挑中誰、各段幾毫秒', async () => {
    vi.stubGlobal('fetch', routed(() => claudeOk(ORDER_JSON)))
    const res = await handler(post({}))
    const body = (await res.json()) as Order & { debug: OrderDebug }
    expect(body.debug.module).toBe('eat')
    expect(body.debug.model).toBe('claude-haiku-4-5')
    expect(body.debug.places?.how).toBe('types=restaurant')
    expect(body.debug.places?.tries).toEqual([{ r: 800, raw: 1, kept: 1 }])
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

  it('模型被重打與被強制指定，debug 都記得下來', async () => {
    const category = JSON.stringify({
      verdict: 'do', meme: { top: 'a', big: '附近的小吃店', bot: 'c' }, steps: ['找一家。'], log: 'x',
    })
    vi.stubGlobal('fetch', routed(() => claudeOk(category)))
    const res = await handler(post({}))
    const body = (await res.json()) as Order & { debug: OrderDebug }
    expect(body.debug.retry).toBe('noplace')
    expect(body.debug.forced).toBe('阿財魯肉飯')
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
