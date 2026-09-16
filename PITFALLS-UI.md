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
