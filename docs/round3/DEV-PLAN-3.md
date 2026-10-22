# 決斷連 · 第三輪開發計劃（DEV-PLAN-3）

> 建立：2026-10-22。總指揮：Fable。
> 依據：[STRATEGY.md](STRATEGY.md)（方向與驗收）、[R1](R1-competitors.md)、[R2](R2-personality-store.md)、[R3](R3-discovery-price.md)、repo 工作目錄（`d2ed8f0` + 未進版控的 `src/jevJudge.ts`、`src/typesafe.ts`、`scripts/effort-route.mjs`）。
> 讀者：主對話（Team Lead）與四個子代理。**這份是施工圖，不是討論稿。** 凡是寫「必須」的，就是驗收條件；凡是寫「不要做」的，做了就是 FAIL。
> 引用寫法：`places.ts:168` = 該檔第 168 行（2026-10-22 工作目錄）。

---

## 0. 開工前的現況（2026-10-22 實測，不是推測）

| 項目 | 現況 | 證據 |
|---|---|---|
| `TZ=Asia/Taipei npx vitest run` | ✅ 12 檔 156 條全綠 | 本日實跑 |
| `npm run typecheck`（`tsc -b`） | ❌ **紅** | `src/typesafe.ts(39,25): TS2769`——`process.env.TYPESAFE_BASE_URL` 寫成 `a && b` 得到 `string \| false`。這支是未進版控的新檔，不是上一輪的回歸 |
| e2e | 38 條（`tests/e2e/*.spec.ts`），本日未重跑 | README 寫 36 是舊數字 |
| vitest 收錄範圍 | 只收 `tests/unit/**/*.test.{ts,tsx}`（`vite.config.ts:54`） | 新測試一律放 `tests/unit/` |
| `git status` | 未追蹤：`docs/round3/`、`scripts/effort-route.mjs`、`src/jevJudge.ts`、`src/typesafe.ts` | 這四樣由 Team Lead 在 §F 步驟 0 決定去留 |
| Node | v24.15.0 | 腳本可直接 `import` `.ts`（`scripts/effort-route.mjs` 已這樣做） |
| 根因 | 整條鏈確定性、無記憶（STRATEGY §2 ①–⑦） | `places.ts:168-170`、`prompt.ts:30,58`、`api/order.ts:115-121`、`app.tsx:46,104,153`、`diary.ts:17-24,53-58` |

---

## A. 目標與 STOP 條件

### A.1 目標（一句話）

> **同一個地點連按，班長每次派你去一家你還沒去過、不踩雷、符合你預算（台幣／日圓）的真店；你說過不要的店，三個月內不會再看到。**

### A.2 STOP 條件（全部要同時成立；任何一條不成立就不准宣稱完成）

每一條都是機械可查的。「人工」兩字出現的地方才允許人工判定。

**閘門（既有五道 + 新增一道）**

| # | 指令 | 通過條件 |
|---|---|---|
| S1 | `TZ=Asia/Taipei npm run typecheck` | exit 0（含 `api/geocode.ts` 與所有新檔） |
| S2 | `TZ=Asia/Taipei npm test` | exit 0；既有 156 條除 §E.3 **明列**要改的斷言外全部原樣通過；新增測試全綠 |
| S3 | `npm run build` | exit 0 |
| S4 | `npm run check:bundle` | exit 0，且腳本輸出列出 `api/order.ts`、`api/weekly.ts`、`api/geocode.ts` 三支都載得起來、default 都是 `{ fetch }` |
| S5 | `npm run e2e` | exit 0。**WebKit 契約**：在裝得起 WebKit 的機器跑；只有 Chromium 的環境要照 DEV-PLAN-2 §3 誠實標「回歸檢查，不是 WebKit PASS」 |
| S6 | `TZ=Asia/Taipei npx vitest run tests/unit/discovery-replay.test.ts` | exit 0，且 console 印出的 JSON 報表每一項門檻都是 `pass:true`（門檻見 A.3） |

**行為斷言（寫成測試，S2／S5／S6 會跑到；這裡列出讓 checker 逐條對）**

| # | 斷言 | 在哪裡驗 |
|---|---|---|
| B1 | 同一座標、同一選項、固定種子，連續 10 次 `/api/order`（每次把回傳的 `place.id` 以 `sh` 事件回填到 `mem`）：**前 5 次 `place.id` 互不相同**；方針 `recon` 下 **10 次互不相同**，或在池子耗盡時回應帶 `place.exhausted:true` | `tests/unit/handler.test.ts`（合成 40 家候選池 mock） |
| B2 | `budget:[1]` 且候選中 band ≤ 2 的店 ≥ 5 家時，被選的店 `band` 必為 `1`、`2` 或 `null`（價位未知）；**100 次固定種子內 0 次出現 band ≥ 3**（即 `priceLevel ≥ EXPENSIVE` 的店不得出現） | `tests/unit/discovery.test.ts` |
| B3 | `mem` 中 `x:'forever'` 或 `x > now` 的店 **0 次**被選；本次 `exclude` 的店 0 次；最近 3 次 `sh` 的店 0 次（池子 ≥ 5 家時） | `tests/unit/discovery.test.ts` |
| B4 | 被選的店貝氏評分 ≥ 3.7 且評論 ≥ 5（池子中合格者 ≥ 5 家時）；放寬時 `relaxed[]` 必須非空並 `console.warn` | `tests/unit/discovery.test.ts` |
| B5 | 模型回傳任何別家店（或類別），最終 `place.id` 100% 等於 `pickPlace` 的輸出（T2） | `tests/unit/handler.test.ts` |
| B6 | mode=new 的 `meme.top`∪`meme.bot` 必含「沒去過／新據點／第一次／沒來過」之一；revisit 必含「第 N 次」且 N = `visits`；wildcard 必含「偵察」；模型寫錯就被 `src/modeLines.ts` 語料替換（T3），三種 mode × 3 火力 × 20 次 mock 100% 通過 | `tests/unit/rules.test.ts`（新檔） |
| B7 | 口令任何欄位出現金額（`NT$`、`¥`、`円`、`元` + 數字）而該金額不在 `place.priceText` 內 → 被拔掉並 warn（T6） | `tests/unit/rules.test.ts` |
| B8 | 伺服器端 `banned.ts` 掃 `meme`／`steps`／`log`：故意塞禁詞的 mock 回應，送到前端的版本 0 命中（C3） | `tests/unit/handler.test.ts` |
| B9 | `bandOf` 五種情況（TWD、JPY、無上限、只有 priceLevel、無資料）；`countryOf` 台北／東京／沖繩／金門／其他五點；`priceText` 不得自己發明數字 | `tests/unit/price.test.ts` |
| B10 | `TZ=UTC` 下，台北與東京座標各測 00:30、08:30、23:30，`closingTime` 取對的那一天、`opensAt` 是當地時間 | `tests/unit/tz.test.ts`、`tests/unit/order.test.ts` |
| B11 | 「八方雲集 南京店」「八方雲集 復興店」同品牌鍵；「すき家 渋谷店」判連鎖；「阿財魯肉飯」不是 | `tests/unit/chains.test.ts` |
| B12 | 日本座標的 `localizeOrder` 不產生「捷運」；台灣座標不出現「¥」「地下鐵」（T9） | `tests/unit/locale.test.ts` |
| B13 | 前端 `PlaceMem`：五種事件（shown／done／closed／not_this_kind／never_again）與 fav 對記憶的影響逐一斷言；第二次 never_again → `'forever'`；`memSummary` 不含 `name`／`rating`／`lat`／`lng` 鍵（用 `JSON.stringify` 後 regex 斷言）；`makeEntry` 的輸出 **沒有 `placeName` 鍵** | `tests/unit/placeMem.test.ts`、`tests/unit/diary.test.ts` |
| B14 | e2e：按「換一家」→ 底部選單三個原因 → 選「這家不要再來」→ 第二道口令 `place.id ≠ p1`；`page.reload()` 後再要一道，送出的 request body `mem` 內有 `{id:'p1', x:...}` | `tests/e2e/memory.spec.ts`（新） |
| B15 | e2e：`context.setGeolocation` 東京（35.6812,139.7671）→ eat intake 的預算 chips 文字含「¥」；台北（25.0330,121.5654）→ 含「NT$」或「≤150」；選了「1,000+」再點「≤150」→ 中間兩檔自動補上 | `tests/e2e/budget.spec.ts`（新） |
| B16 | e2e：首次啟動出現同意畫面；同意前 `/api/order` 0 次被呼叫；同意後正常流程 | `tests/e2e/consent.spec.ts`（新） |
| B17 | e2e：拒絕定位 → 錯誤畫面有「手動報座標」輸入 → 輸入「台北車站」→ mock `/api/geocode` → 拿到口令 | `tests/e2e/manual-location.spec.ts`（新） |
| B18 | e2e：口令畫面不捲動（375×667）可見：店名連結、步行分鐘、營業到／幾點開、價位文字或「價位未知」、「Google Maps」歸屬（T10） | `tests/e2e/cmd-layout.spec.ts`（新） |
| B19 | `docs/round3/STORE-LISTING.md` 的關鍵字欄 `Buffer.byteLength(...) ≤ 100`、名稱 ≤ 30 字元、副標 ≤ 30、宣傳文字 ≤ 170 | `tests/unit/store-listing.test.ts`（新） |
| B20 | `grep -n "優先挑評價" src/prompt.ts` 與 `grep -n "已依評價排序" src/prompt.ts` 都是 0 筆；`grep -n "places\[0\]" api/order.ts` 0 筆 | checker 手跑 |
| B21 | `src/modeLines.ts` 全部語料 `findBanned()` 0 命中，且不含「或」「也可以」「備選」（T1、T7） | `tests/unit/modeLines.test.ts`（新） |

