// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api/order.ts'
import type { Order, OrderRequest } from '../../src/types.ts'

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
      module: 'eat', level: 1, choices: { diet: '都可以' },
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

  it('Places 掛掉仍然出得了口令（第 8 節降級）', async () => {
    vi.stubGlobal('fetch', routed(
      () => claudeOk(ORDER_JSON),
      () => new Response('boom', { status: 500 }),
    ))
    const res = await handler(post({ loc: { lat: 25.033, lng: 121.5654 } }))
    expect(res.status).toBe(200)
  }, 15_000)

  it('沒有定位 → 完全不打 Places，仍然 200（第 11 節定位被拒）', async () => {
    const f = routed(() => claudeOk(ORDER_JSON))
    vi.stubGlobal('fetch', f)
    const res = await handler(post({ loc: undefined }))
    expect(res.status).toBe(200)
    expect(res.headers.get('x-places-calls')).toBe('0')
    for (const call of f.mock.calls) expect(String(call[0])).not.toContain('googleapis')
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
