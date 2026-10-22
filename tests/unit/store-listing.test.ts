// @vitest-environment node
// B19：docs/round3/STORE-LISTING.md 的商店欄位上限（ASC 規定）。實算，不靠肉眼。
// 解析規則：「## 台灣…」「## 日本…」兩章；章內每個「### 欄位名」底下第一個 fenced 區塊就是欄位內容。
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { findBanned } from '../../src/banned.ts'
import { localizeText } from '../../src/locale.ts'

const md = readFileSync(new URL('../../docs/round3/STORE-LISTING.md', import.meta.url), 'utf8')

type Fields = Record<string, string>

function parse(chapterPrefix: string): Fields {
  const lines = md.split('\n')
  const start = lines.findIndex((l) => l.startsWith('## ') && l.slice(3).startsWith(chapterPrefix))
  expect(start, `找不到章節 ${chapterPrefix}`).toBeGreaterThanOrEqual(0)
  let end = lines.findIndex((l, i) => i > start && l.startsWith('## '))
  if (end < 0) end = lines.length
  const out: Fields = {}
  let field: string | null = null
  let inFence = false
  let buf: string[] = []
  for (const l of lines.slice(start + 1, end)) {
    if (!inFence && l.startsWith('### ')) { field = l.slice(4).trim(); continue }
    if (l.startsWith('```')) {
      if (!inFence) { inFence = true; buf = []; continue }
      inFence = false
      if (field && !(field in out)) out[field] = buf.join('\n')
      continue
    }
    if (inFence) buf.push(l)
  }
  return out
}

const len = (s: string) => [...s].length
const TW = parse('台灣')
const JP = parse('日本')

// 其他 App／公司品牌名不得出現在關鍵字（2.3.7）。「Google」一併擋，歸屬寫在 App 內。
const OTHER_APPS = ['Google', 'Duolingo', 'CARROT', 'Finch', 'Uber', 'foodpanda', 'Foodpanda', 'LINE', 'Instagram', '食べログ', 'Tabelog', 'Beli', '多鄰國']

describe('STORE-LISTING：商店欄位上限（B19）', () => {
  for (const [name, f] of [['台灣', TW], ['日本', JP]] as const) {
    describe(name, () => {
      it('五個欄位都存在且非空', () => {
        for (const k of ['名稱', '副標', '關鍵字', '宣傳文字', '描述']) {
          expect(f[k], `${name} 缺 ${k}`).toBeTruthy()
        }
      })
      it('名稱 ≤ 30 字元', () => { expect(len(f['名稱']!)).toBeLessThanOrEqual(30) })
      it('副標 ≤ 30 字元', () => { expect(len(f['副標']!)).toBeLessThanOrEqual(30) })
      it('關鍵字 Buffer.byteLength ≤ 100（含逗號）', () => {
        const bytes = Buffer.byteLength(f['關鍵字']!, 'utf8')
        console.log(`[store-listing] ${name} 關鍵字 ${bytes} bytes`)
        expect(bytes).toBeLessThanOrEqual(100)
      })
      it('關鍵字：逗號分隔、無空白、無換行、無重複詞', () => {
        const k = f['關鍵字']!
        expect(k).not.toMatch(/\s/)
        const words = k.split(',')
        expect(words.every((w) => w.length > 0)).toBe(true)
        expect(new Set(words).size).toBe(words.length)
      })
      it('關鍵字：不含其他 App 名稱、價格、排名字眼（2.3.7）', () => {
        const k = f['關鍵字']!
        for (const bad of OTHER_APPS) expect(k, bad).not.toContain(bad)
        expect(k).not.toMatch(/免費|free|\$|NT|最佳|第一|No\.?\s?1/i)
      })
      it('關鍵字不重複名稱與副標裡已有的詞', () => {
        const hay = `${f['名稱']}${f['副標']}`
        for (const w of f['關鍵字']!.split(',')) {
          if (len(w) >= 3) expect(hay.includes(w), `重複：${w}`).toBe(false)
        }
      })
      it('宣傳文字 ≤ 170 字元', () => { expect(len(f['宣傳文字']!)).toBeLessThanOrEqual(170) })
      it('描述 ≤ 4000 字元', () => { expect(len(f['描述']!)).toBeLessThanOrEqual(4000) })
      it('不自稱 Editors\' Choice／得獎／榜單名次（5.2.4(b)）', () => {
        const all = Object.values(f).join('\n')
        expect(all).not.toMatch(/Editors['’]? ?Choice|編輯精選|得獎|獲獎|榮獲|排行榜|No\.?\s?1|第一名/i)
      })
    })
  }

  describe('台灣文案品質', () => {
    const all = Object.values(TW).join('\n')
    it('護欄字表 0 命中', () => { expect(findBanned(all)).toEqual([]) })
    it('沒有中國用語殘留（localizeText 不需要替換）', () => {
      expect(localizeText(all).hits).toEqual([])
    })
    it('文案不做過頭承諾（「保證」「每次都是新店」「百分之百」）', () => {
      expect(all).not.toMatch(/保證|每次都是新店|百分之百/)
    })
    it('不放 Google 字樣在商店欄位（歸屬寫在 App 內）', () => {
      expect(TW['關鍵字']).not.toContain('Google')
    })
  })

  it('審核備註 fenced 區塊存在，且聯絡方式用 [CONTACT_EMAIL] 佔位', () => {
    expect(TW['審核備註（English；貼進 App Review Information → Notes）']).toContain('[CONTACT_EMAIL]')
  })

  it('R2§5 必要 1–8 全部在對照表裡有狀態', () => {
    for (let i = 1; i <= 8; i++) expect(md, `必要 ${i}`).toMatch(new RegExp(`\\| ${i} \\|`))
    expect(md).toMatch(/本輪完成/)
    expect(md).toMatch(/\*\*缺\*\*/)
  })
})