**正式站驗收（人工，不是 STOP，但要寫進交付訊息）**
- 同一座標連續要 10 次「吃」、每次回報完成：≥ 8 家不同的店。
- 20 次「吃」的 `x-timing` p95 ≤ 6 s；`x-places-calls` 每次 ≤ 2。
- `node scripts/probe-lanes.mjs`（需要 `GOOGLE_PLACES_KEY`）：每條 lane 回 200；回 400 的 lane 在 `src/lanes.ts` 標 `verified:false`。

### A.3 離線重播門檻（S6 的 JSON 報表欄位）

合成候選池規格在附錄 1。三種方針各跑 200 個種子、14 天 × 2 餐。

| 欄位 | 門檻 | 適用方針 |
|---|---|---|
| `repeat7d` 7 天內同店重複率 | < 0.15 | balanced、recon |
| `distinct12` 任一連續 12 餐的不重複店數（200 次的中位數） | ≥ 9 | balanced、recon |
| `top3Share` 貝氏前 3 名占比 | < 0.50 | 全部 |
| `bayesDrop` 被選店平均貝氏評分，相對「舊版＝池子前 8 名平均」的降幅 | ≤ 0.15 | balanced |
| `chainShare` 連鎖占比 ÷ 池中連鎖占比 | ≤ 0.70 | balanced；recon 在非連鎖 ≥ 3 家時必為 0 |
| `belowFloor` 低於 3.7／5 則的被選次數 | 0 | 全部 |
| `budgetHit` `budget:[1]` 時 band∈{1,null} 的占比 | ≥ 0.95 | 全部 |
| `dislikedHit` 被標 never_again 後再出現次數 | 0 | 全部 |
| `familiarRevisit` 回訪比例 | 0.35–0.65 | familiar |

門檻達不到時，**只准在 R3 §2.4 給的範圍內調參**（T 0.25–0.5、λ 0.8–2.0、半衰期、wildcard 0.1–0.3）；調完仍不過就回報，不准改門檻。

---

## B. 型別契約（Team Lead 在派工前先寫進 repo）

四條工作流都 import 這些；**派工後不准任何工作流改 `src/types.ts` 的既有欄位**，要加欄位就回報 Team Lead。

### B.1 `src/types.ts`（整檔替換；舊欄位語意不變）

```ts
// 資料模型 — DECIDE-DEV-DOC-v1.md 第 5 節；Round 3（DEV-PLAN-3 §B）加發掘／價位／記憶欄位。

export type Level = 0 | 1 | 2 // 菜鳥班長 / 值星班長 / 士官長
export type ModuleId = 'eat' | 'go' | 'attend' | 'rest' | 'sleep' | 'reply' | 'buy' | 'travel'

// ── Round 3：地區、價位、發掘 ──────────────────────────────────────
/** 由座標判定（src/price.ts countryOf），不看手機語系。other = 台日以外：預算列隱藏、不顯示幣別。 */
export type Country = 'TW' | 'JP' | 'other'
/** 價位檔（每人每餐）：1 銅板 / 2 一般 / 3 犒賞 / 4 豪賞。切點在 src/price.ts CUTS（R3§4.2）。 */
export type Band = 1 | 2 | 3 | 4
export type PriceLevel =
  | 'PRICE_LEVEL_UNSPECIFIED' | 'PRICE_LEVEL_FREE' | 'PRICE_LEVEL_INEXPENSIVE'
  | 'PRICE_LEVEL_MODERATE' | 'PRICE_LEVEL_EXPENSIVE' | 'PRICE_LEVEL_VERY_EXPENSIVE'
/** 偵察方針（持久設定，首頁切換）：熟門熟路 / 均衡（預設）/ 全面偵察。 */
export type Novelty = 'familiar' | 'balanced' | 'recon'
/** 這家店對使用者是新的、回訪的、還是偵察抽到的。伺服器算，模型只負責講。 */
export type PickMode = 'new' | 'revisit' | 'wildcard'
/** 換一家的原因（A4）。 */
export type ReissueReason = 'closed' | 'not_this_kind' | 'never_again'

/** Places 回來、經 toCandidates 整理後的一家店（原本在 prompt.ts，Round 3 移到這裡）。只活在單次請求，不落地。 */
export interface PlaceCandidate {
  id: string
  name: string
  walkMin?: number
  openUntil?: string
  /** 尚未開門但 60 分內會開：HH:MM（當地時間）。 */
  opensAt?: string
  primaryType?: string
  types?: string[]
  rating?: number
  ratingCount?: number
  priceLevel?: PriceLevel
  /** Google priceRange；start 含、end 不含；end 缺 = 無上限。 */
  priceRange?: { start?: number; end?: number; currency?: string }
  /** 這家是哪條 lane 撈到的（src/lanes.ts），除錯用。 */
  lane?: string
}

/** 送到伺服器的記憶摘要：只有 place_id、我方事件時間戳、我方品牌鍵。沒有店名、評分、座標（R3§3.3）。 */
export interface PlaceMemSummary {
  id: string
  /** 最近 ≤5 次被出成口令的時間戳（ms），新的在前。 */
  sh: number[]
  /** 最近 ≤5 次回報完成的時間戳（ms），新的在前。 */
  dn: number[]
  /** 不再出現直到（ms）；'forever' = 永久。 */
  x?: number | 'forever'
  fav?: boolean
  /** 我方連鎖字典的品牌鍵（src/chains.ts）。同品牌曝光合併計算。 */
  b?: string
}

/** 本機 IndexedDB 的完整記憶（src/placeMem.ts）。 */
export interface PlaceMemEntry {
  id: string
  module: 'eat' | 'rest'
  shown: number[] // ≤ 10，新的在前
  done: number[] // ≤ 10，新的在前
  dislikeUntil?: number | 'forever'
  dislikes: number // never_again 次數；第 2 次 → forever
  fav?: boolean
  brand?: string // 我方品牌鍵
  cuisine?: string // 細類鍵（src/discovery.ts cuisineOf）
}

/** 細類偏好 Beta(a,b)，初值 (1,1)。key 由 cuisineOf 產生，是我方歸群，不是 Google 內容。 */
export type CuisineStats = Record<string, [number, number]>

export interface PickResult {
  place: PlaceCandidate
  mode: PickMode
  /** 過去 done 次數 + 1（revisit 時口令講「第 N 次」）。 */
  visits: number
  /** 哪些硬過濾被放寬了（'floor' | 'cooldown' | 'price' | 'dislike'）。非空就要 console.warn。 */
  relaxed: string[]
  /** recon 下附近已無曝光為 0 的店。 */
  exhausted: boolean
}

export interface IntakeField {
  key: string // 'diet' | 'transport' | 'minutes' | 'occasion' | 'stars' | 'budget' ...
  label: string
  /** chips 單選；stars 1–5；bands = 價位檔多選（只在 eat）：options 留空，標籤由 src/price.ts bandLabels(country) 依國家產生，值走 OrderRequest.budget 不走 choices。 */
  type: 'chips' | 'stars' | 'bands'
  options?: string[]
  default: string | number
}

export interface ModuleCard {
  id: ModuleId
  title: string
  subtitle: string
  intake: IntakeField[]
  needsPlaces: boolean
  placesQuery?: {
    includedTypes: string[]
    radiusByTransport?: Record<string, number>
    textQuery?: { key: string; byOption: Record<string, string> }
  }
  promptHint: string
  reissueLabel: string | null // Round 3：eat / rest 改「換一家」，原因在底部選單
  stopVerdictAllowed: boolean
}

export interface OrderRequest {
  module: ModuleId
  level: Level
  choices: Record<string, string | number>
  loc?: { lat: number; lng: number; label?: string }
  now: string // ISO，含時區
  /** 本次操作已出現過的 place_id（換一家）。語意不變。 */
  exclude?: string[]
  recentOrders: { module: ModuleId; big: string; at: string }[]
  // ── Round 3 ──
  /** 相鄰檔位、升冪；undefined 或 [] = 不限。 */
  budget?: Band[]
  /** 缺省 'balanced'。 */
  novelty?: Novelty
  /** ≤ 200 筆，依最近事件時間排序。伺服器不落地、log 不記 id。 */
  mem?: PlaceMemSummary[]
  cuisine?: CuisineStats
  /** 本次操作「今天不想吃這類」的細類鍵。 */
  rejectedCuisines?: string[]
  /** 只給測試／重播用的固定種子；正式前端不帶。 */
  seed?: number
}

export interface Order {
  verdict: 'do' | 'stop'
  meme: { top: string; big: string; bot: string }
  steps: string[]
  // mapUrl 與 Round 3 欄位只由伺服器填（api/order.ts withPlace）；模型寫的一律被 enforceRules 丟掉。
  place?: {
    id: string
    name: string
    walkMin?: number
    openUntil?: string
    opensAt?: string
    mapUrl?: string
    mode?: PickMode
    visits?: number
    /** null = 價位未知（口令卡要顯示「價位未知」）。 */
    band?: Band | null
    /** 直接由 Google 當次回傳值組成的顯示字串（例「≈NT$150–400」「≈¥1,000〜2,500」）。不落地保存。 */
    priceText?: string
    country?: Country
    cuisine?: string
    brand?: string
    exhausted?: boolean
  }
  log: string
}

/** enforceRules 的 Round 3 上下文（api/order.ts 組，純函式不碰 I/O）。 */
export interface EnforceCtx {
  level: Level
  country: Country
  pick?: PickResult | null
}

export interface OrderDebug {
  module: ModuleId
  level: Level
  model?: string
  ms?: { places: number; claude: number; total: number }
  outTokens?: number
  places?: {
    how: string // 'lane=ramen_restaurant rank=DISTANCE' 或 'text="居酒屋"'
    tries: { r: number; raw: number; kept: number }[]
    candidates: { name: string; rating?: number; count?: number; walkMin?: number; openUntil?: string; opensAt?: string; band?: number | null }[]
  }
  /** Round 3：發掘引擎的決定過程。不含 place_id。 */
  pick?: { mode: PickMode; lane: string; pool: number; afterFilter: number; relaxed: string[]; exhausted: boolean; seed?: number }
  /** Round 3：候選中有價位資料的比例（R3§4.3 第一週遙測）。 */
  price?: { country: Country; known: number; total: number }
  retry?: 'nonanswer' | 'noplace'
  forced?: string
  picked?: string
  error?: string
}

export interface DiaryEntry {
  id: string // `${ts}-${module}`
  ts: string
  module: ModuleId
  level: Level
  big: string
  /** @deprecated Round 3 起不再寫入（Google 條款 R3§3.3）；只為讀舊資料保留，顯示時 fallback 到 big。 */
  placeName?: string
  /** Round 3：之後靠這個對回 PlaceMem（愛店／不再推薦）。 */
  placeId?: string
  outcome: 'done' | 'reissued' | 'punished'
  reason?: ReissueReason
  mode?: PickMode
}

export interface WeeklyRequest {
  weekStart: string
  level: Level
  entries: DiaryEntry[]
  /** Round 3：前端由 PlaceMem 算好（B1），伺服器只轉述。 */
  discovery?: { newPlaces: number; revisits: number }
}

export interface WeeklyReport {
  weekStart: string
  level: Level
  stats: {
    orders: number; complianceRate: number; punishments: number; weakestModule: ModuleId | null
    /** Round 3：本週新占領／回防。 */
    newPlaces?: number; revisits?: number
  }
  body: string
  verdict: string
}

/** C2：沒有定位時手動報地點。伺服器用 Text Search 換座標，不落地。 */
export interface GeocodeRequest { q: string }
export interface GeocodeResponse { loc: { lat: number; lng: number }; label: string }
```

