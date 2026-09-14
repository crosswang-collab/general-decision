// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../../api/weekly.ts'
import { parseWeekly } from '../../src/orderParse.ts'
import { ParseError } from '../../src/orderParse.ts'
import { makeEntry } from '../../src/diary.ts'
import type { WeeklyReport } from '../../src/types.ts'

const REPORT = { body: '本週十一道口令，九道完成。你只在不用出門的事情上偷懶。下週歇的口令改成站起來再說。', verdict: '本週講評：合格。' }

const claudeOk = (text: string) =>
  new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { status: 200 })

const post = (body: unknown) =>
  new Request('http://localhost/api/weekly', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })

const WEEK_START = '2026-09-07T00:00:00+08:00'
const entries = [
  ...Array.from({ length: 9 }, (_, i) => makeEntry(`2026-09-0${(i % 5) + 7}T12:0${i}:00+08:00`, 'eat', 1, `店${i}`, 'done')),
  makeEntry('2026-09-08T13:00:00+08:00', 'rest', 1, 'Fika', 'reissued'),
  makeEntry('2026-09-08T23:30:00+08:00', 'sleep', 1, '23:30 熄燈', 'punished'),
  makeEntry('2026-09-09T16:05:00+08:00', 'rest', 1, 'Fika', 'punished'),
]

beforeEach(() => { process.env.ANTHROPIC_API_KEY = 'test-key' })
afterEach(() => { vi.unstubAllGlobals() })

describe('parseWeekly 四層', () => {
  it('合法 / fenced / 前後有字都吃得下', () => {
    const raw = JSON.stringify(REPORT)
    expect(parseWeekly(raw).verdict).toBe('本週講評：合格。')
    expect(parseWeekly('```json\n' + raw + '\n```').verdict).toBe('本週講評：合格。')
    expect(parseWeekly('報告：\n' + raw).verdict).toBe('本週講評：合格。')
  })
  it('非法 → ParseError', () => {
    expect(() => parseWeekly('班長還在寫')).toThrow(ParseError)
  })
  it('body 空字串也算非法', () => {
    expect(() => parseWeekly(JSON.stringify({ body: '  ', verdict: 'x' }))).toThrow(ParseError)
  })
})

describe('/api/weekly handler（第 12 節 S8）', () => {
  it('數字由伺服器算，不採用模型講的', async () => {
    // Claude 故意回錯的 stats，應該被忽略
    vi.stubGlobal('fetch', vi.fn(async () => claudeOk(JSON.stringify({
      ...REPORT, stats: { orders: 999, complianceRate: 1, punishments: 99, weakestModule: 'eat' },
    }))))
    const res = await handler(post({ weekStart: WEEK_START, level: 1, entries }))
    expect(res.status).toBe(200)
    const r = (await res.json()) as WeeklyReport
    expect(r.stats.orders).toBe(12)
    expect(r.stats.complianceRate).toBe(83) // (9 done + 1 reissued) / 12
    expect(r.stats.punishments).toBe(2)
    expect(r.stats.weakestModule).toBe('rest') // 罰則最多
    expect(r.body).toBe(REPORT.body)
    expect(r.verdict).toBe(REPORT.verdict)
  })

  it('本週沒有紀錄 → 不打 Claude，直接回固定講評', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    const res = await handler(post({ weekStart: WEEK_START, level: 1, entries: [] }))
    expect(res.status).toBe(200)
    const r = (await res.json()) as WeeklyReport
    expect(r.stats.orders).toBe(0)
    expect(r.verdict).toContain('無紀錄')
    expect(f).not.toHaveBeenCalled()
  })

  it('Claude 掛掉 → 502 + 第 11 節文案', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))
    const res = await handler(post({ weekStart: WEEK_START, level: 1, entries }))
    expect(res.status).toBe(502)
    expect((await res.json()).message).toBe('本週講評延後，班長還在寫。')
  }, 15_000)

  it('GET → 405', async () => {
    expect((await handler(new Request('http://localhost/api/weekly'))).status).toBe(405)
  })
})
