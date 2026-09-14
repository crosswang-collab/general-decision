import { describe, expect, it } from 'vitest'
import { OFFICERS, OFFICER_BY_LEVEL, sampleCorpus } from '../../src/officers.ts'
import { findBanned } from '../../src/banned.ts'
import { MODULE_BARKS } from '../../src/cards.ts'

describe('officers（第 13.1 節）', () => {
  it('共 3 位，level 0/1/2 各一', () => {
    expect(OFFICERS).toHaveLength(3)
    expect(OFFICERS.map((o) => o.level)).toEqual([0, 1, 2])
  })

  it('每位語料 ≥ 20 句且不重複', () => {
    for (const o of OFFICERS) {
      expect(o.corpus.length, `${o.name} 語料數`).toBeGreaterThanOrEqual(20)
      expect(new Set(o.corpus).size, `${o.name} 語料重複`).toBe(o.corpus.length)
    }
  })

  it('語料無禁詞（banned.ts）', () => {
    for (const o of OFFICERS) {
      for (const line of o.corpus) {
        expect(findBanned(line), `${o.name}：「${line}」`).toEqual([])
      }
    }
  })

  it('開場白與罰則台詞也無禁詞', () => {
    for (const o of OFFICERS) {
      expect(findBanned(o.hello + (o.helloSub ?? '') + o.punishment.line), o.name).toEqual([])
    }
  })

  it('模組點名台詞無禁詞', () => {
    for (const [id, barks] of Object.entries(MODULE_BARKS)) {
      for (const b of barks) expect(findBanned(b), `${id}：「${b}」`).toEqual([])
    }
  })

  it('罰則符合第 10 節：0=罰站 10 秒/1s、1=伏地挺身 20 下/0.6s、2=交互蹲跳 30 下/0.5s', () => {
    expect(OFFICER_BY_LEVEL[0].punishment).toMatchObject({ action: '罰站', count: 10, stepMs: 1000 })
    expect(OFFICER_BY_LEVEL[1].punishment).toMatchObject({ action: '伏地挺身', count: 20, stepMs: 600 })
    expect(OFFICER_BY_LEVEL[2].punishment).toMatchObject({ action: '交互蹲跳', count: 30, stepMs: 500 })
  })

  it('sampleCorpus 抽 3 句、不重複、且都來自該層語料', () => {
    for (const lv of [0, 1, 2] as const) {
      const s = sampleCorpus(lv, 3)
      expect(s).toHaveLength(3)
      expect(new Set(s).size).toBe(3)
      for (const line of s) expect(OFFICER_BY_LEVEL[lv].corpus).toContain(line)
    }
  })

  it('banned.ts 不得誤殺允許罵的行為詞（猶豫／拖延／菜／屁股重／賴床）', () => {
    for (const ok of ['猶豫', '拖延', '你很菜', '屁股重', '賴床', '屁股都長在椅子上了']) {
      expect(findBanned(ok), ok).toEqual([])
    }
  })

  it('banned.ts 真的攔得住髒話與人身攻擊', () => {
    expect(findBanned('媽的給我去').length).toBeGreaterThan(0)
    expect(findBanned('你這個白痴').length).toBeGreaterThan(0)
  })
})
