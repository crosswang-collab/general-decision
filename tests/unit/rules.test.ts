// @vitest-environment node
// enforceRules Round 3（DEV-PLAN-3 W1.6）：B6 mode 語意、B7 金額來源、B8 伺服器端禁詞、國家傳遞、店家覆寫。
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findBanned } from '../../src/banned.ts'
import { mulberry32 } from '../../src/discovery.ts'
import { nthCounts } from '../../src/modeLines.ts'
import { bigName, enforceRules, scrubAmounts } from '../../src/rules.ts'
import type { Country, Level, Order, PickMode, PickResult, PlaceCandidate } from '../../src/types.ts'

const NOW = new Date('2026-09-11T12:40:00+08:00')
const PLACE: PlaceCandidate = { id: 'p1', name: '阿財魯肉飯', walkMin: 6, openUntil: '21:00', priceRange: { start: 80, end: 150, currency: 'TWD' } }

const pick = (mode: PickMode, visits = 1, extra: Partial<PickResult> = {}, place: PlaceCandidate = PLACE): PickResult =>
  ({ place, mode, visits, relaxed: [], exhausted: false, ...extra })

const order = (meme: Partial<Order['meme']> = {}, rest: Partial<Order> = {}): Order => ({
  verdict: 'do',
  meme: { top: '去吃熱的', big: '阿財魯肉飯', bot: '動作快', ...meme },
  steps: ['步行 6 分鐘。', '魯肉飯、滷蛋。', '12 分鐘吃完。'],
  place: { id: 'p1', name: '阿財魯肉飯' },
  log: '12:41 魯肉飯。',
  ...rest,
})

const run = (o: Order, p: PickResult | null, level: Level = 1, country: Country = 'TW') =>
  enforceRules(o, 'eat', {}, NOW, [], { level, country, pick: p })

beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })

describe('B6：mode 語意（三 mode × 三火力 × 20 次 mock，100% 通過）', () => {
  // 模型可能回的各種東西：照寫、寫錯 mode、寫錯數字、空泛、踩禁詞
  const TOPS = ['這家你沒去過', '第 5 次了', '偵察任務', '去吃熱的', '你這廢物快去', '第一次來', '又是第三次', '老地方', '新據點', '']
  const BOTS = ['動作快', '這週第 4 次吃了', '沒來過吧', '偵察完回報', '白痴都會', '一個口令一個動作', '第 2 次報到', '']

  it.each([0, 1, 2] as Level[])('level %i', (level) => {
    const rng = mulberry32(100 + level)
    for (const mode of ['new', 'revisit', 'wildcard'] as PickMode[]) {
      for (let i = 0; i < 20; i++) {
        const visits = mode === 'revisit' ? 2 + Math.floor(rng() * 8) : 1
        const o = order({ top: TOPS[Math.floor(rng() * TOPS.length)]!, bot: BOTS[Math.floor(rng() * BOTS.length)]! })
        const out = run(o, pick(mode, visits), level)
        const text = `${out.meme.top}\n${out.meme.bot}`
        const label = `${mode} v=${visits} ← ${o.meme.top}｜${o.meme.bot} → ${text}`
        if (mode === 'new') expect(text, label).toMatch(/沒去過|新據點|第一次|沒來過/)
        if (mode === 'revisit') {
          const counts = nthCounts(text) // 「第 3 次」「第三次」都算
          expect(counts, label).toContain(visits)
          expect(counts.every((n) => n === visits), label).toBe(true)
        }
        if (mode === 'wildcard') expect(text, label).toContain('偵察')
        if (mode !== 'revisit') expect(text, label).not.toMatch(/第\s*([2-9]|[二三四五六七八九])\s*次/)
        expect(findBanned(text), label).toEqual([])
      }
    }
  })

  it('模型照寫 → 不動（不必要的替換也是失敗）', () => {
    const o = order({ top: '這家你沒去過，去', bot: '動作快' })
    expect(run(o, pick('new')).meme.top).toBe('這家你沒去過，去')
    const r = order({ top: '第 3 次報到', bot: '照舊' })
    expect(run(r, pick('revisit', 3)).meme.top).toBe('第 3 次報到')
  })

  it('exhausted → top 換成偵察完畢語料，mode 的話由 bot 補上', () => {
    const out = run(order({ top: '去吃熱的', bot: '動作快' }), pick('new', 1, { exhausted: true }))
    expect(out.meme.top).toMatch(/偵察|看過|掃完/)
    expect(`${out.meme.top}${out.meme.bot}`).toMatch(/沒去過|新據點|第一次|沒來過/)
  })

  // R3 修正 S-3（Team Lead 裁定）：原本「steps／log 裡寫錯的第 N 次改成伺服器數字」會把「不要讓我說第二次」改壞；
  // 次數檢查只作用在 meme.top／meme.bot，steps 與 log 不改數字。
  it('S-3：次數檢查只管 meme.top／bot；steps／log 的「第 N 次」原樣保留（「不要讓我說第二次」）', () => {
    const steps = ['不要讓我說第二次，點招牌。', '第一次點就點大碗。']
    const log = '不要讓我說第二次。'
    const rev = run(order({ top: '第 5 次了', bot: '動作快' }, { steps, log }), pick('revisit', 3))
    expect(rev.steps).toEqual(steps)
    expect(rev.log).toBe(log)
    expect(nthCounts(`${rev.meme.top}\n${rev.meme.bot}`).every((n) => n === 3)).toBe(true) // meme 照樣修
    const fresh = run(order({ top: '這家你沒去過' }, { steps, log }), pick('new'))
    expect(fresh.steps).toEqual(steps)
    expect(fresh.log).toBe(log)
  })
})