同一步要做的相容搬動（Team Lead）：
- `src/prompt.ts:7-17` 的 `PlaceCandidate` 介面刪掉，改成 `export type { PlaceCandidate } from './types.ts'`，其餘 import 不用動。
- `api/weekly.ts:19-23` 的 `WeeklyRequest` 改 import `types.ts`。

### B.2 四個契約模組（Team Lead 先寫**空殼**，簽名就是契約；W4 填實作、W1 直接 import）

空殼的行為要能讓既有測試照樣綠。

```ts
// src/price.ts — W4 實作。價位檔、國家判定、顯示字串（R3§4.2–4.3）。
import type { Band, Country, PlaceCandidate } from './types.ts'
export const CUTS: Record<'TW' | 'JP', readonly [number, number, number]> = { TW: [150, 400, 1000], JP: [1000, 2500, 6000] }
/** 座標 → 國家。台灣：lat 21.5–26.5 且 lng 118.0–122.5；日本：lat 24.0–45.6 且 lng 122.9–146.0；其餘 other。 */
export function countryOf(loc: { lat: number; lng: number } | undefined): Country { void loc; return 'TW' }
/** priceRange.currency 'TWD'→TW、'JPY'→JP，其餘 undefined。有幣別以幣別為準，再看座標。 */
export function currencyCountry(code?: string): Country | undefined { void code; return undefined }
/** 1–4，可為 x.5（priceLevel 粗映射）；null = 無資料／FREE／UNSPECIFIED。 */
export function bandOf(p: Pick<PlaceCandidate, 'priceLevel' | 'priceRange'>, country: Country): number | null { void p; void country; return null }
/** 命中 1.0；相鄰 0.35；未知 0.5；其餘 0。wanted 空 = 不限 → 1.0。strict 時相鄰與未知都 0。 */
export function priceFit(band: number | null, wanted: Band[] | undefined, strict = false): number { void band; void wanted; void strict; return 1 }
/** chips 文字：TW ['≤150','150–400','400–1,000','1,000+']、JP ['〜¥1,000','¥1,000〜2,500','¥2,500〜6,000','¥6,000〜']；other 回空陣列（列隱藏）。 */
export function bandLabels(country: Country): { band: Band; label: string }[] { void country; return [] }
/** 只用 Google 當次回傳值組字串；沒有資料回 undefined（口令卡顯示「價位未知」）。禁止推估金額。 */
export function priceText(p: Pick<PlaceCandidate, 'priceLevel' | 'priceRange'>, country: Country): string | undefined { void p; void country; return undefined }
/** 抓文字裡的金額片段（NT$120、¥1,000、120元、1000円、150–400），給 enforceRules 比對。 */
export function amountsIn(text: string): string[] { void text; return [] }
```

```ts
// src/chains.ts — W4 實作。連鎖判定（A5）。字典是我方資料，不是 Google 內容。
import type { Country } from './types.ts'
export interface Brand { key: string; names: string[]; country: Country | 'both' }
export const BRANDS: Brand[] = []
/** 去掉分店字尾：「○○ 南京店」「○○店」「○○ 渋谷店」「○○（信義）」→ 品牌名。 */
export function stripBranch(name: string): string { return name }
/** 店名命中字典 → 品牌鍵；否則 undefined。 */
export function brandKeyOf(name: string): string | undefined { void name; return undefined }
/** 同一批候選內：字典品牌鍵優先；否則 stripBranch 後前綴相同 ≥2 家聚成 'cluster:<前綴>'。回 id → 鍵。單獨一家不出現在 Map 裡。 */
export function clusterKeys(cands: { id: string; name: string }[]): Map<string, string> { void cands; return new Map() }
```

```ts
// src/tz.ts — W4 實作。時區由座標決定（B2），伺服器在 UTC 也要對。
export type Tz = 'Asia/Taipei' | 'Asia/Tokyo'
export function tzOf(loc: { lat: number; lng: number } | undefined): Tz { void loc; return 'Asia/Taipei' }
/** ISO → 當地 HH:MM。 */
export function hhmmIn(iso: string, tz: Tz): string {
  return new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(new Date(iso))
}
/** 當地星期幾，週一 = 0（對 Google weekdayDescriptions 的順序）。 */
export function weekdayMondayIndex(now: Date, tz: Tz): number { void tz; return (now.getDay() + 6) % 7 }
/** 當地小時 0–23（午餐時段隱藏豪賞檔用）。 */
export function hourIn(now: Date, tz: Tz): number { void tz; return now.getHours() }
```

```ts
// src/locale.ts — 既有檔。Team Lead 只加 country 參數（預設 'TW'，行為不變）；W4 實作日本分支。
export function localizeText(text: string, country: Country = 'TW'): LocalizeResult
export function localizeFields<T extends object>(obj: T, paths: (keyof T & string)[], country: Country = 'TW'): { value: T; hits: string[] }
```

### B.3 `src/cards.ts` 的資料變更（Team Lead 同步做，W1 之後只改 promptHint）

- `eat.intake` 加第三列：`{ key: 'budget', label: '預算', type: 'bands', default: '' }`（T5：仍是 3 列）。
- `eat.reissueLabel`、`rest.reissueLabel` 改 `'換一家'`。
- `tests/unit/cards.test.ts:40`「每個 chips 欄位的 default 都存在於 options」只針對 `type==='chips'`，要確認它不會把 bands 列算進去（若會，改成過濾 chips，這是 §E.3 列明的斷言修改）。

### B.4 `package.json`／`tsconfig`／未追蹤檔（Team Lead）

- `src/typesafe.ts:39` 改成 `opts.baseUrl ?? process.env.TYPESAFE_BASE_URL ?? TYPESAFE_URL`（並處理 `typeof process` 保護），讓 S1 先綠。
- `src/jevJudge.ts`、`src/typesafe.ts`、`scripts/effort-route.mjs` 一起進版控（W1 可選用 jevJudge 當連鎖第三層，**不得成為必要依賴**）。
- `package.json` scripts 加：`"replay": "vitest run tests/unit/discovery-replay.test.ts"`、`"probe:lanes": "node scripts/probe-lanes.mjs"`。
- `tsconfig.node.json` 的 `include` 不用動（e2e 新檔都在 `tests/e2e/`）。

---

## C. 工作流拆解（4 條並行；檔案互不重疊）

**檔案所有權總表**（只准寫自己那欄；要改別人的檔 → 回報 Team Lead）

| 檔案 | 擁有者 |
|---|---|
| `src/types.ts`、`src/cards.ts`（intake／reissueLabel 資料）、四個空殼、`package.json` | Team Lead（§B） |
| `src/discovery.ts`、`src/lanes.ts`、`src/modeLines.ts`、`src/places.ts`、`src/prompt.ts`、`src/rules.ts`、`src/cards.ts`（promptHint 字串）、`api/order.ts`、`api/weekly.ts`、`api/geocode.ts`、`scripts/probe-lanes.mjs`、`tests/unit/{discovery,discovery-replay,lanes,modeLines,rules,handler,order,places-link,weekly,geocode}.test.ts` | **W1** |
| `src/app.tsx`、`src/placeMem.ts`、`src/diary.ts`、`src/api.ts`、`src/meme.tsx`、`src/styles.css`、`src/debug.ts`、`src/mockOrders.ts`、`tests/unit/{placeMem,diary,debug}.test.ts`、`tests/e2e/**`（含 fixtures） | **W2** |
| `src/consent.tsx`、`src/privacy.tsx`、`src/report.ts`、`public/manifest.webmanifest`、`public/icons/*`、`index.html`、`scripts/build-icons.mjs`、`docs/round3/STORE-LISTING.md`、`docs/round3/CAPACITOR-READY.md`、`docs/round3/W3-HANDOFF.md`、`tests/unit/{consent,store-listing}.test.ts(x)` | **W3** |
| `src/price.ts`、`src/chains.ts`、`src/tz.ts`、`src/locale.ts`、`tests/unit/{price,chains,tz,locale}.test.ts` | **W4** |

每條工作流在自己的分支（建議 `claude/r3-w1-engine`、`r3-w2-client`、`r3-w3-store`、`r3-w4-data`）或 git worktree 工作；交付前在自己分支跑 S1–S4（S5 只有 W2 必跑，其他人跑不壞就行）。

