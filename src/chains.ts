// 連鎖判定（DEV-PLAN-3 A5）。字典是我方資料，不是 Google 內容。純函式，無 I/O。
// 用途：發掘時連鎖降權、「全面偵察」排除連鎖、同品牌不同分店的曝光合併計算（今天摩斯 A 店，明天就不派摩斯 B 店）。
import type { Country } from './types.ts'

export interface Brand { key: string; names: string[]; country: Country | 'both' }

/** 種子字典（Team Lead 契約步驟先放）；W4 擴充到台灣 ≥50、日本 ≥50。便利商店與純飲料店不收（不是餐廳）。 */
export const BRANDS: Brand[] = [
  { key: 'mcdonalds', names: ['麥當勞', "McDonald's", 'マクドナルド'], country: 'both' },
  { key: 'mos', names: ['摩斯漢堡', 'MOS BURGER', 'モスバーガー'], country: 'both' },
  { key: 'kfc', names: ['肯德基', 'KFC', 'ケンタッキー'], country: 'both' },
  { key: 'starbucks', names: ['星巴克', 'Starbucks', 'スターバックス'], country: 'both' },
  { key: 'dintaifung', names: ['鼎泰豐', 'Din Tai Fung'], country: 'both' },
  { key: 'yoshinoya', names: ['吉野家'], country: 'both' },
  { key: 'sukiya', names: ['すき家', 'Sukiya', 'SUKIYA'], country: 'both' },
  { key: 'matsuya', names: ['松屋'], country: 'JP' },
  { key: 'ichiran', names: ['一蘭', 'ICHIRAN'], country: 'both' },
  { key: 'bafang', names: ['八方雲集'], country: 'TW' },
  { key: 'louisa', names: ['路易莎', 'Louisa Coffee'], country: 'TW' },
  { key: 'saizeriya', names: ['薩莉亞', 'サイゼリヤ', 'Saizeriya'], country: 'both' },
]

const norm = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[\s'’・·.\-]/g, '')

const BRANCH_TAIL = /(分店|門市|號店|号店|店)$/
const PAREN_TAIL = /\s*[（(][^（）()]*[）)]\s*$/

/** 去掉分店字尾：「○○ 南京店」「○○店」「○○ 渋谷店」「○○（信義）」「○○分店」「○○門市」→ 品牌名。 */
export function stripBranch(name: string): string {
  let s = name.trim().replace(PAREN_TAIL, '').trim()
  // 有空白：最後一段若以店／分店／門市結尾就整段拿掉（「すき家 渋谷店」「八方雲集 南京店」）。
  const parts = s.split(/\s+/)
  if (parts.length > 1 && BRANCH_TAIL.test(parts.at(-1)!)) return parts.slice(0, -1).join(' ')
  // 沒空白：「鼎泰豐信義店」→ 拿掉「兩個字 + 店」，剩下 ≥2 字才算（「阿財小吃店」不被砍成一個字）。
  const m = s.match(/^(.{2,}?)([\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}A-Za-z0-9]{2})(分店|門市|號店|号店|店)$/u)
  if (m) s = m[1]!
  return s
}

const INDEX: { n: string; key: string }[] = BRANDS
  .flatMap((b) => b.names.map((n) => ({ n: norm(n), key: b.key })))
  .filter((x) => x.n.length >= 2)
  .sort((a, b) => b.n.length - a.n.length) // 長的先比，避免短名誤中

/** 店名命中字典 → 品牌鍵；否則 undefined。比對規則：正規化後以品牌名開頭。 */
export function brandKeyOf(name: string): string | undefined {
  const n = norm(name)
  return INDEX.find((x) => n.startsWith(x.n))?.key
}

/**
 * 同一批候選內分群：字典品牌一律給鍵（即使只有一家，讓跨天的同品牌曝光能合併）；
 * 不在字典的，stripBranch 後前綴相同 ≥2 家才聚成 'cluster:<前綴>'。單獨一家的非字典店不出現在 Map 裡。
 */
export function clusterKeys(cands: { id: string; name: string }[]): Map<string, string> {
  const out = new Map<string, string>()
  const byPrefix = new Map<string, string[]>()
  for (const c of cands) {
    const k = brandKeyOf(c.name)
    if (k) { out.set(c.id, k); continue }
    const p = norm(stripBranch(c.name))
    if (p.length < 2) continue
    byPrefix.set(p, [...(byPrefix.get(p) ?? []), c.id])
  }
  for (const [p, ids] of byPrefix) if (ids.length >= 2) for (const id of ids) out.set(id, `cluster:${p}`)
  return out
}

/** 這個鍵是不是連鎖（字典品牌或同批 ≥2 家聚類）。 */
export function isChainKey(key: string | undefined): boolean {
  return !!key
}
