// Vercel Function：定位+卡片+選項 → Places(可選) → Claude → Order JSON（第 4、8、11 節）。
// key 只在這裡存在，前端永遠不碰。
import { CARD_BY_ID } from '../src/cards.ts'
import { buildOrderPrompt, type PlaceCandidate } from '../src/prompt.ts'
import { parseOrder, ParseError } from '../src/orderParse.ts'
import { enforceRules } from '../src/rules.ts'
import { FIELD_MASK, MAX_RESULTS, placeMapUrl, toCandidates, type RawPlace } from '../src/places.ts'
import type { Order, OrderRequest } from '../src/types.ts'

export const config = { runtime: 'nodejs' }

const MODEL = 'claude-sonnet-5'
// base URL 可用環境變數覆蓋：本機煙霧測試與公司 proxy 都用得到。正式環境不設就是官方端點。
const ANTHROPIC_URL = `${process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com'}/v1/messages`
const PLACES_URL = `${process.env.PLACES_BASE_URL ?? 'https://places.googleapis.com'}/v1/places:searchNearby`

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  })

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let req: OrderRequest
  try {
    req = (await request.json()) as OrderRequest
  } catch {
    return json({ error: 'bad_request', message: '請求不是合法 JSON' }, 400)
  }
  if (!req?.module || !CARD_BY_ID[req.module]) {
    return json({ error: 'bad_request', message: '未知的模組' }, 400)
  }
  req.recentOrders ??= []
  req.now ||= new Date().toISOString()

  const card = CARD_BY_ID[req.module]
  const now = new Date(req.now)

  // ── Places（只在 eat / rest，且有定位時）─────────────────────────
  let places: PlaceCandidate[] = []
  let placesCalled = 0
  if (card.needsPlaces && req.loc) {
    const radius = card.placesQuery?.radiusByTransport?.default ?? 800
    const types = card.placesQuery?.includedTypes ?? []
    try {
      const raw = await fetchPlaces(req.loc, radius, types)
      placesCalled = 1
      places = toCandidates(raw, req.loc, now, req.exclude ?? [])
      console.info(`[places] ok raw=${raw.length} candidates=${places.length}`)
    } catch (e) {
      // 第 8 節：Places 掛掉就降級，永遠有口令出來。
      // 但一定要留一行 log：之前這裡靜靜吞掉，「Places 到底有沒有通」從外面完全看不出來。
      console.warn(`[places] fail：${(e as Error).message}`)
      places = []
    }
  }

  // ── Claude ────────────────────────────────────────────────────
  const { system, user } = buildOrderPrompt(req, places)
  try {
    const text = await callClaude(system, user, 900)
    const order = enforceRules(parseOrder(text), req.module, req.choices ?? {}, now, req.recentOrders)
    return json(withPlace(order, places), 200, { 'x-places-calls': String(placesCalled) })
  } catch (e) {
    const status = e instanceof ParseError ? 502 : (e as UpstreamError)?.status ?? 502
    return json(
      { error: status === 429 ? 'rate_limited' : 'upstream', message: '班長在開會。30 秒後再報告。' },
      status === 429 ? 429 : 502,
      { 'x-places-calls': String(placesCalled) },
    )
  }
}

// Vercel 的 Node runtime 只要看到「函式型的 export default」就走舊式 (req, res) => void：
// 回傳的 Response 直接丟棄、請求永遠掛住，而且具名 export 完全不被理會。
// 正式站實測過——只加 GET/POST、default 仍是函式時，log 照樣是
// 「default export returned a `Response`」、狀態碼 0。所以 default 必須是物件形式的
// fetch handler，不能是函式。具名 GET/POST 一併保留：文件把兩者都列為合法入口。
export function GET(request: Request): Promise<Response> { return handler(request) }
export function POST(request: Request): Promise<Response> { return handler(request) }
export default { fetch: handler }

/**
 * Claude 若挑了店，拿它去比對伺服器端的真實候選清單；比中了就用真實資料覆寫，
 * 並在這裡（也只在這裡）用真 place id 組 Google Maps 連結（階段 B）。
 * 比不中 → 原樣回傳、不得產生 mapUrl。模型自己寫的 mapUrl 已在 enforceRules() 被丟掉。
 */
export function withPlace(order: Order, places: PlaceCandidate[]): Order {
  if (!order.place) return order
  const match = places.find((p) => p.id === order.place!.id || p.name === order.place!.name)
  if (!match) return order
  return {
    ...order,
    place: { id: match.id, name: match.name, walkMin: match.walkMin, openUntil: match.openUntil, mapUrl: placeMapUrl(match.id, match.name) },
  }
}

interface UpstreamError extends Error { status?: number }

function upstream(status: number, msg: string): UpstreamError {
  const e = new Error(msg) as UpstreamError
  e.status = status
  return e
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 第 11 節：429/5xx 重試 2 次（1s、3s）。 */
async function callClaude(system: string, user: string, maxTokens: number): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw upstream(500, 'ANTHROPIC_API_KEY 未設定')

  const delays = [1000, 3000]
  let last: UpstreamError = upstream(502, 'unknown')
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    let res: Response
    try {
      res = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: user }],
        }),
        signal: AbortSignal.timeout(20_000),
      })
    } catch {
      last = upstream(504, 'Claude 逾時')
      if (attempt < delays.length) { await sleep(delays[attempt]!); continue }
      throw last
    }

    if (res.ok) {
      const data = (await res.json()) as { content?: { type: string; text?: string }[] }
      const text = (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('')
      if (!text) throw upstream(502, 'Claude 回空內容')
      return text
    }

    // 4xx（除了 429）是永久錯，不重試
    if (res.status !== 429 && res.status < 500) throw upstream(res.status, `Claude ${res.status}`)
    last = upstream(res.status, `Claude ${res.status}`)
    if (attempt < delays.length) await sleep(delays[attempt]!)
  }
  throw last
}

/** 第 8 節：5xx／逾時重試 1 次後降級；4xx 視為永久，直接降級。 */
async function fetchPlaces(
  loc: { lat: number; lng: number },
  radius: number,
  includedTypes: string[],
): Promise<RawPlace[]> {
  const key = process.env.GOOGLE_PLACES_KEY
  if (!key) throw new Error('GOOGLE_PLACES_KEY 未設定')

  const body = JSON.stringify({
    includedTypes,
    maxResultCount: MAX_RESULTS,
    locationRestriction: { circle: { center: { latitude: loc.lat, longitude: loc.lng }, radius } },
  })

  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response
    try {
      res = await fetch(PLACES_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body,
        signal: AbortSignal.timeout(8000),
      })
    } catch {
      if (attempt === 0) continue // 逾時重試 1 次
      throw new Error('Places 逾時')
    }
    if (res.ok) {
      const data = (await res.json()) as { places?: RawPlace[] }
      return data.places ?? []
    }
    if (res.status < 500) throw new Error(`Places ${res.status}`) // 4xx 永久，直接降級
    if (attempt === 1) throw new Error(`Places ${res.status}`)
  }
  return []
}
