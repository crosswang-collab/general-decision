# 本次驗證紀錄

- [環境] GitHub 下載與 localhost 啟動被 network sandbox 擋住 — 取得本輪網路權限後執行；未使用提高 shell 權限的繞過方式。
- [環境] WebKit／Chromium headless 啟動遇到 macOS MachPort permission denied — 改用內建瀏覽器檢查；不得標記 Playwright E2E PASS。
- [預览] 快速截圖拍到進場透明狀態 — 展示入口提供350ms ready標記，等待後截圖，正式動畫不改長度。
- [CSS] 大字級時 flex 子容器可能收縮而讓文字延伸到下一區 — 區塊不收縮、卡片內容列保留 min-content。
- [圖片] DOM 字串回傳有長度上限，完整 data URL 會被截斷 — 保存時分段讀取已生成的 DOM 圖片來源，驗證PNG尺寸與實際解碼。
- [依賴] npm ci 的 whatwg-encoding deprecation 來自既有間接依賴 — 無新增依賴，當次 audit 0 vulnerabilities；不在視覺改版中擴大套件更新範圍。
