# 第 13.3 節 人工對照表

**這張表由 checker 填，maker 不自評（第 3.3 節）。**

怎麼用：
1. 開新對話（或 `/clear`），貼第 3.3 節的 checker 指令。
2. 並排打開 `shots/*.png` 與 `decide-mock-v5.html`（用瀏覽器開，切到 iPhone 尺寸）。
3. 逐格填 PASS / FAIL。任一格 FAIL → STOP 條件 D 不成立 → VERDICT: FAIL。

截圖環境：WebKit（對齊 iPhone Safari）、iPhone 13 視窗、淺色模式、`npm run e2e:shots` 產出。

| 截圖 | 對照 mock v5 | 判定項 | PASS/FAIL | 備註 |
|---|---|---|---|---|
| 01-home.png | home | 班長在上、對話框、4 磁貼、3 小鍵 | | |
| 02-intake-attend.png | intake | 星星 5 顆、chips | | |
| 03-cmd-eat.png | cmd | 兩欄，角色不壓字，steps 白卡在下 | | |
| 04-cmd-buy.png | cmd red | 紅卡、stop | | |
| 05-log.png | log | 登記卡 + 雄壯威武 + 分享鍵 | | |
| 06-stand.png | stand | 紅卡倒數 | | |
| 07-weekly.png | weekly | 單欄文字 + 角色在下 | | |

## 已知的刻意差異（不是 bug，但 checker 請自行判斷是否接受）

- **首頁 meta 文字**：mock 寫「入伍第 12 天 · 饅頭剩 ∞ 顆」（假資料），本版寫「決斷連 · 大事不受理」，
  因為 MVP 沒有入伍天數這個概念。
- **三顆按鈕在 390px 寬會換行**：`.row` 的 `flex-wrap:wrap` 與 `.btn{min-width:8.75rem}` 是照抄 mock v5 的，
  同寬度下 mock 也會換行。
