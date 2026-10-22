// W4：價位檔位、國家判定、顯示字串（DEV-PLAN-3 B9）。純函式，不碰 I/O。
import { describe, expect, it } from 'vitest'
import { CUTS, amountsIn, bandLabels, bandOf, countryOf, currencyCountry, priceFit, priceText } from '../../src/price.ts'
import type { PriceLevel } from '../../src/types.ts'

describe('countryOf（座標 → 國家，B9）', () => {
  it('台北、東京、沖繩、金門、其他五點', () => {
    expect(countryOf({ lat: 25.033, lng: 121.5654 })).toBe('TW') // 台北 101
    expect(countryOf({ lat: 35.6812, lng: 139.7671 })).toBe('JP') // 東京車站
    expect(countryOf({ lat: 26.2124, lng: 127.6809 })).toBe('JP') // 那霸（緯度在台灣框內，但經度在台灣框外）
    expect(countryOf({ lat: 24.4493, lng: 118.3767 })).toBe('TW') // 金門
    expect(countryOf({ lat: 22.3193, lng: 114.1694 })).toBe('other') // 香港
  })
  it('沒有座標或座標不是有限數 → 預設 TW', () => {
    expect(countryOf(undefined)).toBe('TW')
    expect(countryOf({ lat: NaN, lng: 121 })).toBe('TW')
    expect(countryOf({ lat: 25, lng: Infinity })).toBe('TW')
  })
  it('邊界：框線上算在框內，框外算 other', () => {
    expect(countryOf({ lat: 21.5, lng: 118.0 })).toBe('TW')
    expect(countryOf({ lat: 26.5, lng: 122.5 })).toBe('TW')
    expect(countryOf({ lat: 24.0, lng: 122.9 })).toBe('JP')
    expect(countryOf({ lat: 45.6, lng: 146.0 })).toBe('JP')
    expect(countryOf({ lat: 45.7, lng: 140 })).toBe('other')
    expect(countryOf({ lat: 35, lng: 146.1 })).toBe('other')
  })
  it('其他地區：上海、新加坡、舊金山都是 other', () => {
    expect(countryOf({ lat: 31.2304, lng: 121.4737 })).toBe('other')
    expect(countryOf({ lat: 1.3521, lng: 103.8198 })).toBe('other')
    expect(countryOf({ lat: 37.7749, lng: -122.4194 })).toBe('other')
  })
})

describe('currencyCountry', () => {
  it('TWD→TW、JPY→JP，其餘 undefined', () => {
    expect(currencyCountry('TWD')).toBe('TW')
    expect(currencyCountry('JPY')).toBe('JP')
    expect(currencyCountry('USD')).toBeUndefined()
    expect(currencyCountry('twd')).toBeUndefined()
    expect(currencyCountry('')).toBeUndefined()
    expect(currencyCountry(undefined)).toBeUndefined()
  })
})

