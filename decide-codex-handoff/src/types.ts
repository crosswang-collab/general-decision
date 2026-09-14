// 資料模型 — DECIDE-DEV-DOC-v1.md 第 5 節，照抄。

export type Level = 0 | 1 | 2 // 菜鳥班長 / 值星班長 / 士官長
export type ModuleId = 'eat' | 'go' | 'attend' | 'rest' | 'sleep' | 'reply' | 'buy'

export interface IntakeField {
  key: string // 'diet' | 'transport' | 'minutes' | 'occasion' | 'stars' ...
  label: string // 顯示：忌口 / 交通 / 可接受 ...
  type: 'chips' | 'stars'
  options?: string[] // chips 用
  default: string | number
}

export interface ModuleCard {
  id: ModuleId
  title: string // 吃 / 去 / 赴 / 歇 / 幾點睡 / 這訊息現在回嗎 / 買不買
  subtitle: string
  intake: IntakeField[]
  needsPlaces: boolean // eat, rest = true
  placesQuery?: { includedTypes: string[]; radiusByTransport?: Record<string, number> }
  promptHint: string // 給 Claude 的模組專屬規則（第 6 節）
  reissueLabel: string | null // '店關了' | '路封了' | null
  stopVerdictAllowed: boolean // buy=true（可以「不買」）, attend=true（可以「不去」）
}

export interface OrderRequest {
  module: ModuleId
  level: Level
  choices: Record<string, string | number>
  loc?: { lat: number; lng: number; label?: string } // 無定位權限時 undefined
  now: string // ISO，含時區
  exclude?: string[] // 換口令時帶上一家 place_id
  recentOrders: { module: ModuleId; big: string; at: string }[] // 近 7 天，讓班長講「這週第二次」
}

export interface Order {
  // Claude 必須回這個 JSON，不多不少
  verdict: 'do' | 'stop' // stop = 不去／不買，用紅卡
  meme: { top: string; big: string; bot: string } // top ≤ 16 字, big ≤ 10 字, bot ≤ 24 字
  steps: string[] // 1–3 條，每條 ≤ 22 字，可執行、無梗
  place?: { id: string; name: string; walkMin?: number; openUntil?: string }
  log: string // 完成後登記文字，≤ 30 字，描述式，不誇
}

export interface DiaryEntry {
  id: string // `${ts}-${module}`  冪等鍵
  ts: string
  module: ModuleId
  level: Level
  big: string
  placeName?: string
  outcome: 'done' | 'reissued' | 'punished'
}

export interface WeeklyReport {
  weekStart: string
  level: Level
  stats: { orders: number; complianceRate: number; punishments: number; weakestModule: ModuleId | null }
  body: string // ≤ 180 字，班長口吻，含至少一個規律觀察 + 一個下週對策
  verdict: string // ≤ 14 字，例：「本週講評：合格。屁股記過一次。」
}
