# R1　「幫你決定吃什麼／去哪」與餐廳發掘類 App 競品分析

> 調查日：2026-10-22。範圍：台灣、日本、美國 App Store 的同類產品。
> **方法與限制（先講清楚）**：`web_search` 工具無法使用（缺 API key），`bash` 對外連線也被擋。所以事實來源只有三類：① Apple 公開的 iTunes Search/Lookup API 與分類榜 RSS（評分、評分數、App Store 文案、榜單名次）；② 各家官方說明頁；③ Google Places API (New) 的官方 discovery 文件。評論只抽樣「最近約 40–50 則」的 Beli、食べログ(JP)、愛食記。凡是沒查到的，一律寫「查不到」，不補猜測。榜單名次是**美食佳飲分類榜**，不是總榜；TW 榜只解析到前 41 名、JP 榜只解析到前 30 名（輸出被截斷）。

## 0. 先給結論

1. **「推薦重複」幾乎沒有人在 App Store 公開罵**。在 Beli、食べログ、愛食記三份抽樣（約 130 則）裡，0 則直接抱怨「老是同一家」。原因是這些都是「搜尋／清單」產品，結果由使用者的查詢決定。「一次只給一個答案」的決策型產品（老闆在用的決斷連）才有這個問題，而競品幾乎沒人解決，這是機會，不是已有答案。相關的間接證據有兩條：食べログ 3 星評論嫌「依排名降冪，上位全是拉麵，想要排除搜尋」；愛食記 3 星評論嫌「評分都在 4 分以上，變得毫無意義」。兩條都指向同一件事：**依評分排序會讓結果同質化**，和老闆的根因一致。
2. **分類榜前段是品牌會員／外送／訂位 App，不是「發掘」App**。要進前百，靠的是硬效用（訂位、點餐、集點、優惠券），純決策工具要附掛這類出口。
3. 決策型小工具（轉盤）評分很高（4.7+、1 萬+ 則），而且都靠小額訂閱變現。「輕」不是弱點。

## 1. 榜單與評分總表（2026-10-22 抓取）

