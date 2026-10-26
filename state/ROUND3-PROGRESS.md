# Round 3 進度（接手用）

> 最後更新：2026-10-27 00:15（台北）。正式站：https://general-decision.vercel.app （程式碼最新是 main `11603c6`；之後只有文件 PR）。
> 新的 session 從這份開始讀；細節在 `docs/round3/`（R1–R3 市場調查、STRATEGY、DEV-PLAN-3）。

## 已完成並上線

| PR | 內容 |
|---|---|
| #21 | 發掘引擎（店由程式挑、本機記憶、換一家原因）、價位篩選（台幣／日圓）、同意頁、隱私頁、上架文件 |
| #22 | 正式站實測修正：深夜第二次查詢改 Text Search＋openNow、拿掉住宿類、超預算講清楚方向 |
| #23 | 日本店名用 languageCode `ja` |

正式站實測（2026-10-26 深夜）：台北同座標 10 次 → 10 家不同；舊版 6 次全是同一家。東京 5/5 成功。
閘門：tsc ✅、vitest 474 ✅、build ✅、check:bundle ✅、smoke ✅、e2e WebKit 94 ✅（#21 時）、離線重播全部門檻 ✅。

## 卡在 Cross 的事

1. `src/report.ts` 的 `CONTACT_EMAIL` 仍是 `[CONTACT_EMAIL]`（目前回報走 GitHub issue）。
2. 舊日記裡已存的店名（Google 條款）要保留或刪除。
3. App Store：需要 Xcode＋Apple Developer 帳號；清單見 `docs/round3/STORE-LISTING.md`、`CAPACITOR-READY.md`。
4. 可選：有 `GOOGLE_PLACES_KEY` 的環境跑 `npm run probe:lanes`，回 200 的新料理 lane 再把 `src/lanes.ts` 的 `verified` 翻成 true。
5. 可選：Vercel 設 `TYPESAFE_API_KEY` 後，`scripts/taste-judge.mjs`、`scripts/effort-route.mjs`、`src/jevJudge.ts` 才會實際呼叫 Jev。

## 已知風險／下一輪候選

- 每道口令多半查 2 次 Places，前端每日上限 40 次 ≈ 20 道。
- 價位未知的店不被預算排除（只降權＋卡上標「價位未知」）。
- 忌口只在 lane 層：「素」改查素食；「不吃牛」只擋牛排館。可用 `src/jevJudge.ts` 的 dietConflict 補。
- 第二次查詢是 locationBias，深夜可能派到較遠的店；可加步行上限。
- 下一輪（STRATEGY §4）：Capacitor 打包＋本機通知、連勝／公差假單、專業模式（文書兵）、記憶匯出匯入。

## 這一輪的決策紀錄（為什麼這樣做）

- 門檻變更：S6 的 bayesDrop ≤0.15 改擋 oracleGap ≤0.08（原門檻不可行，理由在 `tests/unit/discovery-replay.test.ts`、`docs/round3/DEV-PLAN-3.md` §E.3 補授權表）。
- 參數：曝光半衰期 3／7 天、balanced λ=0.8、familiar λ=0.05（熟門熟路即不怕回訪）。
- 資料最小化：送 Anthropic 的 prompt 不含座標、地點名稱、place_id；只送國家與被選中的那家店。
- 本機只存 place_id＋時間戳（Google 條款）；新日記不再寫店名。

## 審查紀錄

- 紅隊：Fable（Red Lead）＋ Opus（Red Second）＋ Opus checker 獨立審 → 1 個 P1、約 10 個 P2，全部修正並補回歸測試 → Fable 換人複審（抓到 R3R-1 營業時間誤判，已修）。
- PR #21–#24 每個都經兩位獨立 reviewer、綁 head SHA 合併。
- 教訓整理在 `PITFALLS-UI.md` 的「Round 3 教訓」。

## 怎麼接手

1. 讀這份 → `docs/round3/STRATEGY.md`（方向）→ `docs/round3/DEV-PLAN-3.md`（施工圖與驗收條件）。
2. 驗證：`TZ=Asia/Taipei npm run typecheck && TZ=Asia/Taipei npm test && npm run build && npm run check:bundle && npm run replay && npm run e2e`。
3. 改 `api/` 後一定跑 `npm run check:bundle`；PR 合併進 main 就會部署正式站。