describe('B7：金額只能來自 priceText（T6）', () => {
  it('不在 priceText 的金額拔掉並 warn；在裡面的留著', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const o = order({ bot: '一碗只要 NT$35' }, { steps: ['魯肉飯 50元、滷蛋。', '預算 NT$80–150 內。', '約 NT$999'], log: '花了 ¥500。' })
    const out = run(o, pick('new'))
    const all = [out.meme.top, out.meme.big, out.meme.bot, ...out.steps, out.log].join('\n')
    expect(all).not.toMatch(/35|50元|999|¥500/)
    expect(out.steps).toContain('預算 NT$80–150 內。')
    expect(out.steps).not.toContain('約') // 只剩「約」的那條整條刪掉
    expect(out.steps.length).toBe(2)
    expect(warn.mock.calls.some((c) => String(c[0]).includes('金額'))).toBe(true)
  })

  it('沒有價位資料 → 任何金額都拔；店名裡的數字不算金額', () => {
    const p: PlaceCandidate = { id: 'h', name: '百元快炒100元店' }
    const out = run(order({ big: '百元快炒100元店', top: '這家你沒去過', bot: '才 120元' }, { steps: ['去百元快炒100元店。'] }), pick('new', 1, {}, p))
    expect(out.meme.bot).not.toContain('120')
    expect(out.steps[0]).toBe('去百元快炒100元店。')
  })

  it('幣別不對國家（台灣出現 ¥、日本出現 NT$）→ 拔', () => {
    const o = order({}, { steps: ['大概 ¥80 吧。', 'NT$80–150。'] })
    expect(scrubAmounts(o, '≈NT$80–150', 'TW').steps.join('')).not.toContain('¥')
    expect(scrubAmounts(o, '≈¥80〜150', 'JP').steps.join('')).not.toContain('NT$')
  })
})

describe('B8：伺服器端禁詞（T7、C3）', () => {
  it('meme／steps／log 命中 → 換語料或刪句；店名本身不算', () => {
    const p: PlaceCandidate = { id: 'u', name: '醜小鴨咖啡' }
    const o = order(
      { top: '你這個廢物', big: '醜小鴨咖啡', bot: '胖子快去' },
      { steps: ['去醜小鴨咖啡。', '白痴都會點。'], log: '智障完成。' },
    )
    const out = run(o, pick('new', 1, {}, p), 2)
    const text = [out.meme.top, out.meme.bot, ...out.steps, out.log].join('\n')
    expect(findBanned(text.split('醜小鴨咖啡').join(''))).toEqual([])
    expect(out.meme.big).toBe('醜小鴨咖啡')
    expect(out.steps).toEqual(['去醜小鴨咖啡。'])
    expect(out.log).not.toContain('智障')
  })

  it('沒有 pick（不需要 Places 的卡）也掃', () => {
    const out = enforceRules(order({ top: '廢物起床' }, { steps: ['滾去睡，白痴。'], place: undefined }), 'sleep', {}, NOW, [])
    expect(findBanned([out.meme.top, ...out.steps].join(''))).toEqual([])
    expect(out.steps.length).toBeGreaterThan(0)
  })
})

describe('店家覆寫（T2）與伺服器欄位', () => {
  it('模型寫別家店 → place 換成 pick、meme.big 換成店名', () => {
    const out = run(order({ big: '隔壁牛肉麵' }, { place: { id: 'x', name: '隔壁牛肉麵' } }), pick('new'))
    expect(out.place).toEqual({ id: 'p1', name: '阿財魯肉飯' })
    expect(out.meme.big).toBe('阿財魯肉飯')
  })
  it('模型寫的 mode／visits／band／priceText／mapUrl 一律丟掉', () => {
    const forged = order({}, { place: { id: 'p1', name: '阿財魯肉飯', mode: 'revisit', visits: 9, band: 4, priceText: 'NT$9999', mapUrl: 'https://evil' } })
    expect(run(forged, pick('new')).place).toEqual({ id: 'p1', name: '阿財魯肉飯' })
    const noPick = enforceRules(forged, 'go', {}, NOW, [])
    expect(noPick.place).toEqual({ id: 'p1', name: '阿財魯肉飯' })
  })
  it('S-1：handler 路徑（有 ctx）沒有 pick → place 整個刪掉，模型編的店名／id 不准流出', () => {
    const forged = order({}, { place: { id: 'p1', name: '阿財魯肉飯', walkMin: 3, openUntil: '23:00' } })
    const out = enforceRules(forged, 'go', {}, NOW, [], { level: 1, country: 'TW', pick: null })
    expect(out.place).toBeUndefined()
    expect('place' in out).toBe(false)
  })
  it('bigName：慣稱 ≤10 字就留；太長去分店字尾；再太長截 10 字', () => {
    expect(bigName('阿財魯肉飯', '阿財')).toBe('阿財')
    expect(bigName('阿財魯肉飯', '附近的小吃店')).toBe('阿財魯肉飯')
    expect(bigName('八方雲集 台北南京東路店')).toBe('八方雲集')
    expect(bigName('Mr. Wu & Sons 牛肉麵館本店')).toHaveLength(10)
  })
})