describe('bandOf（B9 五種情況）', () => {
  it('① TWD priceRange：用中點對 150／400／1000 切', () => {
    expect(bandOf({ priceRange: { start: 0, end: 150, currency: 'TWD' } }, 'TW')).toBe(1) // 中點 75
    expect(bandOf({ priceRange: { start: 150, end: 400, currency: 'TWD' } }, 'TW')).toBe(2) // 中點 275
    expect(bandOf({ priceRange: { start: 400, end: 1000, currency: 'TWD' } }, 'TW')).toBe(3) // 中點 700
    expect(bandOf({ priceRange: { start: 1000, end: 2000, currency: 'TWD' } }, 'TW')).toBe(4) // 中點 1500
  })
  it('切點本身歸較低一檔（≤ 切點）', () => {
    expect(bandOf({ priceRange: { start: 100, end: 200, currency: 'TWD' } }, 'TW')).toBe(1) // 中點 150
    expect(bandOf({ priceRange: { start: 300, end: 500, currency: 'TWD' } }, 'TW')).toBe(2) // 中點 400
    expect(bandOf({ priceRange: { start: 800, end: 1200, currency: 'TWD' } }, 'TW')).toBe(3) // 中點 1000
    expect(bandOf({ priceRange: { start: 100, end: 202, currency: 'TWD' } }, 'TW')).toBe(2) // 中點 151
  })
  it('② JPY priceRange：用 1000／2500／6000 切', () => {
    expect(bandOf({ priceRange: { start: 500, end: 1000, currency: 'JPY' } }, 'JP')).toBe(1)
    expect(bandOf({ priceRange: { start: 1000, end: 2000, currency: 'JPY' } }, 'JP')).toBe(2)
    expect(bandOf({ priceRange: { start: 2000, end: 4000, currency: 'JPY' } }, 'JP')).toBe(3)
    expect(bandOf({ priceRange: { start: 5000, end: 10000, currency: 'JPY' } }, 'JP')).toBe(4)
  })
  it('③ 無上限（只有 start）：mid = start × 1.3', () => {
    expect(bandOf({ priceRange: { start: 1000, currency: 'TWD' } }, 'TW')).toBe(4) // 1300
    expect(bandOf({ priceRange: { start: 100, currency: 'TWD' } }, 'TW')).toBe(1) // 130
    expect(bandOf({ priceRange: { start: 6000, currency: 'JPY' } }, 'JP')).toBe(4) // 7800
    expect(bandOf({ priceRange: { start: 2000, currency: 'JPY' } }, 'JP')).toBe(3) // 2600
  })
  it('④ 只有 priceLevel：粗映射（可為 x.5）', () => {
    expect(bandOf({ priceLevel: 'PRICE_LEVEL_INEXPENSIVE' }, 'TW')).toBe(1.5)
    expect(bandOf({ priceLevel: 'PRICE_LEVEL_MODERATE' }, 'TW')).toBe(2.5)
    expect(bandOf({ priceLevel: 'PRICE_LEVEL_EXPENSIVE' }, 'JP')).toBe(3.5)
    expect(bandOf({ priceLevel: 'PRICE_LEVEL_VERY_EXPENSIVE' }, 'JP')).toBe(4)
  })
  it('⑤ 無資料 → null', () => {
    expect(bandOf({}, 'TW')).toBeNull()
    expect(bandOf({ priceRange: {} }, 'TW')).toBeNull()
    expect(bandOf({ priceRange: { currency: 'TWD' } }, 'TW')).toBeNull() // 有幣別但沒有 start
    expect(bandOf({ priceRange: { start: NaN, currency: 'TWD' } }, 'TW')).toBeNull()
  })
  it('priceRange 與 priceLevel 同時有 → 以金額為準', () => {
    expect(bandOf({ priceLevel: 'PRICE_LEVEL_VERY_EXPENSIVE', priceRange: { start: 50, end: 150, currency: 'TWD' } }, 'TW')).toBe(1)
  })
  it('幣別優先於座標：日本座標回 TWD → 用台灣切點；台灣座標回 JPY → 用日本切點', () => {
    expect(bandOf({ priceRange: { start: 150, end: 400, currency: 'TWD' } }, 'JP')).toBe(2)
    expect(bandOf({ priceRange: { start: 1000, end: 2500, currency: 'JPY' } }, 'TW')).toBe(2)
  })
  it('沒有幣別 → 用座標國的切點', () => {
    expect(bandOf({ priceRange: { start: 150, end: 400 } }, 'TW')).toBe(2)
    expect(bandOf({ priceRange: { start: 150, end: 400 } }, 'JP')).toBe(1) // 275 ≤ 1000
  })
  it('country=other：金額不換算（沒有切點），只用 priceLevel', () => {
    expect(bandOf({ priceRange: { start: 10, end: 20, currency: 'USD' } }, 'other')).toBeNull()
    expect(bandOf({ priceRange: { start: 10, end: 20, currency: 'USD' }, priceLevel: 'PRICE_LEVEL_MODERATE' }, 'other')).toBe(2.5)
    expect(bandOf({ priceLevel: 'PRICE_LEVEL_EXPENSIVE' }, 'other')).toBe(3.5)
  })
  it('CUTS 與契約一致', () => {
    expect(CUTS.TW).toEqual([150, 400, 1000])
    expect(CUTS.JP).toEqual([1000, 2500, 6000])
  })
  it('FREE 與 UNSPECIFIED 都是 null', () => {
    const free = ['PRICE_LEVEL', 'FREE'].join('_') as PriceLevel
    const unspecified = ['PRICE_LEVEL', 'UNSPECIFIED'].join('_') as PriceLevel
    expect(bandOf({ priceLevel: free }, 'TW')).toBeNull()
    expect(bandOf({ priceLevel: unspecified }, 'TW')).toBeNull()
  })
})

