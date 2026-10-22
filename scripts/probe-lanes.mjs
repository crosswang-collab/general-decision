/**
 * lane 實測（DEV-PLAN-3 W1.10、R3§1.3）：src/lanes.ts 每一條 lane 對台北與東京各打一次 Nearby Search（maxResultCount 1），
 * 印 lane／HTTP 狀態／筆數。任何一條回 400 → exit 1，那條 lane 在 src/lanes.ts 要維持（或改成）verified:false。
 * 全部 200 的新 lane 才由 Team Lead／Cross 把 verified 翻成 true。
 *
 * 需要正式金鑰，只有 Team Lead／Cross 跑；會產生 Places 費用（lane 數 × 2 次，fieldMask 只要 places.id）。
 *   GOOGLE_PLACES_KEY=… npm run probe:lanes
 *   GOOGLE_PLACES_KEY=… node scripts/probe-lanes.mjs --only-unverified
 */
import { LANES, RESTAURANT_LANE, SWEET_LANE, VEG_LANE } from '../src/lanes.ts'

const KEY = process.env.GOOGLE_PLACES_KEY
if (!KEY) {
  console.error('缺 GOOGLE_PLACES_KEY。這支只給有正式金鑰的人跑：GOOGLE_PLACES_KEY=… npm run probe:lanes')
  process.exit(2)
}
const BASE = process.env.PLACES_BASE_URL ?? 'https://places.googleapis.com'
const POINTS = [
  { name: '台北', lat: 25.033, lng: 121.5654 },
  { name: '東京', lat: 35.6812, lng: 139.7671 },
]
const onlyUnverified = process.argv.includes('--only-unverified')
const lanes = [...LANES, RESTAURANT_LANE, SWEET_LANE, VEG_LANE].filter((l) => !onlyUnverified || !l.verified)

let bad = 0
const rows = []
for (const lane of lanes) {
  for (const p of POINTS) {
    let status = 0
    let n = -1
    let note = ''
    try {
      const res = await fetch(`${BASE}/v1/places:searchNearby`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': 'places.id' },
        body: JSON.stringify({
          includedTypes: lane.types,
          maxResultCount: 1,
          languageCode: 'zh-TW',
          locationRestriction: { circle: { center: { latitude: p.lat, longitude: p.lng }, radius: 800 } },
        }),
        signal: AbortSignal.timeout(10_000),
      })
      status = res.status
      if (res.ok) n = ((await res.json()).places ?? []).length
      else note = (await res.text()).replace(/\s+/g, ' ').slice(0, 120)
    } catch (e) {
      note = String(e?.message ?? e)
    }
    if (status === 400) bad++
    rows.push({ lane: lane.id, where: p.name, status, raw: n, verified: lane.verified, note })
    console.log(`${lane.id.padEnd(30)} ${p.name}  ${String(status).padEnd(4)} raw=${n}${lane.verified ? '' : '  (verified:false)'}${note ? `  ${note}` : ''}`)
  }
}

const flip = [...new Set(rows.filter((r) => !r.verified).map((r) => r.lane))]
  .filter((id) => rows.filter((r) => r.lane === id).every((r) => r.status === 200))
console.log(`\n共 ${rows.length} 次呼叫；400：${bad} 次。`)
if (flip.length) console.log(`兩地都 200、可以翻成 verified:true 的 lane：${flip.join('、')}`)
if (bad > 0) {
  console.error('有 lane 回 400：在 src/lanes.ts 把那條標 verified:false（pickLane 就不會挑）。')
  process.exit(1)
}