---

### W1　伺服器發掘引擎＋候選池＋價位套用＋日本時區（A1、A2、A3 伺服器側、A5、B1 語意、B2 伺服器側、B4、C2 伺服器側、C3 伺服器側）

**目標**：店由程式決定，Claude 只寫口令；每次 ≤ 2 次 Places 呼叫；同座標不重複；價位、連鎖、記憶、方針全部在伺服器純函式裡算，可用固定種子重現。

**步驟（依序）**

1. `src/places.ts`
   - `FIELD_MASK` 加 `places.types`、`places.priceLevel`、`places.priceRange`（同 Enterprise SKU，R3§0-3）。`RawPlace` 加對應欄位。
   - `FETCH_COUNT` 15 → 20；刪 `MAX_RESULTS` 與 `places.ts:169-170` 的「只留 ≥4.0 且 ≥10 則、取前 8」；**保留**貝氏排序（除錯畫面好讀），品質保底移到 `pickPlace`。
   - `toCandidates(raw, origin, now, exclude, tz)`：加 `tz` 參數（預設 `'Asia/Taipei'`）；`closingTime(descriptions, now, tz)` 用 `weekdayMondayIndex(now, tz)`；`hhmmTaipei` 刪掉改 `hhmmIn(iso, tz)`；把 `types`、`priceLevel`、`priceRange`（換算成 `{start,end,currency}`，Money 的 `units`+`nanos` 要轉數字）帶進 `PlaceCandidate`。
2. `src/lanes.ts`（新）
   - `LANES: { id: string; types: string[]; group: string; verified: boolean; since: '2023' | '2024-11' | '2026-02' }[]`。2023 就在 Table A 的（`ramen_restaurant`、`sushi_restaurant`、`japanese_restaurant`、`chinese_restaurant`、`korean_restaurant`、`italian_restaurant`、`thai_restaurant`、`vietnamese_restaurant`、`indian_restaurant`、`american_restaurant`、`pizza_restaurant`、`hamburger_restaurant`、`seafood_restaurant`、`steak_house`、`vegetarian_restaurant`、`vegan_restaurant`、`breakfast_restaurant`、`brunch_restaurant`、`fast_food_restaurant`、`bakery`、`cafe`、`coffee_shop`、`ice_cream_shop`）標 `verified:true`；R3§1.3 標為新增的（`taiwanese_restaurant`、`noodle_shop`、`chinese_noodle_restaurant`、`hot_pot_restaurant`、`japanese_izakaya_restaurant`、`yakiniku_restaurant`、`yakitori_restaurant`、`tonkatsu_restaurant`、`japanese_curry_restaurant`、`fine_dining_restaurant`）標 `verified:false`，**只有 Team Lead 跑完 `probe:lanes` 回 200 才翻成 true**。
   - `pickLane(card, choices, cuisine, country, rng)`：甜食 → 甜食 lane 組；忌口「素」→ `vegetarian_restaurant`（修 STRATEGY §2 次要問題）；其餘：75% 依 `cuisine` Beta 抽樣挑 group、25% 均勻隨機；只在 `verified` 的 lane 裡挑；`rankPreference` 在 `POPULARITY`／`DISTANCE` 交替（用 rng）。`rest` 卡沿用 Text Search，`rankPreference` 在 `DISTANCE`／`RELEVANCE` 交替。
   - `cuisineOf(primaryType, types)` 放這裡（或 discovery.ts，擇一），歸群：`ramen / jp / tw / cn / kr / western / noodle / hotpot / seafood / veg / sweet / cafe / fast / other`。
3. `src/discovery.ts`（新，純函式，無 I/O）
   - `mulberry32(seed)`；`exposure(entry, now)`（Σ exp(−ln2·Δt/半衰期)，shown 10 天、done 21 天）；`bayes(p)` 沿用 `ratingScore`。
   - `pickPlace(cands, mem, cuisine, ctx): PickResult | null`，`ctx = { now, country, budget, novelty, exclude: Set, rejectedCuisines: Set, clusters: Map<id, key>, rng }`。流程照 R3§2.2：硬過濾（floor 3.7／5 則 → dislike → exclude → 最近 3 次 shown 冷卻 → 價位 strict 只在 recon 以外且 `priceFit===0`）**任一步剩 < 5 家就放寬該步並記 `relaxed`**；wildcard 機率依方針（familiar 0、balanced 0.2、recon 1.0）；打分（Thompson q、細類 Beta、曝光 −λ·E、連鎖 ×0.6、步行 ÷25、priceFit、rejectedCuisines ×0.5、fav 在 familiar ×2）；Efraimidis–Spirakis 取最大。方針參數：familiar λ=0.6、balanced λ=1.2、recon 只留曝光 0 且非連鎖，不夠 3 家 → `exhausted:true` 並退回 balanced 打分。
   - **同品牌曝光合併**：`exposure` 對同 `b`／cluster 鍵的 mem 取和。
   - `mode`：曝光 0 → wildcard 抽到的就 `wildcard`、否則 `new`；曝光 > 0 → `revisit`，`visits = done.length + 1`。
4. `src/modeLines.ts`（新）：三火力 × {new, revisit(N), wildcard, exhausted} 各 ≥ 4 句的 `meme.top` 替換語料；`revisit` 用 `{N}` 佔位。全部過 `findBanned()`；不含「或／也可以／備選」。
5. `src/prompt.ts`
   - 刪規則 6 的「優先挑評價數多且分數高」與 user 段「候選店家（已依評價排序…）」清單。
   - 改成：`【店已決定】place.id=…、place.name=…、步行 N 分、營業到／HH:MM 開、價位：{priceText 或「價位未知」}、mode={new|revisit|wildcard}、第 {visits} 次。你只負責寫口令，meme.big 就是這家店名；禁止提到別家店、禁止自己生金額。` 規則 6 改成「有【店已決定】時 place 照填」。
   - `max_tokens` 900 → 600（B4）；`buildOrderPrompt(req, pick: PickResult | null, country)` 簽名改掉 `places` 陣列。
6. `src/rules.ts`
   - `enforceRules(order, module, choices, now, recent, ctx?: EnforceCtx)`：
     - 有 `ctx.pick` → `place` 強制覆寫為 pick 的店（T2）、`meme.big` 覆寫成店名 ≤10 字；
     - mode 語意檢查（B6）不過 → `meme.top` 換 `modeLines`；`exhausted` → 換 exhausted 語料；
     - `scrubAmounts`：`amountsIn(所有文字)` 中不在 `priceText` 裡的金額拔掉並 warn（B7）；
     - 伺服器端 `findBanned` 掃 `meme`／`steps`／`log`，命中欄位換成語料或刪該句（B8、C3）；
     - `localizeOrder(order, ctx.country)` 傳國家；
     - 模型寫的 `place.mode/visits/band/priceText/...` 一律丟掉再由伺服器填。
7. `api/order.ts`
   - 流程：`country = currencyCountry(...) ?? countryOf(loc)`、`tz = tzOf(loc)` → `pickLane` → 第 1 次 Places（lane、半徑 800、`maxResultCount: 20`、`rankPreference`、`languageCode` 台灣 `zh-TW`／日本先維持 `zh-TW` 並在 debug 記 `country`，H6 待實測）→ `toCandidates(..., tz)` 有效 < 5 家才第 2 次（`restaurant`＋另一個 rankPreference＋半徑 ×2.5）；**不並行、總共 ≤ 2 次**；lane 回 400 → 自動退回 `restaurant` lane（算在那 2 次裡）。
   - `clusterKeys(cands)` → `pickPlace` → 沒結果 → 502 `no_places`。
   - prompt 只帶已決定那家；模型回別家 → **不重打**，直接 `enforceRules` 覆寫（`dbg.forced` 記店名）；`nonanswer` 仍重打一次。
   - `withPlace(order, pick, country)`：填 `mapUrl`、`mode`、`visits`、`band`、`priceText`、`country`、`cuisine`、`brand`、`exhausted`。
   - 匿名 log 一行：`[pick] module=eat mode=new lane=ramen_restaurant pool=23 kept=17 known_price=0.61 country=TW seen14d=false relaxed=-`（**不記 place_id、不記座標**，R12）。`dbg.pick`、`dbg.price` 照 `OrderDebug` 填。
   - `x-places-calls` 照實回。
8. `api/geocode.ts`（新，C2）：POST `{q}` → Text Search（`pageSize:1`、fieldMask `places.location,places.displayName`、`languageCode:'zh-TW'`）→ `{loc,label}`；查不到 404 `{error:'not_found', message:'找不到這個地方。報個車站或地標。'}`；一律 `export default { fetch: handler }`（§E.2 坑 1）；回 `x-places-calls: 1`。
9. `api/weekly.ts`：`WeeklyRequest.discovery` 進 user prompt（「【已算好】本週新占領 N 個據點、回防 M 次，直接用」），`stats` 帶 `newPlaces`／`revisits`；`buildUser` 的 `e.placeName ?? e.big` 改成 `e.big`。
10. `scripts/probe-lanes.mjs`：讀 `GOOGLE_PLACES_KEY`，對台北（25.0330,121.5654）與東京（35.6812,139.7671）各打一次每條 lane（`maxResultCount:1`），印 `lane / status / raw 筆數`，exit 非 0 若任一 400。**只有 Team Lead／Cross 跑**，W1 不需要金鑰。
11. 測試
    - `tests/unit/discovery.test.ts`：B2、B3、B4、同品牌合併、mode／visits、三方針的 wildcard 機率、`relaxed` 行為、`seed` 可重現。
    - `tests/unit/discovery-replay.test.ts`：附錄 1 的合成池 + A.3 全部門檻，console 印 JSON 報表。
    - `tests/unit/lanes.test.ts`：素食 lane、甜食 lane、只挑 verified、交替 rankPreference。
    - `tests/unit/modeLines.test.ts`（B21）、`tests/unit/rules.test.ts`（B6、B7、B8、country 傳遞）、`tests/unit/geocode.test.ts`。
    - 改既有：`handler.test.ts`（§E.3 列明的四條）、`order.test.ts`（§E.3）、`places-link.test.ts`（`withPlace` 新簽名）、`weekly.test.ts`（discovery 數字進 prompt）。
    - B1 用合成 40 家池 mock `fetch`，連打 10 次並回填 `mem`。

