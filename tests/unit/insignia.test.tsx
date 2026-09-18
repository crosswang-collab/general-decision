// 階段 C-1：士官階級章。查證狀態見 src/insignia.tsx 檔頭（待核），這裡驗的是「資料結構與渲染」不是「軍事事實」。
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { InsigniaMark } from '../../src/insignia.tsx'
import { NCO_INSIGNIA, insigniaKey } from '../../src/insignia.ts'
import { OFFICERS } from '../../src/officers.ts'

describe('士官六階資料（待核的二手規則，先鎖住形狀）', () => {
  it('士官 1 粗、士官長 2 粗；細槓各 1／2／3', () => {
    expect(NCO_INSIGNIA.下士).toEqual({ thick: 1, thin: 1 })
    expect(NCO_INSIGNIA.中士).toEqual({ thick: 1, thin: 2 })
    expect(NCO_INSIGNIA.上士).toEqual({ thick: 1, thin: 3 })
    expect(NCO_INSIGNIA.三等士官長).toEqual({ thick: 2, thin: 1 })
    expect(NCO_INSIGNIA.二等士官長).toEqual({ thick: 2, thin: 2 })
    expect(NCO_INSIGNIA.一等士官長).toEqual({ thick: 2, thin: 3 })
  })

  it('六階互不相同', () => {
    const keys = Object.values(NCO_INSIGNIA).map(insigniaKey)
    expect(new Set(keys).size).toBe(6)
  })
})

describe('三位班長的階級與職務（C-2 觀念修正：職務 ≠ 階級）', () => {
  it('職務與階級分開，階級都在士官六階內', () => {
    for (const o of OFFICERS) {
      expect(Object.keys(NCO_INSIGNIA), `${o.name} 的階級 ${o.rank}`).toContain(o.rank)
      expect(o.duty, `${o.name} 的職務`).toMatch(/(班長|連士官長)$/)
      expect(o.insignia).toEqual(NCO_INSIGNIA[o.rank])
    }
  })

  it('三枚徽章互不相同（C-5 驗收 1）', () => {
    const keys = OFFICERS.map((o) => insigniaKey(o.insignia))
    expect(new Set(keys).size).toBe(3)
  })

  it('人設對得上：阿良剛下部隊是下士；老郭的「士官長」拆成 階級=三等士官長、職務=連士官長', () => {
    expect(OFFICERS[0]!.rank).toBe('下士')
    expect(OFFICERS[1]!.rank).toBe('中士')
    expect(OFFICERS[2]!.rank).toBe('三等士官長')
    expect(OFFICERS[2]!.duty).toBe('連士官長')
  })
})

describe('<InsigniaMark>', () => {
  it('粗細槓數量渲染正確，且有 data-insignia 供 e2e 抓', () => {
    for (const o of OFFICERS) {
      const { container, unmount } = render(<InsigniaMark insignia={o.insignia} title={o.rank} />)
      const svg = container.querySelector('svg')!
      expect(svg.getAttribute('data-insignia')).toBe(insigniaKey(o.insignia))
      expect(container.querySelectorAll('[data-bar="thick"]')).toHaveLength(o.insignia.thick)
      expect(container.querySelectorAll('[data-bar="thin"]')).toHaveLength(o.insignia.thin)
      expect(svg.querySelector('title')?.textContent).toBe(o.rank)
      unmount()
    }
  })

  it('士官用 currentColor、士官長用 --brass（待核的顏色假設，集中在一處）', () => {
    const a = render(<InsigniaMark insignia={NCO_INSIGNIA.中士} />)
    expect(a.container.querySelector('polyline')?.getAttribute('stroke')).toBe('currentColor')
    a.unmount()
    const b = render(<InsigniaMark insignia={NCO_INSIGNIA.三等士官長} />)
    expect(b.container.querySelector('polyline')?.getAttribute('stroke')).toBe('var(--brass)')
    b.unmount()
  })
})
