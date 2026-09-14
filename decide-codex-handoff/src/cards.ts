// 七張模組卡 — DECIDE-DEV-DOC-v1.md 第 6 節。
import type { ModuleCard, ModuleId } from './types.ts'

export const CARDS: ModuleCard[] = [
  {
    id: 'eat',
    title: '吃',
    subtitle: '中午、晚上，吃什麼',
    intake: [
      { key: 'diet', label: '忌口', type: 'chips', options: ['不辣', '不吃牛', '素', '都可以'], default: '都可以' },
    ],
    needsPlaces: true,
    placesQuery: { includedTypes: ['restaurant'], radiusByTransport: { default: 800 } },
    promptHint:
      '從候選店挑一家，meme.big = 店名（≤10 字，太長就用店家慣稱）。steps 必須含「點什麼」與「幾分鐘內吃完」。' +
      '若 recentOrders 裡本週已有 eat，請在 meme.top 或 meme.bot 點出這週第幾次、吃了什麼，語氣照火力層。',
    reissueLabel: '店關了',
    stopVerdictAllowed: false,
  },
  {
    id: 'go',
    title: '去',
    subtitle: '下班後、週末，去哪',
    intake: [
      { key: 'transport', label: '交通', type: 'chips', options: ['走路', '捷運', '計程車', '開車'], default: '捷運' },
      { key: 'minutes', label: '可接受', type: 'chips', options: ['15 分', '30 分', '60 分'], default: '30 分' },
    ],
    needsPlaces: false,
    promptHint:
      'MVP 不查 Places，用常識加定位城市選一個真實存在、此刻合理的地點。meme.big = 地點名。' +
      'steps 三條：怎麼去（含交通方式與時間）、到那裡做一件具體的事、回家。' +
      '必須符合時間帶：晚上不排早市、深夜不排登山、雨天不排純戶外。單程時間不得超過使用者選的「可接受」。',
    reissueLabel: '路封了',
    stopVerdictAllowed: false,
  },
  {
    id: 'attend',
    title: '赴',
    subtitle: '那個場合，去不去',
    intake: [
      { key: 'occasion', label: '場合', type: 'chips', options: ['飯局', '公司聚會', '朋友生日', '婚禮'], default: '飯局' },
      { key: 'stars', label: '熟識', type: 'stars', default: 4 },
    ],
    needsPlaces: false,
    promptHint:
      '硬規則：stars ≤ 2 且 occasion 不是「婚禮」→ verdict = "stop"，不去，steps 第一條就是唯一替代（傳一句話給對方），' +
      '且該句要能直接複製貼上。其餘情況 verdict = "do"。' +
      'verdict = "do" 時 steps 必含：到達時間、dress code 等級（例：smart casual、正式）、可離場時間。不給具體衣物品項。',
    reissueLabel: null,
    stopVerdictAllowed: true,
  },
  {
    id: 'rest',
    title: '歇',
    subtitle: '現在，去哪喝一杯',
    intake: [],
    needsPlaces: true,
    placesQuery: { includedTypes: ['cafe'], radiusByTransport: { default: 500 } },
    promptHint:
      '從候選店挑一家，meme.big = 店名。steps 三條：點什麼、坐幾分鐘、手機面朝下。',
    reissueLabel: '店關了',
    stopVerdictAllowed: false,
  },
  {
    id: 'sleep',
    title: '幾點睡',
    subtitle: '熄燈時間，班長定',
    intake: [
      { key: 'wake', label: '起床', type: 'chips', options: ['06:30', '07:30', '08:30'], default: '07:30' },
    ],
    needsPlaces: false,
    promptHint:
      'meme.big = 「HH:MM 熄燈」，時間 = 起床時間往前推 8 小時，必須自己算對。' +
      'steps 三條，其中一條必須指定充電器放在臥室外的位置（客廳／書桌），一條是刷牙或盥洗，最後一條是關燈且不確認訊息。',
    reissueLabel: null,
    stopVerdictAllowed: false,
  },
  {
    id: 'reply',
    title: '這訊息現在回嗎',
    subtitle: '拖著的那則',
    intake: [
      { key: 'target', label: '對象', type: 'chips', options: ['老闆', '同事', '朋友', '陌生人'], default: '同事' },
    ],
    needsPlaces: false,
    promptHint:
      '永遠 verdict = "do"。meme.big = 「現在回。N 句。」N 取 1–3。' +
      'steps：第一句是答案本身、第二句是什麼時候給完整版、第三句是送出後關掉。不要幫使用者編造事實內容，只給句型。',
    reissueLabel: null,
    stopVerdictAllowed: false,
  },
  {
    id: 'buy',
    title: '買不買',
    subtitle: '猶豫超過一次的那個',
    intake: [
      { key: 'amount', label: '金額', type: 'chips', options: ['500 以下', '500–1,500', '1,500–3,000'], default: '500–1,500' },
    ],
    needsPlaces: false,
    promptHint:
      '預設 verdict = "stop"，meme.big = 「不買。」，套用 72 小時規則：steps 為關掉頁面、72 小時後還想要再來報告。' +
      '例外：若 recentOrders 顯示 72 小時前已經為同類東西報告過一次 → verdict = "do"，准買，steps 給付款與收工動作。',
    reissueLabel: null,
    stopVerdictAllowed: true,
  },
]

export const CARD_BY_ID: Record<ModuleId, ModuleCard> = Object.fromEntries(
  CARDS.map((c) => [c.id, c]),
) as Record<ModuleId, ModuleCard>

/** 首頁排列：4 大磁貼 + 3 小鍵（第 6 節末）。 */
export const MAJOR_IDS: ModuleId[] = ['eat', 'go', 'attend', 'rest']
export const MINOR_IDS: ModuleId[] = ['sleep', 'reply', 'buy']

/**
 * 點名台詞：每張卡 × 三段火力。介面 ModuleCard 由第 5 節鎖定，故另存一張表。
 * index = Level。
 */
export const MODULE_BARKS: Record<ModuleId, [string, string, string]> = {
  eat: [
    '有、有沒有忌口？',
    '點名！有沒有忌口？沒有就閉嘴聽令。',
    '忌口？你以為這裡是餐廳？講，快！',
  ],
  go: [
    '怎、怎麼去？可以花多久？',
    '怎麼去？走路的舉手。可以花多久？',
    '怎麼去？講！三秒內！三、二——',
  ],
  attend: [
    '什麼場合？對方…多熟？',
    '什麼場合？多熟？不要跟我說「還好」，軍中沒有還好。',
    '場合！星數！你猶豫的樣子我看過一百次。',
  ],
  rest: [
    '要、要休息喔？那…那就去吧。',
    '不用點名。班長知道你在哪，坐多久了心裡有數。',
    '坐了三個半小時，屁股都長在椅子上了。起來！',
  ],
  sleep: [
    '明天…幾點起床？',
    '明天幾點起？不要給我說看情況。',
    '幾點起！「看情況」再講一次，一百下。',
  ],
  reply: [
    '誰、誰傳的？',
    '誰傳的？拖了多久了？',
    '誰傳的！你以為不回它就會自己消失？',
  ],
  buy: [
    '多、多少錢？',
    '多少錢？講數字，不要形容詞。',
    '多少錢！「還可以」不是數字！',
  ],
}
