# 報告班長 · 決斷連

一個手機 PWA。按一顆情境鍵、點 0–2 個選項，值星班長下一道不可拒絕的命令，
你回報「完成／店關了／沒做」，完成就登記、沒做就罰則。每道口令自動寫進新兵日記，
週日 20:00 後產出莒光園地週報。

規格：[DECIDE-DEV-DOC-v1.md](DECIDE-DEV-DOC-v1.md)　畫面基準：[decide-mock-v5.html](decide-mock-v5.html)

## 現在的狀態

S1–S10 完成。已部署到 Vercel，`/api/order`、`/api/weekly` 在正式站可回應。
**剩最後兩件事需要你本人**：在 Vercel 填 `ANTHROPIC_API_KEY`（必要）、在 GCP 啟用 Places API (New)（可選）。
見 [DEPLOY.md](DEPLOY.md)。進度在 [state/decide-mvp-build.md](state/decide-mvp-build.md)。

## 指令

```bash
npm run dev        # 本機開發（同時把 api/ 掛成 /api/*，不必 vercel dev）
```

```bash
TZ=Asia/Taipei npm run typecheck && npm run test    # STOP A
```
> `TZ` 不可省：`tests/unit/diary.test.ts` 有兩條斷言綁台北時區，在 UTC 機器上會紅。

```bash
npm run build      # STOP B
```

```bash
npm run e2e        # STOP C：36 條 Playwright（WebKit，對齊 iPhone Safari）
```
> 先 `npx playwright install webkit`。2026-09-14 那輪 36 條全過（exit 0）。
> 2026-09-11 交付文件裡「WebKit 被 macOS sandbox 擋住、不得標記 E2E PASS」是那一輪的環境問題，已解除。

```bash
npm run e2e:shots  # STOP D：產 shots/ 七張截圖，對照表在 shots/CHECK.md
```

```bash
npm run smoke      # 真 curl 打 /api/order，上游用本機假伺服器頂替
```

```bash
npm run check:bundle  # 在本機重建 Vercel lambda 版面，確認 api/ 真的載得起來
```
> `npm run dev` 與 `npm run smoke` 走 vite 的 `ssrLoadModule`，解析得了 `.ts` specifier，
> 所以本機永遠綠燈、抓不到「上線才會爆」的兩類問題（`src/` 沒進 lambda、`export default` 形狀錯）。
> `check:bundle` 就是補這個缺口的，改 `api/` 或 `vercel.json` 之後一定要跑。

## 結構

```
src/
  app.tsx        單頁狀態機 home→intake→cmd→(log|stand)；diary；weekly
  cards.ts       7 張模組卡（第 6 節）
  officers.ts    3 位班長，語料三層各 24 句（第 7 節）
  banned.ts      護欄字表：罵行為不罵人
  avatar.tsx     SVG 角色（第 14 節資產介面，繪師交件當天可換）
  meme.tsx       梗圖卡（兩欄 grid，角色不壓字）
  diary.ts       IndexedDB 讀寫、週統計
  api.ts         呼叫 /api/*，錯誤分類
  prompt.ts      系統提示詞
  rules.ts       算得出來的硬規則（attend／sleep／buy／reply）
  orderParse.ts  Claude 回傳的四層解析
  places.ts      Places 過濾與距離
api/
  order.ts       Places → Claude → Order JSON
  weekly.ts      本週日記 → Claude → WeeklyReport JSON
```

金鑰只存在於 `api/`，前端永遠不碰。無 DB、無 cron、無推播。

## 設計上的一個決定

第 6 節那些「算得出來」的規則——attend 的 ★≤2、sleep 的熄燈時間、buy 的 72 小時、reply 永遠 do
——都在伺服器端算好、塞進提示詞，**並在拿回模型的答案後再強制蓋一次**。
模型只負責語氣與內容，判定權不在它手上。單元測試直接驗這些規則。
