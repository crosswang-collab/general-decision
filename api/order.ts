// Vercel Function：定位+卡片+選項 → Places(可選) → Claude → Order JSON（第 4、8、11 節）。
// key 只在這裡存在，前端永遠不碰。
import { CARD_BY_ID } from '../src/cards.ts'
import { buildOrderPrompt, type PlaceCandidate } from '../src/prompt.ts'
import { parseOrder, ParseError } from '../src/orderParse.ts'
import { enforceRules, isNonAnswer } from '../src/rules.ts'
import { FETCH_COUNT, FIELD_MASK, WIDEN_FACTOR, matchPlace, placeMapUrl, placesSearchFor, toCandidates, type PlacesSearch, type RawPlace } from '../src/places.ts'
import type { Order, OrderDebug, OrderRequest } from '../src/types.ts'

export const config = { runtime: 'nodejs' }

// 口令走 Haiku 4.5：正式站 [timing] 量到 Claude 佔 3.1–6.4s、等於整段伺服器時間，
// 換模型是唯一還能砍掉一半以上的手段。要退回 Sonnet 不用改碼，設 ORDER_MODEL=claude-sonnet-5 重新部署即可。
// 語氣與規則的保證在 enforceRules() 與 localizeOrder()，不靠模型本身。
const MODEL = process.env.ORDER_MODEL ?? 'claude-haiku-4-5'
// base URL 可用環境變數覆蓋：本機煙霧測試與公司 proxy 都用得到。正式環境不設就是官方端點。
const ANTHROPIC_URL = `${process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com'}/v1/messages`
const PLACES_BASE = process.env.PLACES_BASE_URL ?? 'https://places.googleapis.com'
const PLACES_URL = { nearby: `${PLACES_BASE}/v1/places:searchNearby`, text: `${PLACES_BASE}/v1/places:searchText` }

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
  // 除錯紀錄：整趟的真實數字，跟著回應送回前端存進手機（src/debug.ts）。
  // Vercel 免費方案的 log 保存期太短，事後回報就查不到了；這份跟著手機走。
  const dbg: OrderDebug = { module: req.module, level: req.level }

  // ── Places（eat / rest 必須有真店；沒有就是失敗，不再用類別降級）──────
  // Cross 2026-09-18：只講「甜點店／小吃店」一律視為禁止；必須是地圖上正在營業或即將營業、評價數多且正面的真店。
  const t0 = Date.now()
  let placesMs = 0
  let places: PlaceCandidate[] = []
  let placesCalled = 0
  if (card.needsPlaces) {
    if (!req.loc) {
      dbg.error = 'no_location'
      return json({ error: 'no_location', message: '不報座標，班長就點不了店。開定位再報告。', debug: dbg }, 400)
    }
    const search = placesSearchFor(card, req.choices ?? {})
    const what = search.kind === 'text' ? `text="${search.textQuery}"` : `types=${search.includedTypes.join('|')}`
    const tries: { r: number; raw: number; kept: number }[] = []
    // 第一圈半徑查不到 → 放大 2.5 倍再查一次，之後才算失敗。
    for (const radius of [search.radius, Math.round(search.radius * WIDEN_FACTOR)]) {
      try {
        const raw = await fetchPlaces(req.loc, { ...search, radius })
        placesCalled++
        places = toCandidates(raw, req.loc, now, req.exclude ?? [])
        tries.push({ r: radius, raw: raw.length, kept: places.length })
        console.info(`[places] ok ${what} r=${radius} raw=${raw.length} candidates=${places.length}`)
      } catch (e) {
        tries.push({ r: radius, raw: -1, kept: 0 }) // raw=-1：這一圈整個查失敗
        console.warn(`[places] fail ${what} r=${radius}：${(e as Error).message}`)
      }
      if (places.length) break
    }
    placesMs = Date.now() - t0
    dbg.places = {
      how: what,
      tries,
      candidates: places.map((p) => ({ name: p.name, rating: p.rating, count: p.ratingCount, walkMin: p.walkMin, openUntil: p.openUntil, opensAt: p.opensAt })),
    }
    if (!places.length) {
      dbg.error = 'no_places'
      dbg.ms = { places: placesMs, claude: 0, total: Date.now() - t0 }
      return json(
        { error: 'no_places', message: '附近查不到營業中的店。換個地方再報告。', debug: dbg },
        502,
        { 'x-places-calls': String(placesCalled), 'x-timing': `places=${placesMs};claude=0` },
      )
    }
  }

  // ── Claude ────────────────────────────────────────────────────
  const { system, user } = buildOrderPrompt(req, places)
  try {
    const t1 = Date.now()
    let { text, outputTokens } = await callClaude(system, user, 900)
    let parsed = parseOrder(text)
    // 兩種不合格：(a) 推掉不答（「大事不受理／去找連長」）；(b) 該挑店的卡沒挑清單裡的真店（只講類別、編店名）。
    // 各自重打一次，把問題指名。不吐口令、只講類別都不被允許（Cross 2026-09-18）；prompt 是要求，這裡是保證。
    const complaint = (o: Order): string | null => {
      if (isNonAnswer(o)) return '上一次你回了「大事不受理／去找連長」。這是小事，不准推。重來，必須給可執行口令，verdict 用 "do"。'
      if (card.needsPlaces && !matchPlace(o.place, places)) return '上一次你沒有從候選清單挑出一家真店（只講類別或編了店名都不算）。重來：place.id 與 place.name 照清單填，meme.big 就是那家店名。'
      return null
    }
    const why = complaint(parsed)
    if (why) {
      dbg.retry = isNonAnswer(parsed) ? 'nonanswer' : 'noplace'
      console.warn(`[retry] module=${req.module} ${dbg.retry}，重打一次`)
      const retry = await callClaude(system, `${user}\n\n${why}`, 900)
      text = retry.text
      outputTokens += retry.outputTokens
      parsed = parseOrder(text)
      if (isNonAnswer(parsed)) throw upstream(502, '模型兩次都不給口令')
      // 第二次還是沒挑到真店 → 伺服器直接指定評價最高的那家，不讓類別答案流出去。
      if (card.needsPlaces && !matchPlace(parsed.place, places)) {
        const top = places[0]!
        dbg.forced = top.name
        console.warn(`[place] forced module=${req.module} → ${top.name}`)
        parsed = { ...parsed, meme: { ...parsed.meme, big: top.name.slice(0, 10) }, place: { id: top.id, name: top.name } }
      }
    }
    const claudeMs = Date.now() - t1
    // 加速方案第一步是量：每一次都留一行，Vercel log 直接看時間花在哪、模型吐了幾個 token。
    console.info(`[timing] places=${placesMs}ms claude=${claudeMs}ms total=${Date.now() - t0}ms model=${MODEL} out=${outputTokens} module=${req.module} level=${req.level}`)
    const order = enforceRules(parsed, req.module, req.choices ?? {}, now, req.recentOrders)
    const final = withPlace(order, places)
    dbg.model = MODEL
    dbg.outTokens = outputTokens
    dbg.ms = { places: placesMs, claude: claudeMs, total: Date.now() - t0 }
    dbg.picked = final.place?.name
    // debug 是 Order 以外的欄位，前端收到就剝掉，不會進日記（src/api.ts requestOrder）。
    return json({ ...final, debug: dbg }, 200, {
      'x-places-calls': String(placesCalled),
      'x-timing': `places=${placesMs};claude=${claudeMs};model=${MODEL}`,
    })
  } catch (e) {
    const status = e instanceof ParseError ? 502 : (e as UpstreamError)?.status ?? 502
    dbg.error = status === 429 ? 'rate_limited' : 'upstream'
    dbg.ms = { places: placesMs, claude: Date.now() - t0 - placesMs, total: Date.now() - t0 }
    return json(
      { error: dbg.error, message: '班長在開會。30 秒後再報告。', debug: dbg },
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
  const match = matchPlace(order.place, places)
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
async function callClaude(system: string, user: string, maxTokens: number): Promise<{ text: string; outputTokens: number }> {
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
      const data = (await res.json()) as { content?: { type: string; text?: string }[]; usage?: { output_tokens?: number } }
      const text = (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('')
      if (!text) throw upstream(502, 'Claude 回空內容')
      return { text, outputTokens: data.usage?.output_tokens ?? -1 }
    }

    // 4xx（除了 429）是永久錯，不重試
    if (res.status !== 429 && res.status < 500) throw upstream(res.status, `Claude ${res.status}`)
    last = upstream(res.status, `Claude ${res.status}`)
    if (attempt < delays.length) await sleep(delays[attempt]!)
  }
  throw last
}

/**
 * 第 8 節：5xx／逾時重試 1 次後降級；4xx 視為永久，直接降級。
 * Nearby 照 type 查；Text Search 用中文關鍵字（居酒屋、熱炒沒有 type），locationBias 圓 + 依距離排序 + 只要營業中。
 * 兩者同一組 fieldMask、同一個 SKU。languageCode 固定 zh-TW，店名才會是台灣寫法（第 7 節規則 8）。
 */
async function fetchPlaces(loc: { lat: number; lng: number }, search: PlacesSearch): Promise<RawPlace[]> {
  const key = process.env.GOOGLE_PLACES_KEY
  if (!key) throw new Error('GOOGLE_PLACES_KEY 未設定')

  const circle = { center: { latitude: loc.lat, longitude: loc.lng }, radius: search.radius }
  // 不在這裡用 openNow 過濾：「60 分內開門」的店也要留，篩選在 toCandidates()。
  const body = JSON.stringify(
    search.kind === 'text'
      ? { textQuery: search.textQuery, pageSize: FETCH_COUNT, rankPreference: 'DISTANCE', languageCode: 'zh-TW', locationBias: { circle } }
      : { includedTypes: search.includedTypes, maxResultCount: FETCH_COUNT, languageCode: 'zh-TW', locationRestriction: { circle } },
  )

  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response
    try {
      res = await fetch(PLACES_URL[search.kind], {
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
