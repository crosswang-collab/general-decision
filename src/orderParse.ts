// Order JSON 解析 — 第 11 節：4 層解析；第 5 節 Order 形狀驗證。
import type { Order } from './types.ts'

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

/** 第 11 節：直接 parse → 去 fence → regex 取 {…} → 失敗視同 5xx。 */
export function parseOrder(raw: string): Order {
  const attempts: (() => unknown)[] = [
    // 1. 直接 parse
    () => JSON.parse(raw),
    // 2. 去掉 ```json fence
    () => JSON.parse(stripFence(raw)),
    // 3. regex 取第一個完整 {…}
    () => JSON.parse(firstObject(raw)),
  ]
  for (const attempt of attempts) {
    try {
      const value = attempt()
      if (isOrder(value)) return normalize(value)
    } catch { /* 換下一層 */ }
  }
  // 4. 失敗
  throw new ParseError('Claude 回傳無法解析為 Order JSON')
}

function stripFence(s: string): string {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/)
  return m ? m[1]!.trim() : s.trim()
}

function firstObject(s: string): string {
  const start = s.indexOf('{')
  if (start < 0) throw new ParseError('找不到 {')
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < s.length; i++) {
    const ch = s[i]!
    if (esc) { esc = false; continue }
    if (ch === '\\') { esc = true; continue }
    if (ch === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  throw new ParseError('{ 沒有收尾')
}

function isOrder(v: unknown): v is Order {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  if (o.verdict !== 'do' && o.verdict !== 'stop') return false
  const meme = o.meme as Record<string, unknown> | undefined
  if (!meme || typeof meme.top !== 'string' || typeof meme.big !== 'string' || typeof meme.bot !== 'string') return false
  if (!Array.isArray(o.steps) || o.steps.length === 0 || !o.steps.every((s) => typeof s === 'string')) return false
  if (typeof o.log !== 'string') return false
  if (o.place !== undefined) {
    const p = o.place as Record<string, unknown>
    if (typeof p !== 'object' || p === null || typeof p.id !== 'string' || typeof p.name !== 'string') return false
  }
  return true
}

/** 收斂到第 5 節的長度上限：steps 1–3 條。超長不截字（會斷句），只截條數。 */
function normalize(o: Order): Order {
  return { ...o, steps: o.steps.slice(0, 3) }
}
