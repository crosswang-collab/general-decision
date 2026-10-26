# R2｜人格／毒舌角色工具 App 與上架策略

> 調查日：2026-10-22。範圍：CARROT Weather、Duolingo、Finch、(Not Boring)、Gentler Streak；Apple 審核規定對 PWA 包殼的要求；台灣／日本 ASO；決斷連上架清單與人設增強。
> **方法限制**：本輪 `web_search` 工具無金鑰不可用，改以 DuckDuckGo HTML 檢索加 `web_fetch` 讀原頁。只看到搜尋摘要、未開原文者標「摘要」；查不到者寫「查不到」。「推論」是我的判斷，不是來源說的。

## 0. 結論

1. **人設是包在真功能外面的皮，不是賣點本身。** Apple 寫 CARROT 時強調：作者知道光靠迷因笑話不夠，它必須同時是一流天氣 App（[Apple](https://developer.apple.com/news/?id=kf623ldf)）。決斷連的「真功能」是查店與決策，目前最弱的正是這塊（老闆抱怨的重複推薦）。
2. **毒舌必須有關閉鈕。** CARROT 有五種人格，最低是「professional」；作者說關掉人格後動畫與功能仍在。
3. **PWA 包殼的最大風險不是 4.2.2，而是 4.2 總則與 4.3(b)。** 台灣商店已有一堆「今天吃什麼轉盤」，Apple 明文把 fortune telling 等列為成熟品類，要「meaningfully different」才收。
4. **「下載榜前百」沒有可信的公開門檻數據（查不到）。** 人設只能提高留存、分享與編輯推薦機率，不能取代上架品質與投放。
5. 台灣與日本不能共用一套文案與人設：Duolingo 日本頁與台灣頁的名稱、副標、語氣各自在地化。

## 1. 五個案例：事實、來源、啟示

| App | 查證到的事實 | 啟示 |
|---|---|---|
| **CARROT Weather** | Apple「Behind the Design」：Brian Mueller 自己寫笑話，靈感來自母親、姊姊、妻子互損；「兩個 App 合一：娛樂＋專業天氣」；2017 上 Apple Watch 是「轉折點」，因放不下長笑話，被迫把天氣本體做好；笑話可在幾分鐘內跟時事（[Apple](https://developer.apple.com/news/?id=kf623ldf)）。App Store 頁自述 Apple Design Award、App of the Year、Editors' Choice，5 種人格（含「profanity-laden」），美國 4.7 分、8.8 萬評分；付費牆賣通知、小工具、Live Activities、CarPlay 等功能，不賣人格（[App Store](https://apps.apple.com/us/app/carrot-weather-alerts-radar/id961390574)） | 人設＋即時哏＋可關閉＋付費賣功能。毒舌能過審，且被 Apple 當設計案例講 |
| **Duolingo** | 官方部落格：7 天連勝者完成課程機率是 3.6 倍；連勝動畫讓新用戶 7 日留存 +1.7%；可裝備兩個 Streak Freeze 使日活 +0.38%，並引用「適度寬鬆比嚴格規則更能激勵」（[Duolingo](https://blog.duolingo.com/how-duolingo-streak-builds-habit/)）。2025 Q4 日活 52.7M、+30%（[摘要](https://www.stocktitan.net/sec-filings/DUOL/8-k-duolingo-inc-reports-material-event-62db4369419f.html)；SEC 股東信確認「超過 5000 萬 DAU」：[SEC](https://www.sec.gov/Archives/edgar/data/1562088/000162828026012246/q4fy25duolingo12-31x25shar.htm)）。「Duo 之死」2025-02：Meltwater 統計兩週約 16.9 萬則提及、當日 +25,560%、#ripduo 4.5 萬次（[Meltwater](https://www.meltwater.com/en/blog/duolingo-dead-mascot-campaign)）；「17 億曝光」是公司自報，經二手轉述（[摘要](https://rohringresults.com/duolingo-dead-duo-campaign-case-study/)） | 角色驅動**分享**；連勝驅動**留存**，且必須搭配放鬆機制。日活成長與角色的因果**查不到**，勿宣稱 |
| **Finch** | 美國頁 4.9 分、76.7 萬評分；養鳥寵物，完成自我照顧讓鳥成長（[App Store](https://apps.apple.com/us/app/finch-self-care-pet/id1528595748)）。Editors' Choice 一說來自第三方（[FoxData](https://foxdata.com/en/blogs/finch-as-app-store-editors-choice-a-self-care-companion/)），Apple 原頁**未驗證**。月下載 10–50 萬是 Sensor Tower 估計（摘要，[連結](https://app.sensortower.com/overview/1528595748?country=us)） | 與毒舌相反的路線：**情感羈絆**，照顧角色＝照顧自己 |
| **(Not Boring)** | 官網稱 Apple Design Award 得主（[notbor.ing](https://notbor.ing/)）；商店文案稱「2× Apple Design Awards、9× App of the Day」（鏡像頁摘要，**自述未驗證**）；Apple 有專文介紹作者 Andrew Allen，用遊戲技術打造（[Apple Story](https://apps.apple.com/us/story/id1556321408)，摘要）；會員制、無廣告 | 靠「互動質感」而非角色吃編輯推薦。查不到它的留存數據 |
| **Gentler Streak** | Apple：2022 Apple Watch App of the Year、2024 Apple Design Award（社會影響）；團隊 8 人；抽象吉祥物 Yorhart；理念「guided but didn't push」；用 HealthKit 與 Apple Watch；2024 春新增日、韓、繁中、簡中（[Apple](https://developer.apple.com/news/?id=3m0ht22s)） | 反毒舌的證據：Apple 同樣給獎。重點是**原生整合與在地語言**，不是兇不兇 |

## 2. 人設如何驅動留存、分享、Featured（含推論）

- **留存**：Duolingo 的連勝、動畫、可請假比角色本身更可量化。**推論**：決斷連現在只有「完成登記／沒做罰則」，缺累積與儀式。
- **分享**：Duo 事件證明角色有故事才有迷因價值。決斷連已有梗圖卡與 `html-to-image`，但班長沒有可被談論的弧線。
- **Featured**：Apple 說所有 App 不分新舊都有機會上「App of the Day」；可在 App Store Connect 提名，**至少提前兩週，建議最多提前三個月**；In-App Events 與編輯清單也是入口（[Apple](https://developer.apple.com/app-store/getting-featured/)）。條款 5.2.4(b)：Editors' Choice 徽章由 Apple 自動加，不可自稱（[條款](https://developer.apple.com/app-store/review/guidelines/)）。**推論**：得獎案例共通點是「真功能＋Apple 平台整合（Watch／HealthKit／小工具）＋獨立作者故事」。

## 3. Apple 審核：PWA／WebView 與 Capacitor

**條文重點**（[Guidelines](https://developer.apple.com/app-store/review/guidelines/)）：
- **4.2**：要有「beyond a repackaged website」的功能、內容與 UI；「not particularly useful, unique, or app-like」不收。
- **4.2.2**：除 catalog 外，不得主要是行銷素材、廣告、web clippings、內容聚合或連結集合。**注意**：4.2.2 本文沒寫 WebView，「repackaged website」在 4.2 總則。有第三方指南把 4.2.1／4.2.3 說成「非公開 API」「純網站」，與官方原文不符（[例](https://iossubmissionguide.com/guideline-4-2-minimum-functionality)），勿照抄。
- **4.2.3**：不得依賴另一個 App；首次啟動需下載資源要揭露大小並徵詢。
- **4.3(b)**：不收與市面無差別的 App；dating、flashlight、simple timers、**fortune telling** 等列為成熟品類。
- **2.5.2**：不得下載、執行會改變功能的程式碼。Capacitor 官方流程是 `cap sync` 把建置檔複製進原生專案（[Capacitor](https://capacitorjs.com/docs/getting-started)）；**推論**：不要用 `server.url` 指向線上網站。
- **1.2**：條文明列「AI content creation apps」須有：過濾不當內容、舉報機制、封鎖、公開聯絡方式。決斷連生成口令並可分享圖卡，應視為適用（推論）。
- **5.1.2(i)**：個資分享給第三方（**含第三方 AI**）前須明示並取得同意。位置與偏好會送往 Anthropic 與 Google。
- **5.1.1、5.1.5**：隱私政策要在 App 內與 App Store Connect；不給定位時要有手動輸入替代。
- **4.5.4**：推播不得為必要功能，行銷推播須明確同意並可退出。**3.2.2(x)**：不得強迫使用者評分。
- **1.1.1**：「mean-spirited」內容若可能羞辱特定群體會被擋；專業諷刺／幽默家通常豁免。決斷連「罵行為不罵人」的護欄方向正確。

**補哪些原生能力（我的判斷；Apple 沒有「幾項才夠」的官方數字，第三方也只說 3–4 項且屬經驗談）**：

| 能力 | 為何有效 | 難度（推論） |
|---|---|---|
| 本機通知（午晚餐點名、睡前） | 網站做不到的主動點名，契合人設 | 低（Capacitor 外掛） |
| 觸覺回饋（罰則倒數、按鍵） | 最「像 App」的細節 | 低 |
| 系統分享面板分享梗圖 | 取代不穩的 Web Share | 低 |
| 定位權限＋用途字串＋手動地址 | 5.1.1／5.1.5 必備 | 低 |
| 離線外殼＋日記本機存取 | 不再是「網頁」 | 低至中 |
| 主畫面小工具（今日口令）、Live Activity（罰則倒數） | 2.5.16 要求小工具與 App 內容相關；審核與推薦加分 | 中至高（需原生 Swift 擴充） |
| App Intents／Siri：「報告班長」 | 平台整合 | 高 |

## 4. 台灣／日本 ASO

**Apple 官方欄位**（[App Store Connect](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information)、[條款 2.3.7](https://developer.apple.com/app-store/review/guidelines/)）：App 名稱 ≤ 30 字元；關鍵字欄 **100 bytes**，名稱與公司名已可被搜尋，勿重複；不得放其他 App 名稱與價格；宣傳文字 ≤ 170；描述 ≤ 4000；截圖須展示使用中畫面（2.3.3）。

- **CJK 換算（推論，請在 App Store Connect 實測）**：UTF-8 下中日文字約 3 bytes，100 bytes 約 33 字。我拿一組 19 個詞試算是 162 bytes，超標；縮成 `口令,今天吃什麼,午餐,晚餐,選擇困難,隨機,附近美食,自律,拖延,決定` 約 90 bytes。
- **台灣**：競品是大量輕量轉盤（如[「今天吃什麼」](https://apps.apple.com/tw/app/今天吃什麼/id1435902974)，摘要）。主打詞別搶「轉盤」，改搶「班長／口令／選擇困難」。**我抓到的 Duolingo 台灣區頁面**名稱〈多鄰國 - 極速學外語〉、副標「學英文、日文同韓文」，內文為粵語用詞（嘅、係）（[頁面](https://apps.apple.com/tw/app/多鄰國-極速學外語/id570060128)）。**啟示**：台灣頁務必以台灣用語自寫，勿沿用港式 zh-Hant。台灣 ASO 專屬一手數據**查不到**；中文 ASO 文章多為工具商內容，不採信。
- **日本**：Duolingo 日本頁名稱＝品牌＋品類關鍵字〈Duolingo：英語、韓国語、中国語を学ぼうアプリ〉（[頁面](https://apps.apple.com/jp/app/duolingo-英語・韓国語などのレッスン/id570060128)）；日本評分 4.5（77 萬）、台灣 4.7（14 萬）。日本 ASO 代理商指南（**單一商業來源，視為假設**）：關鍵字被分詞、片假名與漢字要分開收、截圖字多且密、評分偏嚴、勿隨意跳評分彈窗（[指南](https://localizedforjapan.com/japanese-aso-complete-guide/)）。
- **草擬（待 A/B）**：台灣名稱「報告班長｜決斷連」（8 字）；副標「吃什麼？去哪？班長替你下令」（13 字）。日本名稱「報告班長：決断連」；副標「今日のランチも予定も軍曹が即断」（15 字）。「班長」在日文語境偏學校／職場，「軍曹」更近軍教片語感，**是我的假設，需日本母語者與 Search Ads 驗證**。
- 截圖：人設可放在標語，但畫面必須是真實 UI。

## 5. 決斷連上架清單

### 必要（缺一可能被退或不該上）
1. 以 Capacitor 打包**本機資源**，API 留在 Vercel；移除 PWA 安裝提示。
2. 至少 4 項原生能力：本機通知、觸覺、分享面板、定位流程（含手動地址）。
3. 隱私政策（App 內＋ASC）、App Privacy 標籤、Privacy Manifest（Capacitor 文件有專頁，我未讀內文）、對第三方 AI／Google 的同意畫面。
4. 檢舉不當口令入口，加後端輸出過濾（1.2；現有 `banned.ts` 是字表，建議伺服端也驗）。
5. 年齡分級如實填（2.3.6）；審核備註寫明：無需登入、人設設計、護欄「罵行為不罵人」、4.3(b) 差異點。
6. 差異化論述：真實查店＋記憶＋日記週報，並先解掉「重複推薦」。
7. 支援網址含真實聯絡方式；審核期間後端保持上線。
8. 台灣繁中完整在地化；若同時上日本，先備日文名稱、副標、截圖、隱私頁。

### 加分
小工具與 Live Activity、App Intents、Apple Watch、App Store 提名（提前 2 週至 3 個月）、In-App Events（節慶特別演習）、Custom Product Pages、IAP 訂閱（賣功能不賣人格，仿 CARROT；須有「持續價值」3.1.2(a)）、好時機才呼叫系統評分。

## 6. 角色人設 5 個具體增強點（對應現有程式）

1. **班長「記得你」→ 發掘感。** 已推薦／已去過的店存本機（`place_id`＋日期），口令改寫成「今日偵察未踏之地」，週報加「本週新占領 N 個據點」。同時解決老闆抱怨(1)，人設與功能互相強化。
2. **火力旋鈕＋「專業模式」。** 3 位班長之外加「關閉人設」（CARROT 式）與「低能量日」：使用者回報累，班長降火（Gentler Streak 式）。同時降低 1.1.1 風險。
3. **出勤連勝＋公差假單＋升階。** 連續服從天數；可用「公差」保住連勝（Streak Freeze 式）；里程碑升階，直接用現有 `NCO_INSIGNIA` 階級章。通知頻率要克制（4.5.3、4.5.4）。
4. **可分享的戰報與節令演習。** 週報、升階做成圖卡；中秋、日本盆休做週更「特別演習」，同步成 In-App Event；時事哏用靜態 JSON 週更，不必上 cron。
5. **班長有弧線。** 阿良隨服從率「成長」，黑面極少數時刻破功（變動獎勵）；稱讚語要避開 `banned.ts` 的禁詞，改用「還行」「不錯」這類。罰則倒數改成 Live Activity，是人設與原生能力的交會點。

## 7. 查不到／未驗證

- 台灣、日本下載榜前百的門檻與同類 App 排名：**查不到**可信公開數據。
- Finch 的 Editors' Choice、(Not Boring) 的 9× App of the Day：僅第三方或自述，**未在 Apple 原頁驗證**。
- Duo 之死「17 億曝光」：公司自報，二手轉述。
- 角色人設對留存的因果量化：**查不到**。
- CARROT 等的年齡分級與審核往返紀錄：**查不到**；決斷連毒舌強度需自行評估並如實填問卷。
- 日本對軍旅風角色與階級章的接受度：**查不到**，需在地測試。
