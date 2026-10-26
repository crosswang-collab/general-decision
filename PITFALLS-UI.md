# 本次驗證紀錄

- [環境] GitHub 下載與 localhost 啟動被 network sandbox 擋住 — 取得本輪網路權限後執行；未使用提高 shell 權限的繞過方式。
- [環境·已解除 2026-09-14] 2026-09-11 那輪 WebKit／Chromium headless 啟動遇到 macOS MachPort permission denied，
  當時改用內建瀏覽器檢查，且未標記 Playwright E2E PASS。2026-09-14 重跑 `npm run e2e` 36 條與 `npm run e2e:shots` 7 張，
  全部 exit 0 —— 是環境問題，不是程式問題。
- [環境] Linux 容器（2026-09-16）裝不了 WebKit：出口網路政策擋住 playwright.download.prss.microsoft.com 與 cdn.playwright.dev。
  以預裝 Chromium 跑 `tests/e2e` 36 條全過，但那不是 WebKit 契約，該環境不得據此標記 STOP C／D PASS。
- [預览] 快速截圖拍到進場透明狀態 — 展示入口提供350ms ready標記，等待後截圖，正式動畫不改長度。
- [CSS] 大字級時 flex 子容器可能收縮而讓文字延伸到下一區 — 區塊不收縮、卡片內容列保留 min-content。
- [圖片] DOM 字串回傳有長度上限，完整 data URL 會被截斷 — 保存時分段讀取已生成的 DOM 圖片來源，驗證PNG尺寸與實際解碼。
- [依賴] npm ci 的 whatwg-encoding deprecation 來自既有間接依賴 — 無新增依賴，當次 audit 0 vulnerabilities；不在視覺改版中擴大套件更新範圍。
- [CSS·2026-09-18] 自訂屬性有「兩個」坑，只躲一個不夠。已知的第一個是**按最近的祖先解析，不是按 specificity**
  （`:root` 寫的值對 `main[data-level]` 沒有作用，必須在 media query 裡再寫一次 `main[data-level]`）。
  第二個是**同 specificity 由後者勝**：深色的 `main[data-level]{--meme-edge}` 若寫在淺色的 `main[data-level]` 之前，
  會被後面的淺色宣告整個蓋掉，深色永遠吃到淺色的值。兩條規則長得一樣、都沒有警告，靠讀 CSS 看不出來。
  這次是 `tests/e2e/palette.spec.ts` 量渲染後的 `getComputedStyle` 才抓到——而且光驗「對比 ≥ 3:1」還抓不到，
  因為錯誤的值剛好也過門檻，是把每層的預期色值寫死才現形。結論：色盤類的斷言要驗「值」，不要只驗「門檻」。
  **同一天踩第二次**（lv2 名牌的 `--brass`）：淺色宣告寫在元件樣式旁（第 22 行），深色覆寫放在第 12 行的 media block，又被蓋掉。
  規則：每一層的 token（淺色與深色）一律集中在 `main[data-level]` 那一區，淺色在前、深色 media block 緊接在後，不要散到各元件旁邊。


# Round 3 教訓（2026-10-22 ～ 10-26）

- [Places·推薦] 同一座標永遠同一家 — Nearby 不帶 rankPreference 預設熱門排序、本地再依評分固定排序、prompt 叫模型挑最高分、保底也是第一名：整條鏈確定性且無記憶。選店改由程式加權抽樣＋本機記憶（`src/discovery.ts`、`src/placeMem.ts`），模型只寫口令。
- [Places·深夜] 熱門排序撈回的 20 家深夜幾乎全打烊 → no_places — 第二次查詢改 Text Search＋`openNow:true`、依距離（`src/lanes.ts` widenPlan）。Nearby 沒有 openNow 參數。
- [Places·住宿] includedTypes `restaurant` 會撈回主類別是 hotel／lodging 的地點（「東京半島酒店」）— `toCandidates` 依 primaryType 拿掉住宿類。
- [Places·日本] languageCode `zh-TW` 查日本店，沒中文名就回英文拼音、跟招牌對不上 — 日本座標用 `ja`（`placesLanguage`）。
- [時區] 伺服器跑 UTC：`Date#getDay()/getHours()` 會拿到錯的星期與小時 — 一律用 `src/tz.ts`（Intl＋座標判時區）。
- [前端相容] regex lookbehind `(?<=…)` 舊 iOS Safari 會讓整包 JS 解析失敗；CSS `inset` iOS < 14.5 不支援 — 前端不用 lookbehind（伺服器端可以），`inset` 寫四邊。
- [文字守門] 金額 regex 把量詞「塊」當錢、次數修正把「不要讓我說第二次」改壞、營業時間把「12:10 開動」當開門 — 守門規則一律白名單語境＋回歸測試，只改 meme 上下行、不動 steps。
- [IndexedDB] iOS 的 IDB 偶爾卡住不回，`await` 它會讓主流程永遠停在等待 — 本機記憶呼叫一律包 800ms 逾時（`safe()`），寫入不阻擋換畫面。
- [驗收門檻] 「平均評分降幅 ≤0.15」與「7 天重複率 <15%」數學上互斥 — 門檻要先用上帝視角算可行性；改量「同家數下與最佳解的差距」（oracleGap）。
- [流程] 平行子代理用 git worktree 各自一個分支，避免共用工作目錄互踩；合併前型別契約先由 Team Lead commit。
