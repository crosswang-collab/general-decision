// B21：mode 替換語料全部 findBanned() 0 命中，且不含「或」「也可以」「備選」（T1、T7）。
import { describe, expect, it } from 'vitest'
import { findBanned } from '../../src/banned.ts'
import { localizeText } from '../../src/locale.ts'
import { MODE_LINES, NEUTRAL_BOT, NEUTRAL_LOG, NEUTRAL_STEP, hasWrongCount, modeLine, nthCounts, parseNth, satisfiesMode } from '../../src/modeLines.ts'
import type { Level } from '../../src/types.ts'

const ALL = [
  ...Object.values(MODE_LINES).flatMap((byLevel) => byLevel.flat()),
  ...NEUTRAL_BOT.flat(),
  NEUTRAL_STEP,
  NEUTRAL_LOG,
]

describe('modeLines 語料（B21）', () => {
  it('每種 × 每個火力 ≥ 4 句', () => {
    for (const [kind, byLevel] of Object.entries(MODE_LINES)) for (const [lv, lines] of byLevel.entries()) expect(lines.length, `${kind}/${lv}`).toBeGreaterThanOrEqual(4)
    for (const lines of NEUTRAL_BOT) expect(lines.length).toBeGreaterThanOrEqual(4)
  })
  it('findBanned 0 命中；不含 或／也可以／備選；台灣用語守門 0 命中', () => {
    for (const s of ALL) {
      expect(findBanned(s), s).toEqual([])
      expect(s, s).not.toMatch(/或|也可以|備選/)
      expect(localizeText(s).hits, s).toEqual([])
      expect(localizeText(s, 'JP').hits, s).toEqual([])
    }
  })
  it('不寫金額、不寫連結；meme.top ≤ 16 字（N=99 也是）', () => {
    for (const s of ALL) expect(s).not.toMatch(/NT|\$|¥|円|元|http/)
    for (const byLevel of Object.values(MODE_LINES)) for (const s of byLevel.flat()) expect(s.replaceAll('{N}', '99').length, s).toBeLessThanOrEqual(16)
  })
  it('每一句都符合自己的 mode；revisit 的 {N} 換成 visits', () => {
    for (const lv of [0, 1, 2] as Level[]) {
      for (let salt = 0; salt < 4; salt++) {
        expect(satisfiesMode(modeLine('new', lv, 1, salt), 'new', 1)).toBe(true)
        expect(satisfiesMode(modeLine('wildcard', lv, 1, salt), 'wildcard', 1)).toBe(true)
        const r = modeLine('revisit', lv, 7, salt)
        expect(r).toContain('第7次')
        expect(satisfiesMode(r, 'revisit', 7)).toBe(true)
        expect(hasWrongCount(modeLine('new', lv, 1, salt), 'new', 1)).toBe(false)
      }
    }
  })
  it('「第 N 次」辨識：阿拉伯數字、全形、國字', () => {
    expect(nthCounts('第 3 次報到，第三次了，第１２次')).toEqual([3, 3, 12])
    expect(parseNth('十二')).toBe(12)
    expect(parseNth('二十')).toBe(20)
    expect(parseNth('兩')).toBe(2)
    expect(hasWrongCount('這是第一次來', 'new', 1)).toBe(false)
    expect(hasWrongCount('這是第三次來', 'new', 1)).toBe(true)
    expect(hasWrongCount('第 4 次', 'revisit', 3)).toBe(true)
  })
})