| 產品 | 商店 | 評分（評分數） | 美食佳飲分類榜 |
|---|---|---|---|
| [食べログ](https://apps.apple.com/jp/app/id763377066) | JP | 4.53（691,325） | JP #11 |
| [Tabelog 訪日版](https://apps.apple.com/tw/app/id6752922875) | TW | 查不到 | **TW #3** |
| [ホットペッパーグルメ](https://apps.apple.com/jp/app/id290033990) | JP | 查不到 | **JP #1** |
| [Retty](https://apps.apple.com/jp/app/id473919569) | JP | 4.38（33,804） | 未進 JP 前 30 |
| [Google 地圖](https://apps.apple.com/tw/app/id585027354) | TW | 4.73（696,147） | 導航類，不在此榜 |
| [愛食記](https://apps.apple.com/tw/app/id757992884) | TW | 4.79（40,704） | 未進 TW 前 41 |
| [去哪吃](https://apps.apple.com/tw/app/id6753272951)（2026-03 上架） | TW | 查不到 | TW #6 |
| [OpenRice](https://apps.apple.com/tw/app/id310663323) | TW | 3.52（65） | 未進 TW 前 41 |
| [OpenTable](https://apps.apple.com/us/app/id296581815) | US（TW 榜 #40） | 4.92（5,663,101） | TW #40 |
| [Beli](https://apps.apple.com/us/app/id1478375386) | US | 4.84（17,527） | 查不到 |
| [Yelp](https://apps.apple.com/us/app/id284910350) | US | 4.54（2,090,201） | 查不到 |
| [The Infatuation](https://apps.apple.com/us/app/id465685575) | US | 4.84（14,560） | 查不到 |
| [Michelin Guide](https://apps.apple.com/us/app/id1541129177) | US | 4.87（7,538） | 查不到 |
| [Swarm](https://apps.apple.com/us/app/id870161082) | US | 4.19（7,986） | 查不到 |
| [轉盤+](https://apps.apple.com/tw/app/id1573133915) | TW | 4.77（14,241） | 遊戲類 |
| [小決定](https://apps.apple.com/tw/app/id1338769645) | TW | 4.72（13,340） | 娛樂類 |
| [Decision Buddy](https://apps.apple.com/tw/app/id6670761036) | TW | 4.68（186） | — |
| [緣食](https://apps.apple.com/tw/app/id6756696609) | TW | 5.0（1） | — |

榜單原始資料：[TW 美食佳飲榜](https://itunes.apple.com/tw/rss/topfreeapplications/limit=100/genre=6023/json)、[JP 美食佳飲榜](https://itunes.apple.com/jp/rss/topfreeapplications/limit=30/genre=6023/json)。TW 榜前 41 名裡，絕大多數是拉亞、麥當勞、必勝客／肯德基、王品、foodpanda、Uber Eats、星巴克等品牌會員或外送 App。JP 榜前 30 同樣如此（麥當勞、コメダ、スターバックス、すき家、スシロー等）。Tabelog 在 TW 排第 3，是因為它專為赴日旅客做了訪日版（多語菜單、線上訂位）。

## 2. 逐產品分析

### 2.1 日本

**食べログ**（[App Store](https://apps.apple.com/jp/app/id763377066)、[點數說明](https://tabelog.com/help/score/)）
- 核心：89 萬家店、9,047 萬則口碑；評分＋口碑＋訂位＋地圖。
- 「發掘感」：官方明說「概ね 3.50 未満（全体の約 97%）」是「評價還沒累積夠的店，包含新開幕與隱藏名店」。點數是「影響度加權」而非單純平均，每月第 1、第 3 個週二更新，沒有新評價也會浮動。
- 價位：官方文案只提到「個室」「飲み放題」等條件；予算篩選在我取得的頁面裡**查不到**（同為日本競品的 ホットペッパー 文案明確列出「予算」）。
- 留存：口碑寫完自動變成「グルメ記録」（相簿、日曆、**日本地圖上去過的區域會逐漸上色**）；プレミアム月額 ¥400，排名搜尋要付費。
- 抱怨（[抽樣最近 40 則](https://itunes.apple.com/jp/rss/customerreviews/page=1/id=763377066/sortby=mostrecent/json)）：ステマ與評分操作、付費誘導煩人、App 比網頁版難用、要求「除外検索」（上位全是拉麵）。**無「推薦重複」抱怨**。

**Retty**（[App Store](https://apps.apple.com/jp/app/id473919569)）：實名口碑、「TOP USER」、「穴場を発掘」、マイリスト（行きたい）。以信任與人為核心，評分 4.38 低於食べログ。價位與留存細節：查不到。

**ホットペッパーグルメ**（JP #1，[App Store](https://apps.apple.com/jp/app/id290033990)）：靠「即訂＋クーポン＋Ponta/d 點數」。新功能「席押さえ」可看附近現在就能入座的店並當場占位。檢索條件含「予算」。價值在硬效用，不在評分。

**品牌 App 的留存設計**：[焼肉きんぐ](https://apps.apple.com/jp/app/id1345275897) 的「焼肉ポリス手帳」依來店次數從「巡査」升到「警視総監」共 10 階，每階有專屬優惠與排名；[コメダ](https://apps.apple.com/jp/app/id1667214457) 有「くつログ農園日記」（用越多、劇情越多）。軍警階級＋次數升階在日本已有成功先例，跟班長人設天然相容。

### 2.2 台灣

**愛食記**（[App Store](https://apps.apple.com/tw/app/id757992884)）：只收部落客精選餐廳，每日更新食記，每週／每月熱門榜。會員 NT$80／2 個月或 NT$290／年，付費換「依分類找附近」「只看營業中」。[抽樣評論](https://itunes.apple.com/tw/rss/customerreviews/page=1/id=757992884/sortby=mostrecent/json)：廣告強制、**歇業店未下架（至少 4 則）**、評分都 4 分以上失去鑑別度、收藏清單重複顯示（bug，不是推薦重複）。正面評論反覆出現「不知道吃什麼就開愛食記」「看附近有沒有**最新**美食」，新店就是它的發掘感。

**去哪吃**（TW #6，2026-03 上架，[App Store](https://apps.apple.com/tw/app/id6753272951)）：文案定位「一站式餐飲平台」，主訴「每次猶豫今天要吃什麼」。評分與機制細節：查不到。**這是最直接的台灣對手，值得下一輪實測。**

**OpenRice**（[App Store](https://apps.apple.com/tw/app/id310663323)）：台灣店面評分 3.52、僅 65 則，台灣市場存在感弱；主力是香港。Corner、CATCHTABLE（TW #16）的機制：查不到。

**轉盤類**：[轉盤+](https://apps.apple.com/tw/app/id1573133915) 有權重（「比例」）、「選擇後立即移除」；[小決定](https://apps.apple.com/tw/app/id1338769645) 有權重、不重複抽取、小工具、Apple Watch、iCloud 同步；[緣食](https://apps.apple.com/tw/app/id6756696609) 是「個人餐廳日記＋命運轉盤」，可按分類／評分／距離／營業時間篩選，資料只存手機。轉盤+、小決定、Decision Buddy 都有訂閱方案。轉盤類的「不重複」是**使用者手動勾的選項**，沒有一個把「去過哪」自動記起來。

### 2.3 美國與全球

**Beli**（[App Store](https://apps.apple.com/us/app/id1478375386)、[近期評論](https://itunes.apple.com/us/rss/customerreviews/page=1/id=1478375386/sortby=mostrecent/json)）：核心是「兩兩比較排名」的個人榜單，加朋友動態、Taste Profile、與朋友的 Match Score、個人化推薦。留存來自社交與累積的榜單。最大抱怨**不是推薦品質，而是邀請牆**：抽樣約 40 則，逾半是 1–2 星，罵「要邀 4–5 位朋友才能用」「平均分／搜菜／隱身模式被鎖」「要先排 15 家才看得到推薦」。其他：不同類型店難以放進同一榜單比較。「推薦重複」：無。價位篩選：App Store 文案**查不到**。

**Yelp**（[App Store](https://apps.apple.com/us/app/id284910350)）：「找最新最熱的餐廳」，可依價格、距離、營業中等篩選。評論未抽樣，抱怨：查不到。

**OpenTable**（[App Store](https://apps.apple.com/us/app/id296581815)）：可按菜系、價位、場合篩選，「Notify Me」搶熱門訂位，訂位累積點數，並有 AI 助理 Concierge。

**The Infatuation**（[App Store](https://apps.apple.com/us/app/id465685575)）：編輯策展，以「Perfect For」情境（Girls' Night Out、Late Night Eats）分類。文案引用 NYT：「多數餐廳 App 讓我不知所措，我要有人替我選」，這句就是決斷連的需求宣言。

**Michelin Guide**（[App Store](https://apps.apple.com/us/app/id1541129177)）：最近更新是「優化輪播推薦邏輯」「新增 Date Night／Inspector Favorite 內容」，也是以情境切入。

**Swarm（Foursquare）**（[App Store](https://apps.apple.com/us/app/id870161082)）：打卡、連續天數（streak）、新城市／新地點勳章、個人時間軸；評分 4.19 偏低。Foursquare City Guide 本體與 Corner：查不到。

**Google 地圖**（[App Store](https://apps.apple.com/tw/app/id585027354)）：文案確認可「依料理、營業時間、價格、評分篩選理想餐廳」，並有自訂清單。探索演算法、評論抱怨：查不到。

## 3. 價位篩選：業界怎麼做、API 能做什麼

- **Google 地圖、Yelp、OpenTable、ホットペッパー**：都是使用者勾選「價位／預算」的硬篩選（見上列 App Store 文案）。
- **Google Places API (New) 的關鍵事實**（[官方 discovery 文件](https://places.googleapis.com/$discovery/rest?version=v1)）：
  - **Text Search** 支援 `priceLevels[]`（免費／便宜／中等／昂貴／非常昂貴）、`minRating`（0.5 為單位）、`openNow`、`rankPreference`（距離／相關度）、`pageSize`（最大 20）與 `pageToken`（可翻頁）、`includeFutureOpeningBusinesses`。
  - **Nearby Search** 請求欄位裡**沒有** `priceLevels`、`minRating`、`pageToken`；只有 `includedTypes/excludedTypes`、`maxResultCount`（最大 20）、`rankPreference`（距離／人氣）。
  - 回應可帶 `priceRange`（`startPrice` 含、`endPrice` 不含，貨幣用 Money 型別）。Place 欄位的掛載位置與 SKU 費用：此次輸出被截斷，**實作前請對照官方文件**。
  - 目前 repo 的 [places.ts](../../src/places.ts) 同時用兩種搜尋，所以「價位」只能走 Text Search，或對 Nearby 結果在後端二次過濾。
- 日本店家的價位資料完整度：**查不到**，需實測。

## 4. 前百名級產品的共通成功要素（11 條；標「推論」者是我的歸納）

1. **每次打開都有硬效用**：訂位、點餐、集點、優惠券（榜單前段全是這類）。
2. **資料規模與新鮮度**：食べログ 89 萬店；愛食記「歇業未下架」是反覆差評。
3. **信任機制**：食べログ影響度加權＋反ステマ、Retty 實名、Infatuation 編輯署名；信任崩壞就是 1 星（ステマ、評分全 4 分以上）。
4. **使用者自己的記錄成為資產**：Beli 榜單、Swarm 時間軸、食べログ グルメ記録。
5. **階級／收集／連續天數**：きんぐ 十階、Swarm streak 與勳章、コメダ 農園日記。
6. **情境入口，而非參數入口**：Infatuation「Perfect For」、Michelin Date Night；對應決斷連的情境鍵。
7. **基本篩選齊全**：價位、營業中、距離、評分是標配。
8. **核心價值不上鎖**：Beli 的邀請牆是最大差評來源；食べログ的付費誘導也被罵。
9. **廣告克制**：愛食記 1 星多數是強制全螢幕廣告（推論：廣告要在決策完成之後出現）。
10. **小額訂閱、免費版夠用**：食べログ ¥400／月、愛食記 NT$80／2 個月、轉盤類月／年／買斷。
11. **本地化與旅行情境**（推論）：Tabelog 訪日版在台灣榜排第 3，雙地區產品的機會在「跨境」。

## 5. 決斷連可以直接偷的 5 個機制

1. **「出戰帳本」去重（解決抱怨 1 的根因）**
   - 偷自：食べログ グルメ記録、Swarm 時間軸、轉盤的「選後移除」（但改成自動）。
   - 做法：IndexedDB 記錄 `placeId + 日期 + 結果（完成／店關了／沒做）`；請求 `/api/order` 時帶 `excludeIds`。建議預設：完成後 30 天內不再出現，「沒做」7 天，「店關了」永久。
   - 依據：目前流程已有「完成／店關了／沒做」三種回報，不用新增互動。

2. **候選池改「分層抽樣＋伺服器選店」，不再取前 8**
   - 偷自：食べログ「97% 是新店與隱藏名店」、小決定的權重、Places 翻頁與 `includeFutureOpeningBusinesses`。
   - 做法：Text Search 翻到 40–60 家，`minRating` 約 3.8 並設最低評價數；分成「沒去過」「去過」「新開幕／評價少但高分」三層，由後端按權重抽出 1 家（建議約 70% 沒去過），**LLM 只負責寫口令**。現在 `src/prompt.ts` 第 6 條「優先挑評價數多且分數高」要刪掉，否則模型仍會偏好最高分。

3. **價位二層：硬篩＋軟降權**
   - 偷自：Google／Yelp／OpenTable 的價位篩選。
   - 做法：UI 給 3 檔（依台幣／日圓換算區間）→ `priceLevels` 先篩 → 回應的 `priceRange` 二次驗證；缺價位資料的店降權並標示「價位未知」，不要直接剔除（日本資料完整度查不到，需實測）。

4. **軍階進度條（雙軸）**
   - 偷自：焼肉きんぐ（來店次數升階，巡査→警視総監）、食べログ 地圖上色、Swarm 勳章。
   - 做法：升階看「完成命令數」，另加「首次踏足的新店數」；地圖或週報顯示「本週新店 X 家／回頭店 Y 家」。把「發掘」變成可見的進度，直接回應老闆的「發掘的樂趣」。現有的新兵日記與莒光園地週報可以直接承載。

5. **排除與「換一家」有成本**
   - 偷自：食べログ使用者要求的「除外検索」、Beli 使用者想要的「相似店」、Infatuation「替我選」。
   - 做法：加「今天不想吃 X」的一次性排除（Nearby 有 `excludedTypes` 可用）；「換一家」每日免費 1 次，之後以「罰則」換取，並把被換掉的店記入 7 天黑名單。既保住「不可拒絕」的人設，又給一個可控的逃生口。

## 6. 風險與下一步

- 「前百名」要先釐清是**分類榜**還是**總榜**。分類榜前段被品牌 App 占滿；總榜名次我**查不到**。
- 下一輪建議：① 直接實測「去哪吃」與 Corner、CATCHTABLE；② 抓更多頁的評論（Retty、Yelp、Google 地圖、去哪吃），專門找「同一家」「重複」「老是」類關鍵字；③ 驗證 Places 的 `priceLevel`／`priceRange` 在台灣與日本店家的覆蓋率與 SKU 費用。