describe('priceFit 全表', () => {
  it('wanted 空／undefined = 不限 → 1（band 是什麼都一樣，包含 null；strict 也一樣）', () => {
    for (const b of [null, 1, 2.5, 4]) {
      expect(priceFit(b, undefined)).toBe(1)
      expect(priceFit(b, [])).toBe(1)
      expect(priceFit(b, [], true)).toBe(1)
    }
  })
  it('命中 1.0：整數 band 在 wanted 內', () => {
    expect(priceFit(1, [1])).toBe(1)
    expect(priceFit(2, [1, 2])).toBe(1)
    expect(priceFit(3, [2, 3, 4])).toBe(1)
    expect(priceFit(4, [3, 4])).toBe(1)
  })
  it('x.5 同時落在兩檔，任一檔在 wanted 內都算命中', () => {
    expect(priceFit(1.5, [1])).toBe(1)
    expect(priceFit(1.5, [2])).toBe(1)
    expect(priceFit(2.5, [3])).toBe(1)
    expect(priceFit(3.5, [3, 4])).toBe(1)
  })
  it('相鄰 0.35（含 x.5 取最近）', () => {
    expect(priceFit(2, [1])).toBe(0.35)
    expect(priceFit(1, [2])).toBe(0.35)
    expect(priceFit(3, [1, 2])).toBe(0.35)
    expect(priceFit(4, [2, 3])).toBe(0.35)
    expect(priceFit(2.5, [1])).toBe(0.35)
    expect(priceFit(1.5, [3])).toBe(0.35)
  })
  it('未知 0.5', () => {
    expect(priceFit(null, [1])).toBe(0.5)
    expect(priceFit(null, [2, 3])).toBe(0.5)
    expect(priceFit(NaN, [1])).toBe(0.5)
  })
  it('其餘 0（差 ≥ 2 檔）', () => {
    expect(priceFit(3, [1])).toBe(0)
    expect(priceFit(4, [1, 2])).toBe(0)
    expect(priceFit(1, [3])).toBe(0)
    expect(priceFit(1, [4])).toBe(0)
    expect(priceFit(1.5, [4])).toBe(0)
  })
  it('strict：相鄰與未知都 0；命中仍是 1', () => {
    expect(priceFit(2, [1], true)).toBe(0)
    expect(priceFit(null, [1], true)).toBe(0)
    expect(priceFit(NaN, [1], true)).toBe(0)
    expect(priceFit(3, [1], true)).toBe(0)
    expect(priceFit(1, [1], true)).toBe(1)
    expect(priceFit(1.5, [2], true)).toBe(1)
  })
  it('B2 對應：budget:[1] 時，偏高價位一律 0、平價命中', () => {
    expect(priceFit(bandOf({ priceLevel: 'PRICE_LEVEL_EXPENSIVE' }, 'TW'), [1])).toBe(0)
    expect(priceFit(bandOf({ priceLevel: 'PRICE_LEVEL_VERY_EXPENSIVE' }, 'TW'), [1])).toBe(0)
    expect(priceFit(bandOf({ priceLevel: 'PRICE_LEVEL_INEXPENSIVE' }, 'TW'), [1])).toBe(1)
    expect(priceFit(bandOf({ priceLevel: 'PRICE_LEVEL_MODERATE' }, 'TW'), [1])).toBe(0.35)
  })
})

describe('bandLabels', () => {
  it('台灣：≤150／150–400／400–1,000／1,000+', () => {
    expect(bandLabels('TW')).toEqual([
      { band: 1, label: '≤150' },
      { band: 2, label: '150–400' },
      { band: 3, label: '400–1,000' },
      { band: 4, label: '1,000+' },
    ])
  })
  it('日本：〜¥1,000／¥1,000〜2,500／¥2,500〜6,000／¥6,000〜', () => {
    expect(bandLabels('JP')).toEqual([
      { band: 1, label: '〜¥1,000' },
      { band: 2, label: '¥1,000〜2,500' },
      { band: 3, label: '¥2,500〜6,000' },
      { band: 4, label: '¥6,000〜' },
    ])
  })
  it('other → 空陣列（預算列隱藏）', () => {
    expect(bandLabels('other')).toEqual([])
  })
  it('用金額文字，不用 $$$；檔位升冪且每國 4 檔', () => {
    for (const c of ['TW', 'JP'] as const) {
      const ls = bandLabels(c)
      expect(ls.map((x) => x.band)).toEqual([1, 2, 3, 4])
      expect(ls.every((x) => !x.label.includes('$$'))).toBe(true)
      expect(ls.every((x) => /\d/.test(x.label))).toBe(true)
    }
  })
  it('標籤文字的切點與 CUTS 一致（改一邊忘了另一邊就會紅）', () => {
    const nums = (s: string) => (s.match(/\d[\d,]*/g) ?? []).map((x) => Number(x.replace(/,/g, '')))
    for (const c of ['TW', 'JP'] as const) {
      const [c0, c1, c2] = CUTS[c]
      expect(bandLabels(c).map((x) => nums(x.label))).toEqual([[c0], [c0, c1], [c1, c2], [c2]])
    }
  })
})