**驗收**：S1–S4、S6；B1–B8、B20、B21；`grep -c "places\[0\]" api/order.ts` = 0；`x-places-calls` 在 handler 測試中 ≤ 2。

**不要做**：不改 `src/types.ts`（回報）；不改前端任何檔；不接 Jev 為必要路徑（接了也要 `timeoutMs ≤ 800` 且失敗靜默）；不在 log 或 debug 記 place_id／座標；不讓模型再看到候選清單；不改 `DECIDE-DEV-DOC-v1.md` 第 7 節七條絕對規則本身（規則 6 的措辭改動要同步寫進該文件第 7 節，這是計劃允許的）；不動 `Level`、`Mood`；不用 `(req,res)` 形狀的 export。

---

### W2　前端：記憶、回饋、價位輸入、方針、日記／週報、同意與手動地點掛載（A1 前端、A3 UI、A4、B1 顯示、C1 前端、C2 前端、C3 入口）

**目標**：拿到口令的當下就記 `shown`；三顆鍵＋原因選單把每個回饋寫進 `PlaceMem`；預算 chips 依國家顯示；方針可切換；日記／週報看得見「新占領／回防」。

**步驟**

1. `src/placeMem.ts`（新，idb-keyval，key `decide.placeMem`／`decide.cuisine`，**跟 diary 分開**）
   - `markShown(id, {module, brand?, cuisine?}, now)`、`markDone(id, cuisine, now)`（細類 `a += 1`）、`markClosed(id, now)`（`dislikeUntil = now + 24h`，不動細類）、`markNotThisKind(cuisine)`（`b += 0.5`）、`markNeverAgain(id, now)`（90 天；第 2 次 `'forever'`）、`setFav(id, on)`。
   - `memSummary(module, now, limit = 200): PlaceMemSummary[]`（`sh`／`dn` 各取 ≤5）、`cuisineStats()`、`discoveryStats(weekStart, now): {newPlaces, revisits}`（newPlaces = 本週有 done 且更早沒有 done 的店數；revisits = 其餘本週 done 次數）。
   - **絕不**寫入店名、評分、座標。
2. `src/diary.ts`：`makeEntry(ts, module, level, big, outcome, meta?: {placeId?, reason?, mode?})`——**不再接 `placeName`**；`recentOrders` 不變。
3. `src/api.ts`：`requestOrder` 不變；新增 `requestGeocode(q): Promise<GeocodeResponse>`；`ERROR_TEXT` 加 `not_found`；`ApiErrorKind` 加 `'not_found'`。
4. `src/app.tsx`
   - 狀態：`novelty`（localStorage `decide.novelty`，預設 balanced）、`budget: Band[]`（localStorage `decide.budget.TW`／`.JP` 分國家記住上次）、`country`（geoAhead 解析後 `countryOf(loc)` 更新；在 intake 前就先用 localStorage `decide.lastCountry`）、`reasonOpen`。
   - 首頁班長名牌旁一顆 `data-testid="novelty"` 按鈕，點一下循環三段（文字：`熟門熟路／均衡／全面偵察`），**不進 intake**。
   - `Intake`：`type==='bands'` 列用 `bandLabels(country)` 渲染，前面固定一顆「不限」；多選只准相鄰（選 1 和 3 → 自動補 2）；當地時間 11:00–14:00 隱藏 band 4（用 `hourIn(now, tzOf(loc))`，沒座標就不隱藏）；`country==='other'` 整列隱藏。chips ≥ 48 dp、間距 ≥ 8 dp、375×667 不捲動就按得到送出鍵（T5）。
   - `fetchOrder`：request 帶 `budget`、`novelty`、`mem: await memSummary(c.id)`、`cuisine`、`rejectedCuisines`、`exclude`。**拿到 Order 立刻 `markShown`**（修 STRATEGY §2⑦），再 `setScreen('cmd')`。
   - `reissue` → 開底部選單（三選一：`店關了／今天不想吃這類／這家不要再來`，`data-testid="reason-closed|reason-kind|reason-never"`）→ 對應 `markClosed`／`markNotThisKind`（並把 `place.cuisine` 加進 `rejectedCuisines`）／`markNeverAgain` → `record('reissued', …, {reason})` → `exclude.push(id)` → 重要一道。**一道口令最多換 1 次不變**（`app.tsx:154`）。
   - `done` → `markDone`；`skip`（沒做）不動 `PlaceMem`（STRATEGY A4：不服從是行為問題）。
   - `LogScreen` 加「列入愛店」次要鍵（`data-testid="fav"`）→ `setFav`。
   - `Diary`：有 `placeId` 的紀錄長按（沿用 `useLongPress`）→ 「列入愛店／不再推薦」兩鍵；`stats` 區多兩格「新占領 N／回防 M」（`discoveryStats`）。
   - `Weekly`：request 帶 `discovery`；卡片顯示 `stats.newPlaces`／`revisits`。
   - `Cmd`：`StepsCard` 下方加「回報這道口令」極小文字連結（`src/report.ts` 的 `reportMailto(order)`，W3 提供）；`ErrorScreen` 在 `no_location` 時顯示「手動報座標」輸入列（`data-testid="manual-loc"`）→ `requestGeocode` → 用回來的 `loc` 重送（不存本機）。
   - 首次啟動：localStorage `decide.consent` 沒有 → 先渲染 W3 的 `<Consent onAccept>`；同意前不呼叫 `/api/*`。設定頁入口：首頁底部小字「隱私」→ W3 的 `<Privacy>`。
5. `src/meme.tsx` `StepsCard`：店名連結後一行 `data-testid="place-meta"`：`步行 N 分 · 營業到 HH:MM（或 HH:MM 開）· {priceText ?? '價位未知'}`；下方 `<small translate="no" data-testid="attribution">Google Maps</small>`（R3§3.3，12–16 sp）。
6. `src/styles.css`：底部原因選單、bands chips、place-meta、attribution、consent 版面。**不改任何色票 token**（DEV-PLAN-2 規則 4）；新元素只用既有 `--ink/--line/--card/--mute` 等變數；每層 token 若要新增，淺色在前、深色 media block 緊接其後、集中在 `main[data-level]` 區（PITFALLS-UI）。
7. `src/debug.ts`／`Debug` 畫面：顯示 `dbg.pick`（mode、lane、pool、relaxed）與 `dbg.price`（known/total）。
8. `src/mockOrders.ts`：樣本加 `place.mode/visits/band/priceText`。
9. 測試
   - `tests/unit/placeMem.test.ts`（B13，用 `fake-indexeddb` 或 mock `idb-keyval`——沿用 `diary.test.ts` 的做法）、`diary.test.ts`（`makeEntry` 無 `placeName`）、`debug.test.ts`。
   - e2e：`fixtures.ts` 的 `FIXED_ORDER`／`SECOND_ORDER` 加 Round 3 欄位；新增共用 `prime(page)`：`addInitScript` 設 `decide.consent` 讓既有 38 條不被同意畫面擋住；新檔 `memory.spec.ts`（B14）、`budget.spec.ts`（B15）、`consent.spec.ts`（B16）、`manual-location.spec.ts`（B17，mock `/api/geocode`）、`cmd-layout.spec.ts`（B18）；改 `paths.spec.ts:29`「店關了」→「換一家」＋原因選單（§E.3）。

**驗收**：S1–S5；B13–B18；`grep -n "placeName" src/app.tsx src/diary.ts` 只剩讀取 fallback（`e.placeName ?? e.big`）與型別註解，沒有新寫入；`JSON.stringify(await memSummary())` 不含 `name|rating|lat|lng`。

**不要做**：不改 `src/types.ts`、`src/cards.ts`；不碰 `api/`（手動地點只呼叫 `/api/geocode`）；不新增帳號／雲端；不做日文介面；不改 `avatar.tsx`、`Mood`、`Level`；不把 `exclude` 改名；不讓換口令可以換第二次；不在同意畫面之外新增任何 onboarding 步驟（控制只多一下點擊）。

---

### W3　設計品味與上架準備（C1 文件與元件、C3 入口、C4、R2§5 必要 3／4／5／7／8）

**目標**：上架審核需要的靜態元件與文案一次備齊；程式保持 Capacitor-ready；所有文字台灣用語。

**步驟**

