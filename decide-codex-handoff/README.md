# 決斷連 · Codex 接手專案

這個資料夾就是專案根目錄。在 Codex 選擇「開啟專案」並選此資料夾，即可接續開發。先讀 [CODEX-HANDOFF.md](CODEX-HANDOFF.md)。

## 本機啟動

使用能支援鎖定版 Vite 8 的 Node.js（建議 Node 22.12+ 或24 LTS），然後：

```sh
npm ci
npm run dev
```

開啟終端顯示的本機網址。正式首頁需要後端API金鑰才能完整下令；環境變數名稱見 `.env.example`，這份交付不含真實金鑰。

不需要金鑰的設計預覽：在同一個本機網址後加 `/design.html?screen=home&theme=light&level=1`。此入口使用固定展示資料，只供版面及操作檢查。

```sh
npm run typecheck
npm run test
npm run build
npm run e2e
npm run e2e:shots
```

Playwright瀏覽器未安裝時，依其提示安裝WebKit。本次環境無法啟動WebKit，不代表這些端對端測試已通過。

## 最重要的檔案

- `CODEX-HANDOFF.md`：目前狀態、限制、下一步及可貼給Codex的完整任務。
- `DESIGN.md`：UI token與設計規格，末段日式8-bit更新優先於舊描述。
- `docs/CHARACTER-BRIEF.md`：三位班長與15種表情的規格。
- `public/officers/`：正式48×48 PNG／無損WebP，三人各五表情。
- `design/sprites.mjs`：可編輯角色骨架；`design/8bit/export.py`重建資產。
- `handoff/reference/`：最新角色總覽、生成方向圖、可操作HTML與上版截圖。

本交付為可搬移的完整來源快照，不含node_modules、Git歷史或機密。來源repo為 https://github.com/crosswang-collab/general-decision ，並未推送本次修改。