describe('priceText（T6：只用 Google 當次回傳值，不發明數字）', () => {
  it('TWD 區間與無上限：≈NT$150–400、≈NT$1,000+', () => {
    expect(priceText({ priceRange: { start: 150, end: 400, currency: 'TWD' } }, 'TW')).toBe('≈NT$150–400')
    expect(priceText({ priceRange: { start: 1000, end: 2500, currency: 'TWD' } }, 'TW')).toBe('≈NT$1,000–2,500')
    expect(priceText({ priceRange: { start: 1000, currency: 'TWD' } }, 'TW')).toBe('≈NT$1,000+')
  })
  it('JPY 區間與無上限：≈¥1,000〜2,500／≈¥6,000〜', () => {
    expect(priceText({ priceRange: { start: 1000, end: 2500, currency: 'JPY' } }, 'JP')).toBe('≈¥1,000〜2,500')
    expect(priceText({ priceRange: { start: 6000, currency: 'JPY' } }, 'JP')).toBe('≈¥6,000〜')
  })
  it('沒有幣別 → 以座標國的幣別顯示；幣別以 Google 為準', () => {
    expect(priceText({ priceRange: { start: 150, end: 400 } }, 'TW')).toBe('≈NT$150–400')
    expect(priceText({ priceRange: { start: 1000, end: 2500 } }, 'JP')).toBe('≈¥1,000〜2,500')
    expect(priceText({ priceRange: { start: 150, end: 400, currency: 'TWD' } }, 'JP')).toBe('≈NT$150–400')
  })
  it('其他幣別照實顯示幣別代碼，不換算', () => {
    expect(priceText({ priceRange: { start: 10, end: 20, currency: 'USD' } }, 'TW')).toBe('≈USD 10–20')
  })
  it('只有 priceLevel → Google 的價位描述文字，不換算成金額', () => {
    expect(priceText({ priceLevel: 'PRICE_LEVEL_INEXPENSIVE' }, 'TW')).toBe('平價')
    expect(priceText({ priceLevel: 'PRICE_LEVEL_MODERATE' }, 'TW')).toBe('中價位')
    expect(priceText({ priceLevel: 'PRICE_LEVEL_EXPENSIVE' }, 'JP')).toBe('偏高價位')
    expect(priceText({ priceLevel: 'PRICE_LEVEL_VERY_EXPENSIVE' }, 'JP')).toBe('高價位')
  })
  it('沒有資料 → undefined（口令卡顯示「價位未知」）', () => {
    const free = ['PRICE_LEVEL', 'FREE'].join('_') as PriceLevel
    const unspecified = ['PRICE_LEVEL', 'UNSPECIFIED'].join('_') as PriceLevel
    expect(priceText({}, 'TW')).toBeUndefined()
    expect(priceText({ priceLevel: free }, 'TW')).toBeUndefined()
    expect(priceText({ priceLevel: unspecified }, 'TW')).toBeUndefined()
    expect(priceText({ priceRange: {} }, 'TW')).toBeUndefined()
    expect(priceText({ priceRange: { end: 400, currency: 'TWD' } }, 'TW')).toBeUndefined() // 只有 end 不是合法區間
  })
  it('country=other 且沒有幣別 → 不顯示金額，退回 priceLevel 文字', () => {
    expect(priceText({ priceRange: { start: 10, end: 20 }, priceLevel: 'PRICE_LEVEL_MODERATE' }, 'other')).toBe('中價位')
    expect(priceText({ priceRange: { start: 10, end: 20 } }, 'other')).toBeUndefined()
  })
  it('不發明數字：只有 priceLevel 時輸出完全沒有數字', () => {
    const levels = ['INEXPENSIVE', 'MODERATE', 'EXPENSIVE', 'VERY_EXPENSIVE', 'FREE', 'UNSPECIFIED'].map((s) => `PRICE_LEVEL_${s}` as PriceLevel)
    for (const priceLevel of levels) for (const c of ['TW', 'JP', 'other'] as const) {
      const t = priceText({ priceLevel }, c)
      if (t !== undefined) expect(t, `${priceLevel}/${c}`).not.toMatch(/\d/)
    }
  })
  it('不發明數字：有 priceRange 時，輸出的每個數字都是輸入給的', () => {
    const ranges: { start: number; end?: number; currency: string }[] = [
      { start: 150, end: 400, currency: 'TWD' },
      { start: 1234, end: 5678, currency: 'JPY' },
      { start: 80, end: 90, currency: 'TWD' },
      { start: 3000, currency: 'JPY' },
    ]
    for (const priceRange of ranges) {
      const t = priceText({ priceRange, priceLevel: 'PRICE_LEVEL_VERY_EXPENSIVE' }, 'TW')!
      const given = [priceRange.start, priceRange.end].filter((x): x is number => x !== undefined).map((n) => n.toLocaleString('en-US'))
      const shown = t.match(/\d[\d,]*/g)!
      expect(shown.length, t).toBe(given.length)
      for (const s of shown) expect(given, t).toContain(s)
    }
  })
})

