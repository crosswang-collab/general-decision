import { describe, expect, it } from 'vitest'
import {
  dayLabel, entriesInWeek, entryId, groupByDay, makeEntry, recentOrders, stats,
  timeLabel, weekStartOf, weeklyDue,
} from '../../src/diary.ts'
import type { DiaryEntry } from '../../src/types.ts'

const e = (ts: string, module: DiaryEntry['module'], outcome: DiaryEntry['outcome']): DiaryEntry =>
  makeEntry(ts, module, 1, `${module}-big`, outcome)

describe('diary 統計（第 10、13.1 節）', () => {
  it('服從率 =（done + reissued）÷ 全部', () => {
    // 12 筆：9 done、1 reissued、2 punished → (9+1)/12 = 83%
    const entries = [
      ...Array.from({ length: 9 }, (_, i) => e(`2026-09-0${(i % 7) + 1}T12:0${i}:00+08:00`, 'eat', 'done')),
      e('2026-09-08T13:00:00+08:00', 'eat', 'reissued'),
      e('2026-09-08T23:30:00+08:00', 'sleep', 'punished'),
      e('2026-09-09T16:05:00+08:00', 'rest', 'punished'),
    ]
    const s = stats(entries)
    expect(s.orders).toBe(12)
    expect(s.complianceRate).toBe(83)
    expect(s.punishments).toBe(2)
  })

  it('空日記不會除以零', () => {
    expect(stats([])).toEqual({ orders: 0, complianceRate: 0, punishments: 0, weakestModule: null })
  })

  it('全部完成 = 100%', () => {
    expect(stats([e('2026-09-08T12:00:00+08:00', 'eat', 'done')]).complianceRate).toBe(100)
  })

  it('最弱模組 = 罰則最多的那個', () => {
    const entries = [
      e('2026-09-08T23:30:00+08:00', 'sleep', 'punished'),
      e('2026-09-09T23:30:00+08:00', 'sleep', 'punished'),
      e('2026-09-10T16:00:00+08:00', 'rest', 'punished'),
      e('2026-09-10T12:00:00+08:00', 'eat', 'done'),
    ]
    expect(stats(entries).weakestModule).toBe('sleep')
  })

  it('沒有罰則就沒有最弱模組', () => {
    expect(stats([e('2026-09-08T12:00:00+08:00', 'eat', 'done')]).weakestModule).toBeNull()
  })
})

describe('diary 冪等（第 13.1 節）', () => {
  it('同 id 的兩筆視為同一道口令', () => {
    const a = e('2026-09-11T12:41:00+08:00', 'eat', 'reissued')
    const b = e('2026-09-11T12:41:00+08:00', 'eat', 'done')
    expect(a.id).toBe(b.id)
    expect(entryId('2026-09-11T12:41:00+08:00', 'eat')).toBe('2026-09-11T12:41:00+08:00-eat')
  })
})

describe('週界與近 7 天', () => {
  it('週界落在週一 00:00', () => {
    const ws = new Date(weekStartOf(new Date('2026-09-11T12:00:00+08:00'))) // 週五
    expect(ws.getDay()).toBe(1)
    expect(ws.getHours()).toBe(0)
  })

  it('entriesInWeek 只留那一週的', () => {
    const ws = weekStartOf(new Date('2026-09-11T12:00:00+08:00'))
    const inside = e('2026-09-11T12:00:00+08:00', 'eat', 'done')
    const outside = e('2026-08-01T12:00:00+08:00', 'eat', 'done')
    expect(entriesInWeek([inside, outside], ws).map((x) => x.id)).toEqual([inside.id])
  })

  it('recentOrders 只取近 7 天', () => {
    const now = new Date('2026-09-11T12:00:00+08:00')
    const recent = e('2026-09-10T12:00:00+08:00', 'eat', 'done')
    const old = e('2026-08-01T12:00:00+08:00', 'eat', 'done')
    expect(recentOrders([recent, old], now)).toEqual([
      { module: 'eat', big: 'eat-big', at: '2026-09-10T12:00:00+08:00' },
    ])
  })

  it('週報只在週日 20:00 之後才到期', () => {
    expect(weeklyDue(new Date('2026-09-13T20:00:00+08:00'))).toBe(true) // 週日 20:00
    expect(weeklyDue(new Date('2026-09-13T19:59:00+08:00'))).toBe(false)
    expect(weeklyDue(new Date('2026-09-12T22:00:00+08:00'))).toBe(false) // 週六
  })
})

describe('日記分組', () => {
  it('同一天的併成一組，順序保持', () => {
    const list = [
      e('2026-09-11T16:05:00+08:00', 'rest', 'punished'),
      e('2026-09-11T12:41:00+08:00', 'eat', 'done'),
      e('2026-09-10T19:00:00+08:00', 'attend', 'done'),
    ]
    const g = groupByDay(list)
    expect(g).toHaveLength(2)
    expect(g[0]!.entries).toHaveLength(2)
    expect(g[1]!.entries).toHaveLength(1)
  })

  it('日期與時間標籤', () => {
    expect(dayLabel('2026-09-11T12:41:00+08:00')).toMatch(/^週. 09\/11$/)
    expect(timeLabel('2026-09-11T12:41:00+08:00')).toBe('12:41')
  })
})
