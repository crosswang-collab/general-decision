// mode 語意的替換語料 — DEV-PLAN-3 W1.4、品味原則 T3「新，要說出來；舊，要數出來」。
// 模型沒照 mode 寫（或寫錯「第 N 次」）時，enforceRules 用這裡的句子換掉 meme.top（必要時 meme.bot）。
// 規則：全部過 findBanned()；不含「或」「也可以」「備選」（T1：一道命令一個答案）；不寫任何金額或模型算不出的數字。
// revisit 用 {N} 佔位，N 一律是伺服器算好的 visits。index = Level（0 阿良／1 黑面／2 老郭）。
import type { Level, PickMode } from './types.ts'

export type LineKind = PickMode | 'exhausted'

/** meme.top 用（≤16 字，{N} 最多兩位數）。 */
export const MODE_LINES: Record<LineKind, [string[], string[], string[]]> = {
  new: [
    ['這、這家你沒去過喔', '新據點…班長也沒來過', '你、你還沒去過這家', '第一次來，別、別緊張'],
    ['這家你沒去過。出發', '新據點，給我去占領', '沒去過就去，動作快', '第一次來，一個口令'],
    ['沒去過？今天就去', '新據點，菜鳥先去探路', '沒來過的店，怕什麼', '第一次來，別給我拖'],
  ],
  revisit: [
    ['這、這是第{N}次來了', '第{N}次了…老地方', '又來了，第{N}次喔', '第{N}次報到…熟門路'],
    ['第{N}次報到，老地方', '回防！第{N}次', '第{N}次了，照舊執行', '熟門熟路，第{N}次'],
    ['第{N}次了，還要我帶路', '第{N}次，閉著眼也會走', '老地方第{N}次，快去', '第{N}次回防，別拖'],
  ],
  wildcard: [
    ['偵、偵察任務…就這家', '班長派你去偵察', '偵察兵，出發…吧', '這次是偵察任務喔'],
    ['偵察任務，目標這家', '偵察兵出列！', '今天出偵察任務', '偵察新據點，出發'],
    ['偵察任務，菜鳥打頭陣', '偵察！不准猶豫', '派你去偵察，快', '偵察兵，屁股抬起來'],
  ],
  exhausted: [
    ['附、附近都偵察過了', '這區…偵察完畢了', '附近的店…你都看過了', '偵察完畢…改派這家'],
    ['這區偵察完畢', '附近據點全數偵察完', '偵察告一段落，改派', '偵察完畢，照令執行'],
    ['這區被你掃完了', '偵察完了，別挑了', '附近你都看過了，去', '偵察結束，回去吃飯'],
  ],
}

/** meme.bot 的中性句：模型的 bot 寫錯數字或踩禁詞時用。沒有 mode 語意、沒有數字。 */
export const NEUTRAL_BOT: [string[], string[], string[]] = [
  ['快、快去吧…班長在這等你', '吃完…回來報告喔', '動、動作稍微快一點', '班長…相信你'],
  ['一個口令一個動作', '吃完回來報告', '不要讓我講第二遍', '動作快，不要拖'],
  ['再拖就不用吃了', '猶豫的時間都夠吃完了', '菜就是菜，快去', '屁股重？抬起來'],
]

/** 中性的 steps／log（禁詞命中後整句換掉時用）。 */
export const NEUTRAL_STEP = '照口令執行，完成後回報。'
export const NEUTRAL_LOG = '口令已下達，等候回報。'

/** 簡單字串雜湊：同一道口令（同店、同時間）每次選到同一句，可重現。 */
export function lineSalt(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function modeLine(kind: LineKind, level: Level, visits: number, salt = 0): string {
  const list = MODE_LINES[kind][level]
  return list[salt % list.length]!.replaceAll('{N}', String(visits))
}

export function neutralBot(level: Level, salt = 0): string {
  const list = NEUTRAL_BOT[level]
  return list[salt % list.length]!
}

const NEW_RE = /沒去過|新據點|第一次|沒來過/
const ZH_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
/** 「第 N 次」：阿拉伯數字或一～十的國字。 */
export const NTH_RE = /第\s*([0-9０-９]+|[一二兩三四五六七八九十]+)\s*次/g

/** 國字／全形數字 → 數字（一～十九夠用；看不懂回 NaN）。 */
export function parseNth(s: string): number {
  const ascii = s.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
  if (/^\d+$/.test(ascii)) return Number(ascii)
  if (s === '兩') return 2
  if (s === '十') return 10
  const m = s.match(/^十?([一二三四五六七八九])?$/)
  if (s.startsWith('十') && m) return 10 + (m[1] ? ZH_NUM.indexOf(m[1]) : 0)
  const one = ZH_NUM.indexOf(s)
  if (one > 0) return one
  const two = s.match(/^([一二三四五六七八九])十([一二三四五六七八九])?$/)
  if (two) return ZH_NUM.indexOf(two[1]!) * 10 + (two[2] ? ZH_NUM.indexOf(two[2]) : 0)
  return NaN
}

/** 文字裡出現的「第 N 次」N 值。 */
export function nthCounts(text: string): number[] {
  return [...text.matchAll(NTH_RE)].map((m) => parseNth(m[1]!))
}

/** mode 語意檢查（B6）：new 要講沒去過；revisit 要講第 N 次（N = visits）；wildcard 要講偵察。 */
export function satisfiesMode(text: string, mode: PickMode, visits: number): boolean {
  if (mode === 'new') return NEW_RE.test(text)
  if (mode === 'revisit') return nthCounts(text).includes(visits)
  return text.includes('偵察')
}

/** 「第 N 次」寫錯：revisit 時 N ≠ visits；new／wildcard 時 N ≠ 1（「第一次來」可以，「第三次」不行）。 */
export function hasWrongCount(text: string, mode: PickMode, visits: number): boolean {
  const want = mode === 'revisit' ? visits : 1
  return nthCounts(text).some((n) => n !== want)
}