describe('amountsIn', () => {
  it('NT$、¥、元、円、塊', () => {
    expect(amountsIn('這家人均 NT$120')).toEqual(['NT$120'])
    expect(amountsIn('一碗 ¥1,000 就飽')).toEqual(['¥1,000'])
    expect(amountsIn('便當 120元')).toEqual(['120元'])
    expect(amountsIn('定食 1000円')).toEqual(['1000円'])
    expect(amountsIn('1,200 円 起')).toEqual(['1,200 円'])
    expect(amountsIn('三十塊 / 50塊')).toEqual(['50塊'])
    expect(amountsIn('一碗 ￥800')).toEqual(['￥800'])
  })
  it('金額區間算一個片段：NT$150–400、¥1,000〜2,500、150-400元', () => {
    expect(amountsIn('預算 NT$150–400')).toEqual(['NT$150–400'])
    expect(amountsIn('預算 ¥1,000〜2,500')).toEqual(['¥1,000〜2,500'])
    expect(amountsIn('預算 150-400元')).toEqual(['150-400元'])
    expect(amountsIn('預算 NT$150~400')).toEqual(['NT$150~400'])
  })
  it('沒有幣別記號的數字區間不抓：10–15 分鐘、11:30–14:00、150–400', () => {
    expect(amountsIn('步行 10–15 分鐘')).toEqual([])
    expect(amountsIn('營業 11:30–14:00')).toEqual([])
    expect(amountsIn('走 6 分鐘，營業到 21:00')).toEqual([])
    expect(amountsIn('150–400')).toEqual([])
    expect(amountsIn('第 3 次，今天第 12 道口令')).toEqual([])
  })
  it('多個金額：保留出現順序、去重；沒有金額 → 空陣列', () => {
    expect(amountsIn('NT$120 或 ¥1,000，再加 NT$120')).toEqual(['NT$120', '¥1,000'])
    expect(amountsIn('先 50元，再 NT$200，最後 80元')).toEqual(['50元', 'NT$200', '80元'])
    expect(amountsIn('')).toEqual([])
    expect(amountsIn('去吃熱的，吃完回報。')).toEqual([])
  })
  it('被更具體的規則抓過的區間不重複計：「NT$150–400 元」只有一個片段', () => {
    const r = amountsIn('NT$150–400 元')
    expect(r.length).toBe(1)
    expect(r[0]).toContain('NT$150')
  })
  it('priceText 產出的金額都能被 amountsIn 抓到（rules 比對得起來）', () => {
    const cases: [{ start: number; end?: number; currency: string }, 'TW' | 'JP'][] = [
      [{ start: 150, end: 400, currency: 'TWD' }, 'TW'],
      [{ start: 1000, currency: 'TWD' }, 'TW'],
      [{ start: 1000, end: 2500, currency: 'JPY' }, 'JP'],
      [{ start: 6000, currency: 'JPY' }, 'JP'],
    ]
    for (const [pr, c] of cases) {
      const t = priceText({ priceRange: pr }, c)!
      expect(amountsIn(t).length, t).toBeGreaterThan(0)
      expect(amountsIn(t).every((a) => t.includes(a)), t).toBe(true)
    }
  })
})
