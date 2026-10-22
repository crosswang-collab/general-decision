// Round 3：除錯畫面的選店與價位文字。
import { describe, expect, it } from 'vitest'
import { formatDebug, formatPick, formatPrice } from '../../src/debug.ts'

describe('除錯文字', () => {
  it('formatPick 與 formatPrice 一行講完，不含 place_id', () => {
    expect(formatPick({ mode: 'new', lane: 'ramen_restaurant', pool: 23, afterFilter: 17, relaxed: [], exhausted: false }))
      .toBe('mode=new lane=ramen_restaurant 池=23 過濾後=17')
    expect(formatPick({ mode: 'wildcard', lane: 'restaurant', pool: 8, afterFilter: 3, relaxed: ['floor', 'cooldown'], exhausted: true }))
      .toBe('mode=wildcard lane=restaurant 池=8 過濾後=3 放寬=floor+cooldown 已全數占領')
    expect(formatPrice({ country: 'JP', known: 6, total: 20 })).toBe('JP 有價位 6/20')
  })

  it('formatDebug 帶出選店與價位兩行', () => {
    const text = formatDebug([{
      at: '2026-10-22T12:00:00.000Z', module: 'eat', level: 1,
      pick: { mode: 'revisit', lane: 'cafe', pool: 5, afterFilter: 5, relaxed: [], exhausted: false },
      price: { country: 'TW', known: 2, total: 5 },
    }])
    expect(text).toContain('選店 mode=revisit lane=cafe')
    expect(text).toContain('價位 TW 有價位 2/5')
  })
})
