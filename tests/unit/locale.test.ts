// 階段 D：台灣情境用語守門 — 純函式，完全確定性，不打模型。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CN_TO_TW, JP_TRANSIT, PLA_TO_ROC, localizeFields, localizeText, rulesFor, stripUrls } from '../../src/locale.ts'
import { enforceRules, localizeOrder, localizeWeeklyText } from '../../src/rules.ts'
import type { Order } from '../../src/types.ts'

const NOW = new Date('2026-09-11T12:40:00+08:00')
const clean: Order = {
  verdict: 'do',
  meme: { top: '去吃熱的', big: '阿財魯肉飯', bot: '這週兩天超商了' },
  steps: ['步行 6 分鐘，營業到 21:00。', '魯肉飯、滷蛋、燙青菜。', '早點睡，手機收起來。'],
  place: { id: 'p1', name: '阿財魯肉飯' },
  log: '12:41 魯肉飯，12:58 完成。',
}

afterEach(() => vi.restoreAllMocks())

describe('黑名單覆蓋（D-5 驗收 1：D-1 表列全部詞彙）', () => {
  it('D-1 ① 每一個中國用語都有對應的台灣用語', () => {
    const must = ['質量', '視頻', '信息', '屏幕', '默認', '用戶', '激活', '軟件', '網絡', '出租車', '自行車', '盒飯', '早點', '地鐵']
    const covered = CN_TO_TW.map((r) => (typeof r.from === 'string' ? r.from : r.from.source))
    for (const w of must) expect(covered.some((c) => c.includes(w)), w).toBe(true)
  })
  it('D-1 ② 解放軍編制用語（指導員、政委）都有覆蓋', () => {
    const covered = PLA_TO_ROC.map((r) => String(r.from))
    expect(covered).toContain('指導員')
    expect(covered).toContain('政委')
  })
})

describe('localizeText', () => {
  it('中國用語就地替換成台灣用語', () => {
    expect(localizeText('視頻質量太差，看屏幕的信息').text).toBe('影片品質太差，看螢幕的訊息')
    expect(localizeText('坐出租車去地鐁站').text).toBe('坐計程車去地鐁站') // 「地鐁」是錯字，不是地鐵，不動
    expect(localizeText('搭地鐵、騎自行車、買盒飯').text).toBe('搭捷運、騎腳踏車、買便當')
    expect(localizeText('默認用戶要先激活軟件才有網絡').text).toBe('預設使用者要先啟用軟體才有網路')
  })
  it('解放軍編制用語 → 國軍編制（輔導長）', () => {
    expect(localizeText('去找指導員報告').text).toBe('去找輔導長報告')
    expect(localizeText('政委說了算').text).toBe('輔導長說了算')
    expect(localizeText('政治指導員').text).toBe('輔導長')
  })
  it('「早點」只抓名詞用法：吃早點 / 早點店 → 早餐；「早點睡」不動', () => {
    expect(localizeText('去吃早點').text).toBe('去吃早餐')
    expect(localizeText('巷口那家早點店').text).toBe('巷口那家早餐店')
    expect(localizeText('早點睡，早點去。').text).toBe('早點睡，早點去。')
    expect(localizeText('早點睡，早點去。').hits).toEqual([])
  })
  it('乾淨的台灣用語原樣通過，一個字都不動（D-5 驗收 3）', () => {
    const s = '你各位啊，一個口令一個動作。搭捷運去吃便當，回寢室早點睡。品質、影片、螢幕都對。'
    const r = localizeText(s)
    expect(r.text).toBe(s)
    expect(r.hits).toEqual([])
  })
  it('已知誤判（文件化，刻意接受）：只做詞彙層替換', () => {
    // 「質量守恆」的「質量」是物理量，會被誤改成「品質守恆」。決斷連的口令裡不會出現物理課，接受。
    expect(localizeText('質量守恆').text).toBe('品質守恆')
    // 「信息」在台灣有時指「資訊」而非「訊息」，統一取「訊息」（reply 模組語境）。
    expect(localizeText('資訊安全與信息安全').text).toBe('資訊安全與訊息安全')
  })
})

describe('stripUrls（規則 8：模型永遠不准產生 URL）', () => {
  it('拔掉 http(s) 連結，其餘文字保留', () => {
    expect(stripUrls('看這裡 https://maps.google.com/?q=abc 然後走').text).toBe('看這裡 然後走')
    expect(stripUrls('http://a.b/c').text).toBe('')
    expect(stripUrls('沒有連結').hits).toBe(0)
  })
})