describe('國家傳遞（T9、B12 伺服器側）', () => {
  it('日本：捷運 → 電車、地鐵不變成捷運；台灣：地鐵 → 捷運', () => {
    const o = order({ top: '這家你沒去過' }, { steps: ['搭捷運過去。', '從地鐵站出來。'] })
    const jp = run(o, pick('new'), 1, 'JP')
    expect(jp.steps.join('')).not.toContain('捷運')
    expect(jp.steps.join('')).toContain('地下鐵')
    const tw = run(o, pick('new'), 1, 'TW')
    expect(tw.steps.join('')).not.toContain('地鐵')
  })
})

// ── R3 修正（fix-brief SERVER 組）────────────────────────────────────
describe('S-2：「塊」是量詞不是金額', () => {
  it('「點 3 塊雞排」原樣保留；真的金額照拔', () => {
    const out = run(order({ top: '這家你沒去過' }, { steps: ['點 3 塊雞排。', '炸豆腐 2 塊，30元。'] }), pick('new'))
    expect(out.steps[0]).toBe('點 3 塊雞排。')
    expect(out.steps[1]).toContain('炸豆腐 2 塊')
    expect(out.steps[1]).not.toContain('30元')
  })
})

describe('S-6：營業時間照實（T6）', () => {
  const OPEN: PlaceCandidate = { ...PLACE, openUntil: '21:00' }
  const LATER: PlaceCandidate = { id: 'p2', name: '晚開麵館', opensAt: '11:30' }

  it('「營業到／關／打烊」的時間跟 openUntil 不同 → 換成伺服器值；其他時間不動', () => {
    const o = order({ top: '這家你沒去過', bot: '22:00 就關門了，快' }, { steps: ['營業到 22:00，動作快。', '13:00 前吃完。', '9:00 打烊前別去。'] })
    const out = run(o, pick('new', 1, {}, OPEN))
    expect(out.meme.bot).toBe('21:00 就關門了，快')
    expect(out.steps).toEqual(['營業到 21:00，動作快。', '13:00 前吃完。', '21:00 打烊前別去。'])
  })

  it('「開」的時間跟 opensAt 不同 → 換；伺服器沒有 openUntil → 收店時間片段整段刪', () => {
    const o = order({ big: '晚開麵館', top: '這家你沒去過' }, { steps: ['11:00 開門，先去排。', '21:00 打烊。', '開門時間 10:45，別遲到。'] })
    const out = run(o, pick('new', 1, {}, LATER))
    expect(out.steps).toEqual(['11:30 開門，先去排。', '開門時間 11:30，別遲到。'])
  })

  it('營業區間「營業 10:00–23:00」→ 換成「營業到 HH:MM」；對的時間原樣保留', () => {
    const out = run(order({ top: '這家你沒去過' }, { steps: ['營業 10:00–23:00，現在就去。', '營業到 21:00。'] }), pick('new', 1, {}, OPEN))
    expect(out.steps).toEqual(['營業到 21:00，現在就去。', '營業到 21:00。'])
    const same = order({ top: '這家你沒去過' }, { steps: ['營業到 21:00，走。', '12:50 出發。'] })
    expect(run(same, pick('new', 1, {}, OPEN)).steps).toEqual(['營業到 21:00，走。', '12:50 出發。'])
  })

  it('R3R-1：「開動／開吃／開飯／開始吃／關電視」不是營業語境，有沒有 opensAt／openUntil 都原樣保留', () => {
    const steps = ['12:10 開動，12:30 吃完。', '12:05 開吃。', '12:00 開飯，別遲到。', '12:30 開始吃，手機收起來。', '12:50 關電視。']
    for (const place of [OPEN, LATER, { ...PLACE, opensAt: '11:30', openUntil: '21:00' }]) {
      const out = run(order({ top: '這家你沒去過', bot: '12:00 開動' }, { steps }), pick('new', 1, {}, place))
      expect(out.steps).toEqual(steps)
      expect(out.meme.bot).toBe('12:00 開動')
    }
  })

  it('R3R-1：句尾單獨的「開」「關」仍算營業語境', () => {
    const out = run(order({ top: '這家你沒去過' }, { steps: ['11:00 開，先去排。', '22:00 關。'] }), pick('new', 1, {}, { ...PLACE, opensAt: '11:30', openUntil: '21:00' }))
    expect(out.steps).toEqual(['11:30 開，先去排。', '21:00 關。'])
  })
})
