#!/usr/bin/env node
// 品味判準（Jev 執行面）：把 STRATEGY.md §5 的 T1–T10 裡「程式碼判斷不了、需要語感」的部分，
// 寫成 TypeSafe Jev 的 noul／score 題，對一批口令（Order JSON + 情境）逐筆判分。
// 「算得出來」的部分（店是否等於 pickPlace、金額是否來自資料、字表命中）不在這裡，在單元測試與 enforceRules。
//
// 用法：node scripts/taste-judge.mjs <orders.json>
//   orders.json = [{ "context": { "module":"eat", "mode":"new", "level":1, "visits":0, "country":"TW" }, "order": { ...Order } }, ...]
// 沒有 TYPESAFE_API_KEY → 只列出題目與待判清單，exit 0 並標明「未判」（不假裝通過）。
// 有金鑰 → 逐筆判分，任何一筆低於門檻 → exit 1。
import { readFileSync } from 'node:fs'
import { askJev } from '../src/typesafe.ts'

/** 每題：Jev 題目 + 通過門檻。題目 id 只給程式碼看，意思寫完整在 instructions。 */
export const TASTE_QUESTIONS = {
  // T1 一道命令，一個答案
  singleAnswer: {
    q: {
      type: 'noul',
      instructions: '`order` 是一道命令卡。它是否只給出「一個」明確的答案（一家店、一組動作），完全沒有提供備選、清單，或「也可以」「或者」之類讓人自己再選的空間？',
      criteria: { true: '只有一個答案，不留選擇', false: '出現第二選項、清單或讓使用者自己挑' },
    },
    pass: (a) => a.noul >= 0.8,
  },
  // T3 新，要說出來；舊，要數出來
  modeVoiced: {
    q: {
      type: 'noul',
      instructions: '`context.mode` 是這次選店的理由：new＝使用者沒去過的新店，revisit＝回訪（`context.visits` 是第幾次），wildcard＝刻意偵察的意外選擇。`order.meme` 的文字有沒有讓使用者感受到這個理由（new 要點出沒去過／新據點；revisit 要點出第幾次；wildcard 要點出偵察／冒險）？',
      criteria: { true: '文字清楚傳達了這次的選店理由', false: '文字沒提，或講錯理由' },
    },
    pass: (a) => a.noul >= 0.7,
  },
  // T7 罵行為不罵人；命令本體零毒性
  toxicityPlacement: {
    q: {
      type: 'noul',
      instructions: '`order.steps` 與 `order.log` 是不是純粹可執行、中性的資訊（不帶嘲諷、不罵人）？嘲諷只允許出現在 `order.meme.top` 與 `order.meme.bot`，而且只能針對猶豫、拖延這類行為，不能針對人的外貌、性別、族群、家庭、健康。',
      criteria: { true: 'steps 與 log 中性，嘲諷只罵行為且只在 meme 上下行', false: 'steps／log 有嘲諷，或罵到人本身' },
    },
    pass: (a) => a.noul >= 0.85,
  },
  // T9 在哪裡就照哪裡的規矩
  localeFit: {
    q: {
      type: 'noul',
      instructions: '使用者目前在 `context.country`（TW＝台灣，JP＝日本）。`order` 的用語、幣別、交通方式是否符合當地（例如在日本不該出現「捷運」或新台幣；在台灣不該出現日圓），而且整體是台灣繁體中文、沒有中國大陸用語？',
      criteria: { true: '用語與幣別都符合所在地，且是台灣繁中', false: '出現不符所在地的用語、幣別，或中國用語' },
    },
    pass: (a) => a.noul >= 0.8,
  },
  // 人設品質：火力層是否對得上角色
  voiceMatchesOfficer: {
    q: {
      type: 'score',
      instructions: '`context.level` 決定角色：0＝剛下部隊、兇不起來會結巴的菜鳥班長；1＝短句命令式的值星班長；2＝毒舌比喻狠的士官長；3＝不罵人、語氣中性專業的文書兵。`order.meme` 的語氣有多符合這個角色？',
      criteria: [
        '完全不像這個角色，像別人在講話',
        '有一點像，但語氣常常跑掉',
        '大致像這個角色',
        '一聽就是這個角色，而且有記憶點',
      ],
    },
    pass: (a) => a.score >= 1.8,
  },
  // 好笑程度：值得截圖分享嗎（不擋上線，只記錄）
  shareworthy: {
    q: {
      type: 'score',
      instructions: '把 `order.meme` 當成一張梗圖：一般台灣年輕上班族看到，會想截圖傳給朋友嗎？',
      criteria: ['不會，平淡或尷尬', '會笑一下但不會傳', '可能會傳', '一定會傳'],
    },
    pass: () => true,
  },
}

async function main() {
  const file = process.argv[2]
  if (!file) { console.error('用法：node scripts/taste-judge.mjs <orders.json>'); process.exit(2) }
  const items = JSON.parse(readFileSync(file, 'utf8'))
  const questions = Object.fromEntries(Object.entries(TASTE_QUESTIONS).map(([k, v]) => [k, v.q]))
  if (!process.env.TYPESAFE_API_KEY) {
    console.log(JSON.stringify({ judged: false, reason: 'no TYPESAFE_API_KEY', items: items.length, questions: Object.keys(questions) }, null, 2))
    return
  }
  let fails = 0
  const rows = []
  for (const it of items) {
    const a = await askJev({ context: it.context, order: it.order }, questions, { timeoutMs: 8000 })
    if (!a) { rows.push({ big: it.order?.meme?.big, error: 'jev_failed' }); fails++; continue }
    const row = { big: it.order?.meme?.big }
    for (const [k, v] of Object.entries(TASTE_QUESTIONS)) {
      const ans = a[k]
      const val = ans?.type === 'noul' ? ans.noul : ans?.score
      const ok = ans ? v.pass(ans) : false
      row[k] = `${val?.toFixed?.(2) ?? '?'}${ok ? '' : ' ✗'}`
      if (!ok) fails++
    }
    rows.push(row)
  }
  console.table(rows)
  if (fails) { console.error(`品味判準：${fails} 項未達門檻`); process.exit(1) }
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
