#!/usr/bin/env node
// Effort 分流：把開發任務送給 TypeSafe Jev 的 choice 題，決定派給哪一級模型。
// 用法：node scripts/effort-route.mjs docs/round3/effort-tasks.json
//   effort-tasks.json = [{ "id": "W1", "task": "任務描述……", "fallback": "sonnet" }, ...]
// 沒有 TYPESAFE_API_KEY、或 Jev 失敗 → 用該任務的 fallback（Fable 計劃裡指派的等級），並在輸出標明來源。
// 金鑰只從環境變數讀，絕不寫進檔案或對話。
import { readFileSync } from 'node:fs'
import { askJev } from '../src/typesafe.ts'

export const TIER_CRITERIA = {
  haiku: '規則完全明確、機械性、幾乎不需要判斷的工作：批次改名、照表填值、格式轉換、補簡單測試。',
  sonnet: '方法已知的標準開發工作：照規格實作功能、改 UI、寫單元與 e2e 測試，量可以很大但不需要新設計。',
  opus: '需要判斷或設計取捨的工作：演算法設計、跨模組整合、難以重現的錯誤、獨立審查或驗收。',
  fable: '高風險且 opus 很可能失敗的工作：整體架構重設、多方案權衡且錯了代價很大、opus 已經做過仍失敗的節點。',
}

export function routeQuestion() {
  return {
    tier: {
      type: 'choice',
      instructions: '`task` 是一項軟體開發任務。選出「最便宜、但能一次通過該任務驗收條件」的模型等級。不確定時選較便宜的那一級。',
      criteria: TIER_CRITERIA,
    },
  }
}

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('用法：node scripts/effort-route.mjs <tasks.json>')
    process.exit(2)
  }
  const tasks = JSON.parse(readFileSync(file, 'utf8'))
  const hasKey = !!process.env.TYPESAFE_API_KEY
  const rows = await Promise.all(tasks.map(async (t) => {
    const a = hasKey ? await askJev({ task: t.task }, routeQuestion(), { timeoutMs: 5000 }) : null
    const ans = a?.tier
    if (ans && ans.type === 'choice') {
      return { id: t.id, tier: ans.choice, confidence: Number(ans.confidence.toFixed(2)), source: 'jev', fallback: t.fallback }
    }
    return { id: t.id, tier: t.fallback, confidence: null, source: hasKey ? 'fallback(jev-failed)' : 'fallback(no-key)', fallback: t.fallback }
  }))
  console.log(JSON.stringify(rows, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
