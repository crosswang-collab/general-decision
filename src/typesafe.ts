// TypeSafe System One（Jev）最小客戶端 —— 只在伺服器端（api/）與本機腳本使用，前端永遠不 import。
// 文件：https://docs.typesafe.ai/api/system-one.md
// 設計：Jev 只回「判斷」（機率／分數／選項），不產生文字。任何失敗（沒金鑰、逾時、4xx/5xx、形狀不對）
// 一律回 null，呼叫端必須有不靠 Jev 的後備路徑——Jev 是加分，不是依賴。

export const TYPESAFE_URL = 'https://api.typesafe.ai/v1/systemone'
export const JEV_MODEL = 'jev-latest'

export type JevQuestion =
  | { type: 'noul'; instructions: string | Record<string, unknown>; criteria?: { true?: string; false?: string } }
  | { type: 'choice'; instructions: string | Record<string, unknown>; criteria: Record<string, string> }
  | { type: 'score'; instructions: string | Record<string, unknown>; criteria: string[] }

export type JevAnswer =
  | { type: 'noul'; noul: number }
  | { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> }
  | { type: 'score'; score: number; confidence: number; probabilities: Record<string, number> }

export interface JevOptions {
  apiKey?: string
  timeoutMs?: number
  baseUrl?: string
  fetchImpl?: typeof fetch
}

/**
 * 問 Jev 一組題目（同一份 state 的題目並行作答、彼此看不到答案）。
 * 回傳 answers（key 與題目同名）；任何失敗回 null。
 */
export async function askJev(
  state: unknown,
  questions: Record<string, JevQuestion>,
  opts: JevOptions = {},
): Promise<Record<string, JevAnswer> | null> {
  const key = opts.apiKey ?? (typeof process !== 'undefined' ? process.env.TYPESAFE_API_KEY : undefined)
  if (!key) return null
  const f = opts.fetchImpl ?? fetch
  try {
    const envBase = typeof process !== 'undefined' ? process.env.TYPESAFE_BASE_URL : undefined
    const res = await f(opts.baseUrl ?? envBase ?? TYPESAFE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: JEV_MODEL, state, questions }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 1500),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { answers?: Record<string, JevAnswer> }
    if (!data?.answers || typeof data.answers !== 'object') return null
    for (const name of Object.keys(questions)) {
      const a = data.answers[name]
      if (!a || a.type !== questions[name]!.type) return null
    }
    return data.answers
  } catch {
    return null
  }
}

/** 取 noul 機率；題目不存在或型別不對 → undefined。 */
export function noulOf(answers: Record<string, JevAnswer> | null, name: string): number | undefined {
  const a = answers?.[name]
  return a?.type === 'noul' && Number.isFinite(a.noul) ? a.noul : undefined
}

/** 取 score 期望值；題目不存在或型別不對 → undefined。 */
export function scoreOf(answers: Record<string, JevAnswer> | null, name: string): number | undefined {
  const a = answers?.[name]
  return a?.type === 'score' && Number.isFinite(a.score) ? a.score : undefined
}