describe('localizeOrder / enforceRules 接線', () => {
  it('meme.top / big / bot / steps[] / log 都被掃到', () => {
    const dirty: Order = {
      ...clean,
      meme: { top: '視頻看完了嗎', big: '去吃盒飯', bot: '信息別回' },
      steps: ['坐出租車。', '去找指導員。'],
      log: '用戶去了地鐵站。',
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const out = localizeOrder(dirty)
    expect(out.meme).toEqual({ top: '影片看完了嗎', big: '去吃便當', bot: '訊息別回' })
    expect(out.steps).toEqual(['坐計程車。', '去找輔導長。'])
    expect(out.log).toBe('使用者去了捷運站。')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('[locale]')
  })
  it('乾淨的 Order 回傳同一個 reference，不 warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(localizeOrder(clean)).toBe(clean)
    expect(warn).not.toHaveBeenCalled()
  })
  it('模型在文字裡混進 URL → 被拔掉；模型自己填的 place.mapUrl → 丟掉', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const dirty = {
      ...clean,
      steps: ['走過去 https://www.google.com/maps/place/x 就到。'],
      place: { id: 'p1', name: '阿財魯肉飯', mapUrl: 'https://evil.example/hallucinated' },
    } as Order
    const out = localizeOrder(dirty)
    expect(out.steps).toEqual(['走過去 就到。'])
    expect(out.place).toEqual({ id: 'p1', name: '阿財魯肉飯' })
    expect(JSON.stringify(out)).not.toContain('http')
  })
  it('enforceRules 的每一條路徑（attend / buy / reply / 其他）都會經過守門', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const dirty: Order = { ...clean, log: '用戶完成。' }
    expect(enforceRules(dirty, 'attend', { stars: 2, occasion: '飯局' }, NOW, []).log).toBe('使用者完成。')
    expect(enforceRules(dirty, 'buy', {}, NOW, []).log).toBe('使用者完成。')
    expect(enforceRules({ ...dirty, verdict: 'stop' }, 'reply', {}, NOW, []).log).toBe('使用者完成。')
    expect(enforceRules(dirty, 'eat', {}, NOW, []).log).toBe('使用者完成。')
    // 硬規則仍然生效
    expect(enforceRules(dirty, 'attend', { stars: 2, occasion: '飯局' }, NOW, []).verdict).toBe('stop')
  })
})

describe('週報路徑（D-3 ③：body 不經 enforceRules，另外接）', () => {
  it('body 與 verdict 都被守門', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const r = localizeWeeklyText('本週視頻看太多，信息回太慢。', '本週講評：質量不行。')
    expect(r.body).toBe('本週影片看太多，訊息回太慢。')
    expect(r.verdict).toBe('本週講評：品質不行。')
  })
  it('乾淨週報原樣通過', () => {
    const r = localizeWeeklyText('本週口令 5 道，服從率 80%。只在不用出門的事上偷懶。下週晚上十點前熄燈。', '本週講評：合格。')
    expect(r.body).toBe('本週口令 5 道，服從率 80%。只在不用出門的事上偷懶。下週晚上十點前熄燈。')
    expect(r.verdict).toBe('本週講評：合格。')
  })
})

// ── Round 3 B12／T9：在哪裡就照哪裡的規矩（以下為追加，上面既有斷言不動）──
describe('B12：日本座標不產生「捷運」', () => {
  it('JP：地鐵 → 地下鐵；捷運站 → 車站；捷運 → 電車；不套「地鐵→捷運」', () => {
    expect(localizeText('搭地鐵去', 'JP').text).toBe('搭地下鐵去')
    expect(localizeText('走到捷運站', 'JP').text).toBe('走到車站')
    expect(localizeText('搭捷運過去', 'JP').text).toBe('搭電車過去')
    expect(localizeText('地鐵、捷運站、捷運', 'JP').text).toBe('地下鐵、車站、電車')
    expect(localizeText('搭地鐵、騎自行車', 'JP').text).not.toContain('捷運')
  })
  it('JP 仍套其他規則（出租車、盒飯、指導員）', () => {
    expect(localizeText('坐出租車買盒飯', 'JP').text).toBe('坐計程車買便當')
    expect(localizeText('去找指導員', 'JP').text).toBe('去找輔導長')
  })
  it('TW 與未帶國家：維持「地鐵 → 捷運」，也不會把捷運改成電車', () => {
    expect(localizeText('搭地鐵去').text).toBe('搭捷運去')
    expect(localizeText('搭地鐵去', 'TW').text).toBe('搭捷運去')
    expect(localizeText('搭捷運去', 'TW').text).toBe('搭捷運去')
    expect(localizeText('搭捷運去', 'TW').hits).toEqual([])
    expect(localizeText('搭地鐵去', 'other').text).toBe('搭捷運去')
  })
  it('rulesFor：JP 不含「地鐵→捷運」；TW 不含任何 JP 交通規則', () => {
    expect(rulesFor('JP').some((r) => r.from === '地鐵' && r.to === '捷運')).toBe(false)
    expect(rulesFor('TW').some((r) => JP_TRANSIT.includes(r))).toBe(false)
    expect(rulesFor().length).toBe(rulesFor('TW').length)
  })
  it('localizeFields 傳遞 country：meme／steps／log 在日本都不出現「捷運」，在台灣不出現「地下鐵」「電車」「¥」', () => {
    const dirty = { top: '搭地鐵去', steps: ['走到捷運站。', '再搭捷運。'], log: '用戶搭地鐵。' }
    const jp = localizeFields(dirty, ['top', 'steps', 'log'], 'JP')
    expect(jp.value.top).toBe('搭地下鐵去')
    expect(jp.value.steps).toEqual(['走到車站。', '再搭電車。'])
    expect(jp.value.log).toBe('使用者搭地下鐵。')
    expect(JSON.stringify(jp.value)).not.toContain('捷運')
    const tw = localizeFields(dirty, ['top', 'steps', 'log'], 'TW')
    expect(tw.value.top).toBe('搭捷運去')
    expect(tw.value.steps).toEqual(['走到捷運站。', '再搭捷運。'])
    expect(JSON.stringify(tw.value)).not.toMatch(/地下鐵|電車|¥/)
  })
  it('localizeFields 沒命中 → 同一個 reference（country 不影響零成本判斷）', () => {
    const clean2 = { top: '去吃熱的', steps: ['步行 6 分鐘。'] }
    expect(localizeFields(clean2, ['top', 'steps'], 'JP').value).toBe(clean2)
    expect(localizeFields(clean2, ['top', 'steps'], 'JP').hits).toEqual([])
  })
})