1. `src/consent.tsx`：`<Consent level onAccept />`。三句話版本（位置 → Google 查店；選擇與記憶摘要（只有店家代碼與時間）→ Anthropic 寫口令；日記與記憶只存在手機）；一顆主鍵「是！班長」寫入 `decide.consent = 'v1'`（寫入由 `onAccept` 的呼叫端做，元件本身不碰 storage）。用既有 `.screen/.notice/.btn` class，不新增 CSS；需要新樣式寫進 `docs/round3/W3-HANDOFF.md` 給 W2。文案走班長口吻但 `findBanned` 0 命中、不罵。
2. `src/privacy.tsx`：`<Privacy onBack />` 靜態頁：蒐集什麼、送給誰、存哪裡、怎麼刪（「清除 Safari 網站資料」）、聯絡方式（佔位 `[CONTACT_EMAIL]`，Cross 填）、Google Maps 歸屬與條款連結文字。
3. `src/report.ts`：`reportMailto(order: Order, level: Level): string` 組 `mailto:[CONTACT_EMAIL]?subject=…&body=…`（body 含 meme 三行與 steps，不含座標）。純函式、可測。
4. `public/manifest.webmanifest`：加 `lang: "zh-TW"`、`dir: "ltr"`、`categories: ["food","lifestyle"]`、`description` 改成上架副標；`id: "/"`；`theme_color`／`background_color` **不動**（規則 4）。`index.html`：`<html lang="zh-Hant-TW">`、`description` 同步。`public/icons/*` 若 `scripts/build-icons.mjs` 重跑結果與現檔不同就更新（必須仍在 NES 色盤；`tests/unit/palette-guard.test.ts` 要綠）。
5. `docs/round3/STORE-LISTING.md`：台灣與日本各一組——名稱（≤30）、副標（≤30）、關鍵字（≤100 bytes，實算）、宣傳文字（≤170）、描述（≤4000）、截圖腳本（6 張，每張對應真實畫面：首頁／intake 含預算／口令卡含價位與「沒去過」／換一家原因／日記新占領／週報）、年齡分級建議與理由、審核備註（逐條對應 R2§5 必要 1–8，標「已完成／本輪完成／缺」；4.3(b) 差異化：真店＋記憶＋發掘數字＋週報；1.1.1：罵行為不罵人；5.1.2：同意畫面）。日本文案標「待母語者驗證」。
6. `docs/round3/CAPACITOR-READY.md`：檢查表——不依賴 `server.url`、`navigator.share`／`geolocation`／`clipboard` 都有功能偵測（引用 `share.ts`、`api.ts` 行號）、相對路徑資源、`start_url` 與 `scope`、下一輪打包步驟。
7. 測試：`tests/unit/store-listing.test.ts`（B19：讀 md 的 fenced 區塊實算 bytes）、`tests/unit/consent.test.tsx`（渲染、點主鍵呼叫 `onAccept`、文案 `findBanned` 0 命中、不含中國用語——用 `localizeText` 斷言 hits 為空）、`tests/unit/report.test.ts`（mailto 編碼、不含座標）。

**驗收**：S1–S3；B19；`palette-guard` 綠；`W3-HANDOFF.md` 列出 W2 要掛載的三個元件的 props 與需要的 CSS class。

**不要做**：不碰 `src/app.tsx`／`styles.css`（掛載是 W2 的事）；不做 Capacitor 打包、不開 Apple 帳號；不自稱 Editors' Choice／得獎；不寫日文介面；不放其他 App 名稱進關鍵字（2.3.7）；不動色票。

---

### W4　純資料與純函式：價位檔位、連鎖字典、時區、地區用語（A3 資料層、A5 字典、B2）

**目標**：把 §B.2 四個空殼填成真實作，100% 單元測試可驗，沒有 I/O。

**步驟**

1. `src/price.ts`
   - `countryOf`：§B.2 註解的方框；先看 `currencyCountry`。
   - `bandOf`：照 R3§4.3——`priceRange` 有 `start`：`mid = end ? (start+end)/2 : start×1.3`，對 `CUTS[country]` 切；只有 `priceLevel`：INEXPENSIVE 1.5、MODERATE 2.5、EXPENSIVE 3.5、VERY_EXPENSIVE 4；其餘 null；`country==='other'` 只用 priceLevel 映射。
   - `priceFit`：命中 1.0（含 x.5 落在相鄰兩檔都算命中）、相鄰 0.35、未知 0.5、其餘 0；`strict` 相鄰與未知 0。
   - `bandLabels`：§B.2 註解的字串，**用金額文字不用 `$$$`**。
   - `priceText`：`priceRange` → `≈NT$150–400`／`≈¥1,000〜2,500`／無上限 `≈NT$1,000+`；只有 `priceLevel` → 回該檔的 `bandLabels` 文字前加「約」；無 → undefined。千分位照台灣習慣。
   - `amountsIn`：regex 抓 `NT\$?\s?\d[\d,]*`、`¥\s?\d[\d,]*`、`\d[\d,]*\s?(元|円|塊)`、`\d[\d,]*\s?[–~〜-]\s?\d[\d,]*`。
2. `src/chains.ts`：`BRANDS` 台灣 ≥ 50、日本 ≥ 50（速食、咖啡、牛丼、拉麵、鍋貼、飲料、便利商店不收——不是餐廳）；每個品牌 `names` 含常見中／日／英寫法（例 `{key:'mos', names:['摩斯漢堡','MOS BURGER','モスバーガー'], country:'both'}`）。`stripBranch` 處理「 X店」「X店」「（X）」「X分店」「X門市」「 X 店」。`clusterKeys` 照 §B.2。
3. `src/tz.ts`：`tzOf` 用 `countryOf` 的方框（JP → Tokyo，其餘 Taipei）；`weekdayMondayIndex`／`hourIn` 用 `Intl.DateTimeFormat(..., {timeZone, weekday:'short'/hour:'numeric', hour12:false})`。
4. `src/locale.ts`：`country==='JP'` 時 `地鐵→地下鐵`、`捷運→電車`（**不**套 `地鐵→捷運`）；其餘規則不分國家。`localizeFields` 傳遞 `country`。
5. 測試：`price.test.ts`（B9 + `priceFit` 全表 + `bandLabels` 兩國 + `amountsIn`）、`chains.test.ts`（B11 + `stripBranch` 六種字尾 + 聚類 ≥2 才成立）、`tz.test.ts`（B10：`TZ=UTC` 下用 `process.env.TZ` 或 vitest `--env` 固定；台北／東京 × 00:30／08:30／23:30）、`locale.test.ts` 追加 B12（既有 128 行的斷言不動）。

**驗收**：S1–S3；B9–B12；每個 export 至少一條測試；`chains.ts` 不含任何 Google 回傳的評分／座標資料。

**不要做**：不改簽名（空殼就是契約）；不 import `api/`、`app.tsx`；不把價位推估（細類→檔位）做進去（R3§4.3 說第一週量了覆蓋率再決定）；不用手機語系判國家。

---

## D. Effort 分流表

規則：選最便宜但能一次通過驗收的等級。Jev 可用時以 Jev 為準，不可用時用本表。

| 節點 | 內容 | 等級 | 理由（一句） |
|---|---|---|---|
| W1 | 整條 | **opus** | 演算法設計、跨模組整合、既有測試大改，錯了整輪白做 |
| W1.3 | `discovery.ts` + replay 調參 | opus | 要在 R3 參數範圍內讓六項門檻同時成立，是取捨不是照抄 |
| W1.1–2 | `places.ts`、`lanes.ts` | sonnet | 規格明確（FIELD_MASK、lane 表、交替規則） |
| W1.4–6 | `modeLines.ts`、`prompt.ts`、`rules.ts` | sonnet | 語料與檢查規則都寫死在計劃裡 |
| W1.7–9 | `api/order.ts`、`geocode.ts`、`weekly.ts` | opus | 流程重組＋三個 Vercel 坑＋不得並行呼叫，整合風險最高 |
| W1.10 | `probe-lanes.mjs` | haiku | 30 行腳本，照表打 API 印結果 |
| W2 | 整條 | **sonnet** | 標準前端實作，規格到 testid 層級 |
| W2.1 | `placeMem.ts` | sonnet | 事件→記憶的規則表已給；要小心 IndexedDB 冪等 |
| W2.4 | `app.tsx` 狀態機改動 | sonnet | 量大但方法已知 |
| W2.9 | e2e 新增五檔＋既有改動 | sonnet | Playwright 慣例已在 repo 裡 |
| W3 | 整條 | **sonnet** | 文案品質與審核條文對應需要判斷，但有 R2 當底 |
| W3.5 | STORE-LISTING 台灣文案 | sonnet | 台灣用語與 ASO 字數是品味題 |
| W3.4 | manifest／index.html／icons | haiku | 照表填值、跑既有腳本 |
| W4 | 整條 | **sonnet** | 純函式＋資料；連鎖字典需要台日餐飲常識 |
| W4.2 | 連鎖字典資料 | sonnet | haiku 會編出不存在的品牌 |
| W4.3–4 | `tz.ts`、`locale.ts` | haiku | Intl 用法與兩條替換規則 |
| INT | 合併與整合 e2e（§F） | opus | 四條分支衝突處理與最終閘門 |
| CHK | 獨立 checker（逐條對 A.2） | opus | 不修改、只給證據 |
| ESC | W1 兩次失敗後的升級 | fable | 只有這個節點保留給 fable |

### D.1 Jev choice 題目（`docs/round3/effort-tasks.json` 的內容；`node scripts/effort-route.mjs docs/round3/effort-tasks.json`）

`criteria` 固定用 `scripts/effort-route.mjs` 的 `TIER_CRITERIA`：

- haiku：規則完全明確、機械性、幾乎不需要判斷的工作：批次改名、照表填值、格式轉換、補簡單測試。
- sonnet：方法已知的標準開發工作：照規格實作功能、改 UI、寫單元與 e2e 測試，量可以很大但不需要新設計。
- opus：需要判斷或設計取捨的工作：演算法設計、跨模組整合、難以重現的錯誤、獨立審查或驗收。
- fable：高風險且 opus 很可能失敗的工作：整體架構重設、多方案權衡且錯了代價很大、opus 已經做過仍失敗的節點。

