/**
 * 煙霧測試：真的起一個 HTTP server，真的 curl /api/order，檢查回 200 + 合法 Order JSON。
 * 上游（Claude / Places）用本機假伺服器頂替，所以不需要真的 key 就能驗證整條 HTTP 路徑。
 *
 *   node scripts/smoke-order.mjs
 */
import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer as createVite } from 'vite'

const exec = promisify(execFile)
const ORDER = {
  verdict: 'do',
  meme: { top: '去吃熱的', big: '阿財魯肉飯', bot: '這週兩天超商了' },
  steps: ['步行 6 分鐘，營業到 21:00。', '魯肉飯、滷蛋、燙青菜。', '12 分鐘吃完，手機收起來。'],
  place: { id: 'p1', name: '阿財魯肉飯' },
  log: '12:41 魯肉飯，12:58 完成。',
}

// ── 假上游：/v1/messages 當 Claude，/v1/places:searchNearby 當 Places ──
const fake = createServer((req, res) => {
  let body = ''
  req.on('data', (c) => { body += c })
  req.on('end', () => {
    res.setHeader('content-type', 'application/json')
    if (req.url.includes('messages')) {
      res.end(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(ORDER) }] }))
    } else {
      res.end(JSON.stringify({
        places: [{
          id: 'p1', displayName: { text: '阿財魯肉飯' },
          location: { latitude: 25.0335, longitude: 121.5658 },
          currentOpeningHours: { openNow: true },
        }],
      }))
    }
  })
})
await new Promise((r) => fake.listen(0, '127.0.0.1', r))
const fakePort = fake.address().port

process.env.ANTHROPIC_API_KEY = 'smoke-test-key'
process.env.GOOGLE_PLACES_KEY = 'smoke-test-key'
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${fakePort}`
process.env.PLACES_BASE_URL = `http://127.0.0.1:${fakePort}`

const vite = await createVite({ server: { port: 5199, strictPort: true, host: '127.0.0.1' }, logLevel: 'warn' })
await vite.listen()

const payload = JSON.stringify({
  module: 'eat', level: 1, choices: { diet: '都可以' },
  loc: { lat: 25.033, lng: 121.5654, label: '信義區' },
  now: new Date().toISOString(), recentOrders: [],
})

let failed = false
try {
  const { stdout } = await exec('curl', [
    '-s', '-w', '\n%{http_code}', '-X', 'POST',
    'http://127.0.0.1:5199/api/order',
    '-H', 'content-type: application/json',
    '-d', payload,
  ])
  const lines = stdout.trim().split('\n')
  const code = lines.pop()
  const json = JSON.parse(lines.join('\n'))

  console.log('HTTP', code)
  console.log(JSON.stringify(json, null, 2))

  const ok =
    code === '200' &&
    (json.verdict === 'do' || json.verdict === 'stop') &&
    typeof json.meme?.big === 'string' && json.meme.big.length > 0 &&
    Array.isArray(json.steps) && json.steps.length > 0 &&
    typeof json.log === 'string'

  console.log(ok ? '\nSMOKE PASS：curl 回 200 + 合法 Order JSON' : '\nSMOKE FAIL')
  failed = !ok
} catch (e) {
  console.error('SMOKE FAIL:', e.message)
  failed = true
}

await vite.close()
fake.close()
process.exit(failed ? 1 : 0)
