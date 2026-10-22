# R3｜推薦「新鮮度／發掘」演算法 × 價位資料源

調查日：2026-10-22。範圍：產品「報告班長・決斷連」的 `eat` 卡（Places 查店）。
查證方式說明：`web_search` 工具當日無法使用，改以 `web_fetch` 直取一手來源（Google 官方文件、Google Places discovery doc、arXiv、NeurIPS、Forbes JAPAN 等）；Tabelog 被擋（CAPTCHA）、ACM 回 403、MMR 原文為 PDF 無法抓取，這幾項標「未驗證」。**沒有跑模擬**（執行環境的審核工具當時反覆失敗），所有參數是「起始值」，需用離線重播與 A/B 校正。

---

## 0. 結論

1. 「每次同一家」的根因有三層：(a) 本地排序固定取前 8、prompt 要模型挑最高評價；(b) `eat` 走 Nearby Search，**未指定 `rankPreference` 時 Google 預設依 POPULARITY 排序**，單次最多 20 筆（[Nearby 文件](https://developers.google.com/maps/documentation/places/web-service/nearby-search?hl=en)），候選池本身幾乎不變；(c) 沒有任何「推薦過／去過」記憶。三層要同時修。
2. 建議架構：**店由程式決定，Claude 只寫口令**。用「Thompson 式品質抽樣 + 近期曝光指數衰減 + 連鎖降權 + 加權隨機」從 8–40 家挑 1 家；候選池用「輪替細類 lane」擴大。
3. 價位：`priceLevel`、`priceRange` 都在 **Enterprise SKU**，與你現有 fieldMask（rating、openingHours 已是 Enterprise）同級，加欄位不增加 SKU 等級。Text Search 有 `priceLevels` 篩選；**Nearby Search 沒有價位篩選**。台灣／日本覆蓋率**查不到官方數字**，要上線後自己量。
4. 快取：`place_id` 可永久存；Places 專屬條款只明文允許快取經緯度（最長 30 天）；店名、評分、價位等其他內容是「除明文允許外不得快取」，且明列禁止「複製並儲存商家名稱」。→ IndexedDB 只存 `place_id` + 自己的互動事件。現有 `diary.ts` 存 `placeName` 有合規風險，需法務確認。

---

## 1. (a) 新鮮度／發掘：業界做法與適配

### 1.1 名詞
- Serendipity =「意外且相關」：驗證研究定義為 surprising and relevant（[arXiv 1906.11431](https://arxiv.org/abs/1906.11431)）；訪談研究把使用者感受到的 serendipity 概念化為 fortuitous、refreshing、enriching 三者缺一不可（[arXiv 2505.15440](https://arxiv.org/abs/2505.15440)）。→ 不是亂丟店，而是「沒去過但品質有保證」；班長講「這家你沒去過」本身就是 refreshing 的一部分。
- Novelty = 沒看過／沒吃過；Diversity = 同一批結果彼此不同。你每次只出 1 家，diversity 只在「連按換口令」與備選清單才有意義，核心是 novelty 與曝光輪替。

### 1.2 方法比較（單人、無帳號、本機資料、候選 8–40）
| 方法 | 做法與來源 | 適不適合 |
|---|---|---|
| Thompson sampling | 對不確定的價值抽樣後取最大，自然兼顧探索與利用；實測有競爭力、易實作（[Chapelle & Li, NeurIPS 2011](https://papers.nips.cc/paper/2011/hash/e53a0a2978c28872a4505bdb51db06dc-Abstract.html)；教學：[Russo 等, arXiv 1707.02038](https://arxiv.org/abs/1707.02038)） | 適合，但用在「細類」與「評分不確定度」，不要用在單店（樣本太少） |
| 加權隨機（不放回） | Efraimidis–Spirakis：每項 key = u^(1/w) 取最大／前 k（綜述：[arXiv 1012.0256](https://arxiv.org/abs/1012.0256)） | 適合，一行程式、可解釋、可單測 |
| 近期曝光衰減 | 工程慣例，半衰期為自選參數。**餐廳場景公開參數查不到**（Spotify 研究頁抓取 404、Netflix 無一手數據） | 適合，參數見 §2 |
| 重複消費 | 文獻指出重複消費在電商、音樂、電視推薦很常見（[RepeatNet, arXiv 1812.02646](https://arxiv.org/abs/1812.02646)），非餐廳專屬 | 吃飯本來會回訪，不要禁止，只降權 |
| MMR／DPP 多樣化 | DPP 貪婪 MAP 加速版，線上 A/B 驗證過相關性與多樣性取捨（[Chen 等, arXiv 1709.05135](https://arxiv.org/abs/1709.05135)）；MMR 原文未驗證 | 單一推薦用不到；備選清單／連按換口令時簡化成「已拒絕細類 ×0.5」即可 |
| ε-greedy | 固定機率亂選 | 太粗，改用「wildcard 模式」 |
| 去過／不喜歡 | 顯式回饋 | 必做，見 §2.3 |
| 連鎖降權 | `Place` 欄位中我**未見 chain／brand 欄位**；`websiteUri` 說明只提到連鎖店通常回各分店網址（[discovery doc](https://places.googleapis.com/$discovery/rest?version=v1)；僅檢視到部分 Place 欄位，結論限於所見範圍） | 自建品牌字典 + 名稱前綴聚類 |

### 1.3 候選池要先擴（池子只有同樣 8 家，演算法救不了）
- Nearby：`maxResultCount` ≤ 20、**無 pageToken**、`rankPreference` 只有 DISTANCE／POPULARITY（預設）。可輪替 `includedTypes` 與 `rankPreference`，每種組合撈到不同的 20 家。
- Text Search：`pageSize` 1–20 + `pageToken` 分頁（續頁時除 token／size 外參數必須相同，否則 INVALID_ARGUMENT）；文件明說「相同請求回傳的清單不保證一致」（[Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search?hl=en)、[discovery doc](https://places.googleapis.com/$discovery/rest?version=v1)）。**分頁總筆數上限文件未載明，查不到。**
- 餐廳細類（Table A，[Place Types](https://developers.google.com/maps/documentation/places/web-service/place-types?hl=en)）：`ramen_restaurant`、`sushi_restaurant`、`japanese_restaurant`、`korean_restaurant`、`breakfast_restaurant`、`fast_food_restaurant`、`fine_dining_restaurant`、`steak_house`、`seafood_restaurant`、`vegetarian_restaurant`、`vegan_restaurant`、`cafe`、`bakery`、`ice_cream_shop`；另有 `taiwanese_restaurant`、`noodle_shop`、`chinese_noodle_restaurant`、`hot_pot_restaurant`、`japanese_izakaya_restaurant`、`yakiniku_restaurant`、`yakitori_restaurant`、`tonkatsu_restaurant`、`japanese_curry_restaurant`。標 `*` 者是 2024-11-07（新增 104 型）與 2026-02-12（新增 180 型）才加入（[Release notes](https://developers.google.com/maps/documentation/places/web-service/release-notes?hl=en)）。你現有程式註解選擇「只用長期存在的類型避免 400」；**新型別我沒做實際呼叫驗證**，上線前每個 lane 都要實測。
- Nearby 的 `includedTypes` 比對「types 清單」，`includedPrimaryTypes` 比對主類型；指定 `restaurant` 時也可能回更細的子類店。Text Search 的 `includedType` 只能一個，預設只是偏好，要 `strictTypeFiltering: true` 才嚴格。

---

## 2. 演算法規格（可直接實作）

### 2.1 資料（IndexedDB，沿用 diary.ts 的 idb-keyval 風格）
```ts
// 只存 place_id 與自己的事件，不存名稱／評分／座標（見 §3.4）
interface PlaceMem { id: string; shown: number[]  /*最近10次ts*/; done: number[];
  dislikeUntil?: number | 'forever' }
interface CuisineStat { key: string; a: number; b: number }   // Beta(a,b)，初值 (1,1)
// key = primaryType 歸群（ramen/noodle/jp/tw/cafe…，自建對照表）
```
請求時送最近 200 筆摘要 `{id,l:lastShown,s:count,d:lastDone,x:dislikeUntil}`（約 6 KB）給 `api/order.ts`，伺服器維持無狀態。

### 2.2 偽碼
```ts
const P = { floor:3.7, minCount:5, sigma:1.0, half:10, halfDone:21, lam:1.2,
            chain:0.6, T:0.35, wildcard:0.20, walkD:25, adj:0.35, unknownPrice:0.5 }

function pickPlace(c: Cand[], mem, cuisine, ctx): { place: Cand; mode: string } {
  // 1 硬過濾（任一步剩 <5 家就放寬該步並記 log）
  c = c.filter(p => bayes(p) >= P.floor && (p.n ?? 0) >= P.minCount)
  c = c.filter(p => !isDisliked(mem[p.id], now))        // snooze 90 天；'forever' 永久
  c = c.filter(p => !ctx.sessionShown.has(p.id))        // 本次連按換口令
  c = c.filter(p => !last3Shown(ctx.module).has(p.id))  // 冷卻 3 次
  c = priceFilter(c, ctx.bands)                         // §4，僅 strict 時硬濾

  const wildcard = rand() < P.wildcard
  if (wildcard) { const f = c.filter(p => exposure(mem[p.id]) === 0); if (f.length >= 3) c = f }

  // 2 打分（log 域）
  const w = c.map(p => {
    const theta = bayes(p) + gauss() * P.sigma / Math.sqrt((p.n ?? 0) + 4) // Thompson：評論少→變異大
    const q  = clamp((theta - 3.5) / 1.5, 0, 1)
    const pc = 0.4 + 0.6 * betaSample(cuisine[grp(p)])                     // 細類偏好 Thompson
    const E  = exposure(mem[p.id])
    const s  = Math.log(0.15 + q) + Math.log(pc) - P.lam * E
             + (isChain(p, ctx) ? Math.log(P.chain) : 0)
             - walkMin(p) / P.walkD
             + Math.log(priceFit(p, ctx.bands))
             + (ctx.rejectedCuisines.has(grp(p)) ? Math.log(0.5) : 0)
    return Math.exp(s / P.T)
  })

  // 3 加權隨機：Efraimidis–Spirakis key = u^(1/w)，取最大
  const pick = argmax(c, (_, i) => Math.pow(rand(), 1 / w[i]))
  const mode = exposure(mem[pick.id]) === 0 ? (wildcard ? 'wildcard' : 'new') : 'revisit'
  return { place: pick, mode }   // mode 交給 prompt：「這家你沒去過」
}

// exposure = Σ exp(-ln2·Δt/半衰期)；shown 用 half=10 天，done 用 halfDone=21 天
```
連鎖判定 `isChain`：先查自建品牌字典（麥當勞、星巴克、すき家、松屋、吉野家…，是我方資料而非 Google 內容），字典外用「同一次候選內，名稱去分店字尾後前綴相同 ≥2 家」聚類；同品牌曝光合併計算。

### 2.3 回饋事件
| 事件 | 更新 |
|---|---|
| 產生口令 | `shown.push(now)` |
| 完成（done） | `done.push(now)`；該細類 `a += 1` |
| 換口令（原因：店關了） | 該店 `dislikeUntil = now+24h`；**不動**細類（不是不喜歡） |
| 換口令（原因：不想吃） | 細類 `b += 0.5`；session 內該細類 ×0.5 |
| 「不想再看到」 | `dislikeUntil = now+90d`；同店第二次 → `'forever'` |

### 2.4 起始參數與驗收（未模擬，待驗證）
- 溫度 T 0.25–0.5（越小越像固定取高分）；λ 0.8–2.0（越大越不回訪）。起始 T=0.35、λ=1.2；半衰期 10 天（曝光）／21 天（去過）；wildcard 20%。
- 離線重播驗收：14 天內不重複店數 ≥ 9／12 餐；7 天內重複率 < 15%；評分前 3 名店佔比 < 50%；連鎖佔比 ≤ 候選池佔比 ×0.7；平均 bayes 評分較現況下降 ≤ 0.15。
- `minCount=5` 是防踩雷底線：評論少的店 Thompson 較常被抽中。

### 2.5 prompt 與 API 改動
- 候選改為「已決定 1 家」：prompt 刪「優先挑評價最高」，改「店已決定，mode=new|revisit|wildcard，只負責寫口令」。`matchPlace` 驗證可保留。
- 每次 ≤ 2 次 Places 呼叫：lane 由 `cuisine` 的 Beta 抽樣選細類（25% 機率改選均勻隨機 lane），`maxResultCount: 20`。

---

## 3. (b) Google Places API (New) 逐條查證

### 3.1 價位欄位
| 項目 | 結果 | 來源 |
|---|---|---|
| `priceLevel` enum | `PRICE_LEVEL_UNSPECIFIED / FREE / INEXPENSIVE / MODERATE / EXPENSIVE / VERY_EXPENSIVE` | [discovery doc](https://places.googleapis.com/$discovery/rest?version=v1) |
| `priceRange` | `{startPrice, endPrice}`（Money，含 `currencyCode`）；`startPrice` 含、`endPrice` **不含**；`endPrice` 可不設＝無上限。2024-11-07 新增 | discovery doc；[Release notes](https://developers.google.com/maps/documentation/places/web-service/release-notes?hl=en) |
| SKU | 兩者在 Place Details／Text Search／Nearby Search 皆為 **Enterprise** | [Data Fields](https://developers.google.com/maps/documentation/places/web-service/data-fields?hl=en)（頁面更新 2026-10-21）；[Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search?hl=en)；[Nearby](https://developers.google.com/maps/documentation/places/web-service/nearby-search?hl=en) |
| 各 `priceLevel` 對應金額 | 文件只有 inexpensive／moderate 等文字，**查不到金額定義** | discovery doc |
| TW／JP 覆蓋率 | **查不到**官方或可信第三方數字；文件也未說明無價位店在 `priceLevels` 篩選時是否被排除 | — |

### 3.2 搜尋參數
- **Text Search**：有 `priceLevels`（陣列，可多選，預設全選；適用 Food and Drink／Services／Shopping，不支援類型的店在指定時不會出現）；另有 `minRating`（0.5 階，向上取整）、`openNow`、`rankPreference`（DISTANCE／RELEVANCE）、`includedType`＋`strictTypeFiltering`、`pageSize`（1–20，預設 20）、`pageToken`。`maxResultCount` 已於 2024-05-13 棄用。
- **Nearby Search**：欄位為 `includedTypes/excludedTypes/includedPrimaryTypes/excludedPrimaryTypes`（各最多 50）、`maxResultCount`（1–20）、`rankPreference`、`languageCode`、`regionCode`、`locationRestriction`（圓，半徑 0–50,000 m）。**沒有 `priceLevels`、沒有 `minRating`、沒有分頁。**（來源同上）

### 3.3 快取與條款
| 內容 | 規定 | 來源 |
|---|---|---|
| `place_id` | 不受快取限制，**可無限期儲存**；建議超過 12 個月刷新，用 Place Details 只請求 `id`，文件稱免費；店關門／搬遷會 `NOT_FOUND` | [Place IDs](https://developers.google.com/maps/documentation/places/web-service/place-id?hl=en)、[Policies](https://developers.google.com/maps/documentation/places/web-service/policies?hl=en) |
| 經緯度 | 可暫存，**最長連續 30 天**後刪除 | [Service Specific Terms §14.3](https://cloud.google.com/maps-platform/terms/maps-service-terms) |
| 店名／評分／價位／營業時間 | Places 專屬條款**沒有明文允許**；ToS §3.2.3(b)：除專屬條款明文允許外不得快取；§3.2.3(a)(iii) 列舉禁止「copy and save business names, addresses, or user reviews」 | [ToS（非 EEA）](https://cloud.google.com/maps-platform/terms) |
| 其他 | §3.2.3(c)(vii) 禁止用 Google Maps Content 訓練／測試／微調模型；§3.2.3(d)(iii) 禁止用於 listings／directory service；Places 內容不得配非 Google 地圖。**EEA 帳單地址適用另一份條款**，本報告只讀非 EEA 版 | 同上；[EEA 條款](https://cloud.google.com/terms/maps-platform/eea) |
| 顯示 | 不在 Google Map 上顯示 Places 資料時，須附 Google Maps logo 或文字「Google Maps」（12–16sp、不得翻譯，`translate="no"`） | [Policies](https://developers.google.com/maps/documentation/places/web-service/policies?hl=en) |

### 3.4 對本產品的合規建議（法律判斷請法務或 Google 確認）
1. 記憶只存 `place_id`＋時間戳＋細類統計（細類 key 為自建歸群）。
2. `diary.ts` 現在存 `placeName` 與 `big`（店名），與 §3.2.3(a)(iii) 有衝突風險。保守方案：日記只存 `place_id`，顯示時用 Place Details 重取 `displayName`（Pro SKU，有費用）；或向 Google 確認「使用者自己裝置上的個人歷史」是否可行。**我無法替你下結論。**
3. `rating` 等原值不落地；Thompson 只用當次請求回來的值。
4. App Store 版需補 Google Maps 歸屬標示與 ToS 文字（§3.2.2(a)）。

---

## 4. (c) 價位帶與輸入 UX

### 4.1 證據
- 台灣：yes123 調查，上班族每月外食均花 NT$8,081，約每餐 NT$90（含所有餐別，會偏低）（[TVBS 2025-10-27](https://news.tvbs.com.tw/life/3027597)；[yes123](https://www.yes123.com.tw/admin/white_paper/index_detail.asp?id=20251009095931)）。「午餐 120–150」僅見部落格（[uptogo](https://uptogo.com.tw/%E7%BE%8E%E9%A3%9F/%E5%8F%B0%E4%B8%AD%E4%B8%80%E9%A4%90%E5%A4%9A%E5%B0%91%E9%8C%A2%EF%BC%9F/)），可信度低。
- 日本：SBI 新生銀行調查男性會社員平均昼食代 ¥709，為 2010 年以來最高（[Forbes JAPAN 2026-03-25](https://forbesjapan.com/articles/detail/94108)）；Recruit 調查：2024 年平日昼食均額 ¥452、外食店內 ¥1,243；2025 年均額 ¥485（[福利厚生研究所整理](https://www.shinko-jp.com/column/kaisyainranti/)，二手轉述）。日本站台以**午餐／晚餐分開標預算**：Tabelog 有 lunch 專屬「1,000円以下」篩選頁（CAPTCHA 擋住，未能讀完整檔位）；Hot Pepper API 的 budget 只有「ディナー予算」（[API 文件](https://webservice.recruit.co.jp/doc/hotpepper/reference.html)）。
- **晚餐價位帶（居酒屋、燒肉）找不到權威統計 → 下表第 3、4 檔為推論，需用自家資料校正。**

### 4.2 建議切點（每人／餐）
| 檔 | 台灣 NT$ | 日本 ¥ | 典型 |
|---|---|---|---|
| 1 銅板 | ≤ 150 | ≤ 1,000 | 便當、小吃、牛丼 |
| 2 一般 | 150–400 | 1,000–2,500 | 定食、麵飯、拉麵＋配菜 |
| 3 犒賞 | 400–1,000 | 2,500–6,000 | 聚餐、居酒屋、燒肉 |
| 4 豪賞 | ≥ 1,000 | ≥ 6,000 | 鐵板、懷石、高級壽司 |

午餐時段可隱藏第 4 檔。Google 的 `priceRange` 是否區分午晚餐，文件未說明。

### 4.3 Google 資料 → 檔位（偽碼）
```ts
const CUT = { TW: [150, 400, 1000], JP: [1000, 2500, 6000] }
function bandOf(p, country): number | null {   // 回傳 1–4，可為 x.5 表跨兩檔
  if (p.priceRange) {
    const lo = p.priceRange.startPrice, hi = p.priceRange.endPrice
    const mid = hi ? (lo + hi) / 2 : lo * 1.3           // 無上限：保守 1.3 倍（我方假設）
    return bandByCut(mid, CUT[country])
  }
  switch (p.priceLevel) {                               // 粗映射（我方假設，非官方）
    case 'PRICE_LEVEL_INEXPENSIVE': return 1.5
    case 'PRICE_LEVEL_MODERATE': return 2.5
    case 'PRICE_LEVEL_EXPENSIVE': return 3.5
    case 'PRICE_LEVEL_VERY_EXPENSIVE': return 4
    default: return null                                // FREE／UNSPECIFIED／無資料
  }
}
// priceFit：命中 1.0；相鄰檔 P.adj(0.35)；未知 P.unknownPrice(0.5)；strict 模式相鄰與未知皆 0
```
- `country` 由 `priceRange.currencyCode`（TWD／JPY）或座標判斷，不靠手機語系。
- **不要把 API `priceLevels` 當唯一硬篩**：Nearby 不支援；Text Search 篩選是否排除無價位店文件未說明；也會縮小發掘池。建議 fieldMask 加 `places.priceLevel,places.priceRange` 本地過濾，`priceLevels` 只作「嚴格模式」的額外 Text Search lane。
- **上線第 1 週遙測**：記錄各國候選中 `priceRange`／`priceLevel` 有值比例。若 < 40%，改用細類推估（拉麵、牛丼連鎖偏 1 檔；`fine_dining_restaurant` 偏 4 檔）並在 UI 標「價位推估」。
- 傳給 Claude 只給檔位文字，**禁止模型編造金額**。

### 4.4 UX 規格
- 位置：`eat` 卡 intake 加「預算」列，沿用 `chips`（需擴成可多選）。Material 3 指引：filter chip 可單選或多選但**同頁不混用兩種行為**、標籤 ≤ 20 字、點擊目標 ≥ 48dp、間距 ≥ 8dp、超過兩列改橫向捲動、不要只放單一 chip（[M3 Chips](https://m3.material.io/components/chips/guidelines)）。
- 呈現：用**金額文字**而非 `$$$`（日台無 `$` 共識，Google 也沒給金額定義）。台灣 chips：`不限`（預設）、`≤150`、`150–400`、`400–1,000`、`1,000+`；日本：`〜¥1,000`、`¥1,000〜2,500`…。
- 行為：多選限相鄰（選 1、3 自動補 2）；全不選＝不限；記住上次選擇；午／晚預設檔（午 2、晚 3）可手動改。
- 人設：選到相鄰檔外時口令講「超出預算一檔，我准了」；本區無此價位真店時不硬塞，請使用者確認放寬一檔。
- 「價位輸入最佳 UX」的實證 A/B 數據**沒找到**；以上是依 M3 官方指引與本產品約束（單手、無帳號、單一口令）的設計推論。

---

## 5. 實作順序
1. `FIELD_MASK` 加 `places.priceLevel,places.priceRange`，記錄 TW／JP 覆蓋率。
2. 本地 `PlaceMem` + `exposure` + 加權隨機（先不改候選池）→ 解決「同一家」。
3. lane 輪替擴池；實測所有新細類不回 400。
4. 預算 chips + `bandOf`；prompt 改「店已決定」。
5. 合規：日記 `placeName` 處置、Google Maps 歸屬標示。
6. 離線重播 + A/B 校正 §2.4 參數。

## 附：沒查到／未驗證
- TW／JP 的 `priceLevel`／`priceRange` 覆蓋率；`priceLevel` 對應金額；`pageToken` 總筆數上限；無價位店在 `priceLevels` 篩選下的行為。
- 餐廳場景衰減半衰期的公開參數；MMR 原文；Tabelog 預算檔位原文。
- 晚餐價位統計；價位輸入 UX 的實證研究。