```json
[
  { "id": "W1",    "fallback": "opus",   "task": "在 TypeScript/Vercel 專案裡把餐廳推薦從「模型從評分排序清單挑第一名」改成「伺服器純函式加權抽樣（Thompson 品質抽樣、曝光指數衰減、連鎖降權、Efraimidis–Spirakis）」，新增 lane 輪替讓每次 ≤2 次 Google Places 呼叫，改寫 prompt 為「店已決定」，在 enforceRules 加 mode 語意檢查、金額來源檢查、伺服器端禁詞過濾，新增 geocode 端點，並用 200 種子的離線重播同時滿足六項新鮮度／品質門檻；既有 156 條測試除明列者外不得改。" },
  { "id": "W1.3",  "fallback": "opus",   "task": "實作 pickPlace(cands, mem, cuisine, ctx) 純函式與離線重播測試：硬過濾任一步剩 <5 家就放寬並記錄、三種方針參數、同品牌曝光合併、固定種子可重現；在 T 0.25–0.5、λ 0.8–2.0 範圍內調參使 7 天重複率 <15%、12 餐不重複 ≥9、前三名占比 <50%、平均貝氏降幅 ≤0.15、連鎖占比 ≤池×0.7、0 筆低於保底同時成立。" },
  { "id": "W1.1-2","fallback": "sonnet", "task": "改 src/places.ts：fieldMask 加 types/priceLevel/priceRange、Money 轉數字、拿掉前 8 名截斷、closingTime 與 opensAt 改用傳入的時區；新增 src/lanes.ts：lane 表（含 verified 旗標）、依細類 Beta 抽樣 75%／均勻 25% 挑 lane、rankPreference 交替、素食與甜食專用 lane；補單元測試。" },
  { "id": "W1.4-6","fallback": "sonnet", "task": "寫三火力 × 四種 mode 的 meme.top 替換語料（過禁詞表、不含「或／也可以／備選」）；改 prompt 為「店已決定」並刪候選清單；在 enforceRules 加：強制覆寫 place 為伺服器決定的店、mode 語意檢查不過就換語料、拔掉不在 priceText 內的金額、伺服器端 findBanned 掃描、把 country 傳給 localizeOrder；補單元測試。" },
  { "id": "W1.7-9","fallback": "opus",   "task": "重組 api/order.ts 流程：國家與時區由座標判定、pickLane → 第一次 Places → 有效候選 <5 才第二次（restaurant、半徑×2.5、不並行、lane 回 400 自動退回）→ clusterKeys → pickPlace → prompt 只帶一家 → 模型回別家不重打直接覆寫 → withPlace 填 mode/visits/band/priceText；新增 api/geocode.ts；api/weekly.ts 帶 discovery 數字；default export 必須是 { fetch }，改完跑 check:bundle；改四條既有 handler 測試斷言。" },
  { "id": "W1.10", "fallback": "haiku",  "task": "寫 scripts/probe-lanes.mjs：讀環境變數金鑰，對台北與東京座標各打一次每條 lane 的 Nearby Search（maxResultCount 1），印 lane／HTTP 狀態／筆數，任一 400 就 exit 1。" },
  { "id": "W2",    "fallback": "sonnet", "task": "React PWA 前端：新增 IndexedDB 的 PlaceMem（五種回饋事件與愛店，只存 place_id 與時間戳）、拿到口令當下記 shown、換一家改為三選一原因底部選單、依國家顯示台幣／日圓預算 chips（相鄰多選、午餐隱藏最高檔、記住上次）、首頁偵察方針三段切換、日記與週報顯示新占領／回防、口令卡顯示價位與 Google Maps 歸屬、首次同意畫面與手動報座標掛載；新增五個 e2e spec 並讓既有 38 條照過。" },
  { "id": "W2.1",  "fallback": "sonnet", "task": "實作 src/placeMem.ts：idb-keyval 讀寫，markShown/markDone/markClosed/markNotThisKind/markNeverAgain/setFav 各自對記憶與細類 Beta(a,b) 的更新、第二次 never_again 永久、memSummary 取最近 200 筆且 sh/dn 各 ≤5、discoveryStats 算本週新占領與回防；單元測試斷言序列化後不含 name/rating/lat/lng。" },
  { "id": "W2.9",  "fallback": "sonnet", "task": "Playwright（iPhone 13 profile）新增五個 spec：換一家原因→不再出現且重新整理後 request 的 mem 帶該 id；東京／台北假定位→預算 chips 幣別切換與相鄰補齊；首次啟動同意畫面且同意前 0 次 API；拒絕定位→手動輸入→mock geocode→口令；口令卡 375×667 不捲動可見五項資訊。既有 fixtures 加共用 prime() 讓舊測試不被同意畫面擋。" },
  { "id": "W3",    "fallback": "sonnet", "task": "為手機 PWA 準備 App Store 上架素材與合規元件：同意畫面與隱私頁 React 元件（不碰 app.tsx、不新增 CSS）、檢舉 mailto 純函式、manifest 與 index.html 補 lang/categories、台灣與日本商店文案（名稱≤30、副標≤30、關鍵字≤100 bytes 實算、宣傳≤170、描述≤4000）、六張截圖腳本、審核備註逐條對應 Apple 條文、Capacitor-ready 檢查表；補單元測試。" },
  { "id": "W3.5",  "fallback": "sonnet", "task": "用台灣繁體中文（非港式用語）寫 App Store 名稱、副標、關鍵字、宣傳文字與描述，主打「班長／口令／選擇困難／附近美食／不重複」而非「轉盤」，關鍵字不含其他 App 名稱；另寫日本版草稿並標示待母語者驗證。" },
  { "id": "W3.4",  "fallback": "haiku",  "task": "把 public/manifest.webmanifest 加 lang/dir/categories/id、index.html 的 lang 與 description 改成指定值，重跑 scripts/build-icons.mjs 確認輸出不變或更新圖示，色票不動並讓 palette-guard 測試通過。" },
  { "id": "W4",    "fallback": "sonnet", "task": "填實四個 TypeScript 純函式模組：價位（座標→國家、Google priceRange/priceLevel→檔位、相鄰／未知權重、台幣日圓 chips 文字、顯示字串、金額抓取）、連鎖（台日各 ≥50 個真實餐飲品牌字典、分店字尾剝除、同批候選前綴聚類）、時區（座標→Asia/Taipei 或 Asia/Tokyo、當地 HH:MM、當地星期與小時）、地區用語（日本不把地鐵換成捷運）；簽名已固定不得改；每個 export 都要有測試。" },
  { "id": "W4.2",  "fallback": "sonnet", "task": "建立台灣 ≥50、日本 ≥50 個真實存在的餐飲連鎖品牌字典（含中／日／英常見寫法，不收便利商店與純飲料店），並實作分店字尾剝除與同批候選的前綴聚類；測試「八方雲集 南京店／復興店」同鍵、「すき家 渋谷店」連鎖、「阿財魯肉飯」不是。" },
  { "id": "W4.3-4","fallback": "haiku",  "task": "用 Intl.DateTimeFormat 實作座標→時區、ISO→當地 HH:MM、當地星期（週一=0）與小時三個函式，並在 TZ=UTC 下對台北與東京各測三個時間；在 locale.ts 加 country 參數，日本時地鐵→地下鐵、捷運→電車，不套地鐵→捷運。" },
  { "id": "INT",   "fallback": "opus",   "task": "依指定順序合併四條分支（資料→引擎→上架→前端），解決 src/cards.ts、tests 的衝突，掛載 W3 元件到 app.tsx 的指定位置，跑 typecheck/unit/build/check:bundle/e2e/replay 六道閘門並逐條核對 21 條行為斷言，產出交付訊息。" },
  { "id": "CHK",   "fallback": "opus",   "task": "作為獨立 checker 不修改任何檔案，逐條對 DEV-PLAN-3 §A.2 的 S1–S6 與 B1–B21 給 PASS/FAIL 與證據（指令輸出、測試名稱、grep 結果），對只有 Chromium 的 e2e 環境明確標示不是 WebKit 契約。" }
]
```

---

## E. 必守的既有規則與坑（本輪相關的摘錄）

### E.1 DEV-PLAN-2 §1 不可推翻的規則（仍全部有效）

| # | 規則 | 本輪怎麼踩到 |
|---|---|---|
| 1 | 永遠不要整包覆蓋，逐檔搬；`git status` 出現 `deleted:` 立刻停 | W1 改 `places.ts`／`prompt.ts` 時只刪指定行 |
| 2 | 不為了綠燈改測試斷言，除非計劃明列 | 允許改的清單在 §E.3，**其他一條都不准動** |
| 3 | 不改 `src/avatar.tsx` 的 `Mood` | W2 的同意畫面、原因選單不加新 mood |
| 4 | 不改 UI 色票 | W2 新 CSS 只用既有 token；W3 manifest 的 `theme_color`／`background_color` 不動 |
| 5 | 不新增登入、帳號、多人、後端 DB | 記憶在 IndexedDB；伺服器無狀態；`api/geocode.ts` 不存任何東西 |
| 6 | 不動語氣護欄七條 | 規則 6 措辭改成「店已決定」是本計劃明列的改動，要同步 `DECIDE-DEV-DOC-v1.md` 第 7 節 |
| 7 | 凍結目錄一字不改：`decide-codex-handoff/`、`decide-design/`、`docs/research/` | — |
| 8 | 模型永遠不准產生 URL | `withPlace` 仍是唯一組 URL 的地方 |
| 9 | prompt 是盡力，`enforceRules()` 才是保證 | mode 語意、金額來源、禁詞、店家覆寫全部在 `rules.ts` |
| 10 | 不猜軍事常識 | 本輪不碰階級徽章 |

本輪新增：
11. **模型不選店、不排序。** 任何把候選清單塞回 prompt 的改法都是 FAIL（T2）。
12. **記憶只存 `place_id`、時間戳、我方品牌鍵／細類鍵。** 店名、評分、價位、座標不落地（R3§3.3）。`debug.ts` 現有 10 筆候選店名／評分留在 localStorage 的問題標為已知風險，交 Cross／法務，本輪不擴大（不要再往 debug 加更多 Google 欄位）。
13. **`exclude` 語意不變、一道口令最多換 1 次不變。**

### E.2 三個坑（DEV-PLAN-2 §2 + state 失敗紀錄）

