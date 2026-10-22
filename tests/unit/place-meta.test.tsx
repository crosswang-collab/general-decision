// @vitest-environment jsdom
// T10、T6：口令卡的店家資訊列與 Google Maps 歸屬。
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StepsCard, formatPlaceMeta } from '../../src/meme.tsx'

describe('口令卡 place-meta', () => {
  it('步行、營業到、價位文字照 API 值組合', () => {
    expect(formatPlaceMeta({ name: 'x', walkMin: 6, openUntil: '21:00', priceText: '≈NT$150–400' }))
      .toBe('步行 6 分 · 營業到 21:00 · ≈NT$150–400')
  })
  it('價位沒資料寫價位未知；還沒開門寫 HH:MM 開（opensAt 優先）', () => {
    expect(formatPlaceMeta({ name: 'x', walkMin: 3, opensAt: '11:30', openUntil: '21:00' })).toBe('步行 3 分 · 11:30 開 · 價位未知')
  })
  it('沒有的欄位就不寫；步行 0 分也要寫', () => {
    expect(formatPlaceMeta({ name: 'x' })).toBe('價位未知')
    expect(formatPlaceMeta({ name: 'x', walkMin: 0 })).toBe('步行 0 分 · 價位未知')
  })
  it('有店就畫 place-meta 與歸屬（translate=no）；沒有店都不畫', () => {
    const a = render(<StepsCard steps={['一。']} place={{ name: '阿財魯肉飯', walkMin: 6, priceText: '平價' }} />)
    expect(a.getByTestId('place-meta').textContent).toBe('步行 6 分 · 平價')
    const attr = a.getByTestId('attribution')
    expect(attr.textContent).toBe('Google Maps')
    expect(attr.getAttribute('translate')).toBe('no')
    a.unmount()
    const b = render(<StepsCard steps={['一。']} />)
    expect(b.queryByTestId('place-meta')).toBeNull()
    expect(b.queryByTestId('attribution')).toBeNull()
  })
})
