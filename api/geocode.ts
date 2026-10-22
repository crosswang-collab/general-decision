// Vercel Function：手動報地點 → 座標（DEV-PLAN-3 C2）。拒絕定位的人報「台北車站」也拿得到口令。
// 伺服器不存任何東西、log 不記查詢字串與座標（R12）。key 只在這裡存在，前端永遠不碰。
import type { GeocodeRequest, GeocodeResponse } from '../src/types.ts'

export const config = { runtime: 'nodejs' }

const PLACES_BASE = process.env.PLACES_BASE_URL ?? 'https://places.googleapis.com'
const TEXT_URL = `${PLACES_BASE}/v1/places:searchText`
/** 只要座標與名稱，不帶評分、營業時間（少拿就少一分條款與費用風險）。 */
const GEOCODE_FIELD_MASK = 'places.location,places.displayName'
const MAX_Q = 60

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  })

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let req: GeocodeRequest
  try {
    req = (await request.json()) as GeocodeRequest
  } catch {
    return json({ error: 'bad_request', message: '請求不是合法 JSON' }, 400)
  }
  const q = typeof req?.q === 'string' ? req.q.trim() : ''
  if (!q || q.length > MAX_Q) {
    return json({ error: 'bad_request', message: '報個車站或地標，不要超過 60 個字。' }, 400, { 'x-places-calls': '0' })
  }

  const key = process.env.GOOGLE_PLACES_KEY
  if (!key) {
    console.warn('[geocode] GOOGLE_PLACES_KEY 未設定')
    return json({ error: 'upstream', message: '班長在開會。30 秒後再報告。' }, 502, { 'x-places-calls': '0' })
  }

  let res: Response
  try {
    res = await fetch(TEXT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': GEOCODE_FIELD_MASK },
      body: JSON.stringify({ textQuery: q, pageSize: 1, languageCode: 'zh-TW' }),
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    console.warn('[geocode] fail timeout')
    return json({ error: 'upstream', message: '班長在開會。30 秒後再報告。' }, 502, { 'x-places-calls': '1' })
  }
  if (!res.ok) {
    console.warn(`[geocode] fail ${res.status}`)
    return json({ error: res.status === 429 ? 'rate_limited' : 'upstream', message: '班長在開會。30 秒後再報告。' }, res.status === 429 ? 429 : 502, { 'x-places-calls': '1' })
  }
  const data = (await res.json()) as { places?: { location?: { latitude?: number; longitude?: number }; displayName?: { text?: string } }[] }
  const p = data.places?.[0]
  const lat = p?.location?.latitude
  const lng = p?.location?.longitude
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    console.info('[geocode] not_found')
    return json({ error: 'not_found', message: '找不到這個地方。報個車站或地標。' }, 404, { 'x-places-calls': '1' })
  }
  console.info('[geocode] ok') // 不記 q、不記座標
  const out: GeocodeResponse = { loc: { lat, lng }, label: p?.displayName?.text || q }
  return json(out, 200, { 'x-places-calls': '1' })
}

// 同 api/order.ts：函式型的 export default 會被 Vercel 當成舊式 (req, res) => void，
// 回傳值被丟棄、請求掛住（DEV-PLAN-3 §E.2 坑 1）。default 必須是物件形式的 fetch handler。
export function GET(request: Request): Promise<Response> { return handler(request) }
export function POST(request: Request): Promise<Response> { return handler(request) }
export default { fetch: handler }