1. **Vercel `export default` 必須是物件 `{ fetch: handler }`**，函式型 default 會讓請求掛住、狀態碼 0、沒有 log，且具名 `GET/POST` 被無視。`api/geocode.ts` 是新檔，最容易重犯。改 `api/` 後**一定**跑 `npm run check:bundle`；本機 `dev`／`smoke` 抓不到。
2. **`vercel.json` 不能刪**；`api/*.ts` 帶 `.ts` 副檔名的 import 靠 `includeFiles: "src/**"` 才進 lambda。新 `src/*.ts` 自動涵蓋，但 `api/geocode.ts` 若 import `scripts/` 或 `docs/` 就會 `ERR_MODULE_NOT_FOUND`。
3. **CSS 自訂屬性兩個坑**（PITFALLS-UI）：按最近祖先解析（`:root` 蓋不到 `main[data-level]`）；同 specificity 後者勝（深色 media block 要緊接在淺色之後、集中在同一區）。色盤類斷言要驗「值」不只驗門檻。

### E.3 本輪**明列允許**修改的既有測試斷言（規則 2 的例外清單，超出即 FAIL）

| 檔案 | 位置 | 改成 |
|---|---|---|
| `tests/unit/handler.test.ts` | 「第一圈沒有營業中的店 → 半徑放大再查一次」 | 「lane 有效候選 < 5 → 第二次 `restaurant`＋半徑 2000」，`x-places-calls` 仍 `2` |
| 同上 | 「模型只講類別…伺服器指定評價最高那家」 | 「模型只講類別 → 不重打，`place` 被 `pickPlace` 的結果覆寫，`dbg.forced` 有值」；`claude` 呼叫次數 1 |
| 同上 | 「模型第一次講類別、第二次挑對」 | 刪除（路徑不存在了）或改成 nonanswer 重打 |
| 同上 | `debug.places.how` 等於 `'types=restaurant'` | 改成含 `lane=` 的新格式；`tries` 形狀不變 |
| 同上 | 「模型被重打與被強制指定」 | `retry` 只在 nonanswer 出現；`forced` 在模型回別家時出現 |
| `tests/unit/order.test.ts` | :141「≥4.0 且 ≥10 則的有兩家以上就只留那些」 | 改成「照貝氏排序但全部保留」（保底移到 `pickPlace`） |
| 同上 | :153「好店不足兩家 → 不篩」 | 同上合併 |
| 同上 | :173 `closingTime`／`opensAt` | 加 `tz` 參數，台北結果不變 |
| `tests/unit/places-link.test.ts` | `withPlace(order, places)` | 新簽名 `withPlace(order, pick, country)`，四種情形語意不變 |
| `tests/unit/cards.test.ts` | :40 default 必在 options | 只檢查 `type==='chips'` |
| `tests/unit/diary.test.ts` | `makeEntry(..., placeName)` 呼叫 | 改新簽名 |
| `tests/unit/weekly.test.ts` | user prompt 內容 | 加 discovery 數字 |
| `tests/e2e/paths.spec.ts` | :29 `toHaveText('店關了')` | `'換一家'`，再點 `reason-closed` |
| `tests/e2e/*.spec.ts`（全部） | 開頭 | 加 `prime(page)` 設同意旗標 |
| **Team Lead 補授權（2026-10-22 紅隊修正輪）** | | |
| `tests/unit/price.test.ts` | `amountsIn('三十塊 / 50塊')` | `[]`：「塊」是量詞，不再當金額（紅隊 RL-1／R2-15，修正 S-2） |
| `tests/unit/rules.test.ts` | 「steps／log 裡寫錯的第 N 次改成伺服器數字」 | 改成「steps／log 原樣保留」：只修 meme 上下行，否則「不要讓我說第二次」會被改壞（紅隊 RL-2，修正 S-3） |
| `tests/e2e/cmd-layout.spec.ts` | 回報連結 `^mailto:` | 聯絡信箱未填時改走 GitHub issue 連結（紅隊 R2-07，修正 C-6） |
| `tests/unit/discovery-replay.test.ts` | balanced `bayesDrop ≤ 0.15` | 改擋 `oracleGap ≤ 0.08`：原門檻與 `repeat7d < 0.15` 數學上互斥（上帝視角挑最好 20 家降幅已 0.175），bayesDrop 照印作紀錄 |
| `src/discovery.ts` PARAMS | familiar λ=0.05、半衰期 3/7 天、balanced λ=0.8 | 熟門熟路語意即不怕回訪；半衰期由重播校正（見檔內註解） |

### E.4 環境與量測

- `TZ=Asia/Taipei` 跑 typecheck／test 不可省（`diary.test.ts` 綁時區）；新 `tz.test.ts` 自己在測試內固定時區。
- WebKit 裝不起來的環境只能標「Chromium 回歸」，不得標 STOP PASS。
- `shots/*.png` 七張已過期，本輪不重拍（不是 STOP）。
- `x-places-calls` 區分「沒呼叫」與「呼叫失敗」；兩條降級路徑畫面一樣（DEV-PLAN-2 附錄 A-3）。
- `Number(null) === 0`：讀 localStorage 的 `novelty`／`budget` 要像 `loadLevel()` 一樣先判 `null`。
- Places 每日上限 40 次（`places.ts:27`）現在等於約 20 道口令；本輪不改上限，寫進風險。
- Vercel log 保留很短：匿名 `[pick]` log 第一週要人工匯出一次（R11）。

---

## F. 合併順序與整合步驟

```
0  Team Lead：§B 契約 + §B.4（typesafe.ts 修 TS2769、未追蹤檔進版控、scripts）
   → S1–S4 全綠才派工（這是「契約 commit」，四條分支都從這裡開）
1  並行派工：W4、W1、W3、W2（W1 與 W2 最長；W4 最短，先交）
2  合併 W4（純函式，零衝突）→ 跑 S1–S3
3  合併 W1（rebase 到 2）→ 跑 S1–S4、S6、B1–B8、B20、B21
   → Team Lead／Cross 有金鑰就跑 `npm run probe:lanes`，翻 verified 旗標，再跑一次 S2
4  合併 W3（rebase 到 3）→ 跑 S1–S3、B19、palette-guard
5  合併 W2（rebase 到 4）→ 依 W3-HANDOFF 確認 Consent／Privacy／report 已掛載 → 跑 S1–S5、B13–B18
6  整合驗收（INT）：六道閘門一次全跑；`DECIDE-DEV-DOC-v1.md` 第 7 節規則 6 同步；README「指令」段加 replay／probe:lanes；交付訊息列出 A.2 每一條的證據
7  CHK：獨立 checker 逐條 PASS/FAIL；任何 FAIL 回到對應工作流，不准在整合分支順手修演算法
8  正式站：部署後人工跑「同座標 10 次」「20 次 p95」「probe-lanes」三項，結果寫進交付訊息；第一週讀 [pick] log 的 known_price 比例決定要不要做價位推估（R3§4.3）
```

**衝突熱點與處理**：`src/cards.ts`（Team Lead 改資料、W1 改 promptHint，兩段不相鄰，rebase 應自動合）；`tests/e2e/fixtures.ts`（只有 W2）；`src/prompt.ts` 的 `PlaceCandidate` 搬動在步驟 0 完成，W1 不會再碰那段。

**本輪刻意不做**（STRATEGY §4 全部沿用）：帳號／雲端、Capacitor 實際打包、通知、連勝／升階、IAP、訂位串接、日文介面、「去」「飛」接 Places、LLM 選店、快取 Google 內容、外部遙測 SDK、評分請求；另加 **B3 專業模式（文書兵）**——它要動 `prompt.ts`／`officers.ts`，與 W1 重疊且涉及角色圖素材確認，排下一輪。

**需要 Cross 決定（不擋開工）**：① 日記 `big` 欄位（＝店名）與 `debug.ts` 候選名單的 Google 條款處置（R10）；② 隱私頁與檢舉信的聯絡 email；③ 「前百名」是否指美食佳飲分類榜（H5）；④ 日本店名用 `zh-TW` 或 `ja`（H6，probe 時順便各打一次看 displayName）。

---

### 附錄 1　離線重播的合成候選池（`tests/unit/discovery-replay.test.ts`）

不用任何 Google 真實資料（R4）。用 `mulberry32(seed)` 生成 40 家：
- `rating`：常態 μ4.1 σ0.35，夾在 3.0–4.9，取一位小數；`ratingCount`：對數常態中位數 120（範圍 3–3000）。
- `walkMin`：均勻 1–15。
- 細類：10 群依 `[tw 0.25, noodle 0.15, jp 0.12, cn 0.1, ramen 0.08, western 0.08, kr 0.06, hotpot 0.06, cafe 0.05, fast 0.05]`。
- 連鎖：30% 掛字典品牌鍵（同品牌 2–3 家，名稱「品牌 X店」）。
- 價位：55% 有資料（band 1:30%、2:45%、3:20%、4:5%，以 TWD `priceRange` 表示），45% 無資料。
- 全部 `openNow:true`（營業狀態不是本測試的對象）。

模擬：14 天 × 2 餐（12:00、19:00），每餐 `pickPlace` → `markShown`；85% `markDone`、10% closed、5% never_again（第 3 天後）。三方針 × 200 種子。報表 JSON 欄位與門檻見 A.3；`bayesDrop` 的基準是「池子貝氏前 8 名的平均」。

### 附錄 2　prompt 新段落（W1 的起點，可微調措辭不可改語意）

```
【店已決定】place.name={name}　步行 {walkMin} 分　{營業到 HH:MM | HH:MM 開}　價位：{priceText | 價位未知}
mode={new|revisit|wildcard}　這是使用者第 {visits} 次被派到這家。
你只負責寫口令：meme.big 就是這家店名（≤10 字，太長用店家慣稱）。
mode=new 要在 meme.top 或 meme.bot 講這家他沒去過；revisit 要講「第 {visits} 次」；wildcard 要講這是偵察任務。
禁止提到任何別家店或類別；禁止寫出「價位」以外的金額；禁止寫連結。
```

> Round 3 修正 S-9（Team Lead 授權）：範本拿掉 `place.id={id}`——模型用不到店家代碼，`place.id` 只由 `withPlace` 填。
