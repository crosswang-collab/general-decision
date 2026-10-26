# W3 交接單（給 W2 掛載、給 INT 合併）

> 2026-10-22，W3（分支 `r3/w3-store`）。W3 不碰 `src/app.tsx`／`src/styles.css`；掛載與樣式是 W2 的事。這份列出「掛哪裡、props、testid、要不要加 CSS」。

## 1. 三個要掛載的東西

### 1-1　`<Consent>`（`src/consent.tsx`）

```ts
import { Consent, CONSENT_KEY, CONSENT_VERSION } from './consent.tsx'
<Consent level={level} onAccept={…} onPrivacy={…} />   // onPrivacy 選配
```

| 項目 | 說明 |
|---|---|
| props | `level: Level`（決定開頭一句的班長口吻）、`onAccept: () => void`、`onPrivacy?: () => void`（有給才出現「看完整隱私說明」鍵） |
| testid（契約，已保留） | `consent`（內文 `.notice`）、`consent-accept`（主鍵「是！班長」）；新增 `consent-privacy`（選配鍵） |
| 根節點 | `<section class="screen" data-screen="consent">` |
| 儲存 | **元件不碰 storage**。`onAccept` 裡由 `app.tsx` 寫 `localStorage.setItem(CONSENT_KEY, CONSENT_VERSION)`（`'decide.consent'` = `'v1'`），包 try/catch（無痕模式會丟例外，寫不進去就只在這次 session 放行） |
| 讀取判斷 | 建議：`localStorage.getItem(CONSENT_KEY) === CONSENT_VERSION` 才算同意（之後升版會重問）。先判 `null`，不要 `Number(null)`（§E.4） |
| 同意前 | 不得呼叫任何 `/api/*`（B16）。包含定位後的 `geoAhead` 預取、`/api/weekly` 的自動產出 |
| 建議掛法 | `App` 最外層：`if (!consented) return <Consent level={level} onAccept={accept} onPrivacy={() => setShowPrivacy(true)} />`；`showPrivacy` 時改渲染 `<Privacy onBack={() => setShowPrivacy(false)} />`（回到同意畫面） |
| 「不同意」 | 畫面上沒有「不同意」鍵——文案寫「不同意？直接關掉就好，班長不勉強」。這是刻意的：不加第二顆鍵，避免多一步 onboarding（W2「不要做」） |

### 1-2　`<Privacy>`（`src/privacy.tsx`）

```ts
import { Privacy } from './privacy.tsx'
<Privacy onBack={() => setScreen('home')} />
```

| 項目 | 說明 |
|---|---|
| props | `onBack: () => void`（「← 回報告」按鈕呼叫） |
| testid（契約，已保留） | `privacy`（標題 `.notice`）；新增 `privacy-links`（條款連結區） |
| 根節點 | `<section class="screen" data-screen="privacy">` |
| 入口 | 首頁底部小字「隱私」（W2 掛）；同意畫面的 `onPrivacy` |
| 長頁 | 十一個 `.notice` 卡疊起來，會超過一屏，靠頁面本身捲動；不需要捲動容器 |

### 1-3　`reportMailto(order, level)`（`src/report.ts`）

```ts
import { reportMailto } from './report.ts'
<a href={reportMailto(order, level)} data-testid="report">回報這道口令</a>
```

- 純函式，回傳 `mailto:[CONTACT_EMAIL]?subject=…&body=…`（皆 `encodeURIComponent`）。body 只有班長名、meme 三行、steps，**不含座標、place.id、mapUrl**。
- 掛在 `Cmd` 畫面 `StepsCard` 下方，極小文字連結（計劃 W2 步驟 4）。建議 `<a>` 而不是 `<button>`，讓長按可複製；加 `target` 不需要。
- `CONTACT_EMAIL` 常數由同檔導出，`privacy.tsx` 也引用它。**Cross 只改這一個地方**。
- 口令是 `Order`；`level` 是目前班長火力。

## 2. 需要 W2 加的 CSS（W3 不新增 CSS）

W3 元件只用既有 class：`.screen`、`.notice`、`.btn`、`.btn.line`、`.back`、`.row`、`.hint`。全域 `*{margin:0;padding:0}` 會把 `<p>` 間距清零，所以**建議**在 `src/styles.css` 加（只用既有 token，不改色票）：

```css
/* 同意畫面與隱私頁：段落間距（全域 reset 把 p 的 margin 清掉了） */
[data-screen="consent"] .notice p + p,
[data-screen="privacy"] .notice p { margin-top: 8px; }
[data-screen="consent"] .notice small { margin-top: 10px; }
[data-screen="privacy"] .notice b { display: block; }
[data-screen="privacy"] .notice a { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
/* 同意畫面主鍵與次鍵直向排，375×667 不捲動就按得到「是！班長」 */
[data-screen="consent"] .row { flex-direction: column; align-items: stretch; }
[data-screen="consent"] .row .btn { flex: 0 0 auto; }
```

- 不加也能用（段落會緊貼、但每段開頭有 ①②③ 標記）；加了更好讀。
- 同意畫面在 375×667 要看得到主鍵：W2 的 e2e 請量一次（B16 只要求出現與 API 0 次呼叫，沒要求不捲動，但建議）。
- 色票：本輪沒有新增任何顏色；`palette-guard` 對 `styles.css` 每個 6 位 hex 都檢查，上面範例沒有 hex。

## 3. 給 W2 e2e 的 testid 總表

| testid | 元素 | 出現時機 |
|---|---|---|
| `consent` | 同意內文 | 首次啟動／`decide.consent` 非 `v1` |
| `consent-accept` | 「是！班長」 | 同上 |
| `consent-privacy` | 「看完整隱私說明」 | 有傳 `onPrivacy` 時 |
| `privacy` | 隱私頁標題 | 進隱私頁 |
| `privacy-links` | 條款連結區 | 同上 |
| `report`（建議） | 「回報這道口令」連結 | 口令畫面（W2 自訂；W3 不規定） |

e2e 的 `prime(page)` 要設的是：`localStorage.setItem('decide.consent', 'v1')`。

## 4. 需要 Team Lead／INT 決定或核對的事

1. **隱私政策公開網址（ASC 必填）**：目前隱私頁只是 App 內畫面，沒有 URL。`public/privacy.html` 不在 W3 的檔案所有權表內，我沒建。請 INT 決定：做靜態頁、或用獨立站。內容以 `PRIVACY_SECTIONS`（`src/privacy.tsx`）為準。
2. **隱私頁「送給 Anthropic 的內容」要與 W1 合併後的 prompt 對照**：我寫的是「選擇、目前時間、位置或地點名稱、近 7 天口令標題、被選中店的店名／步行分鐘／營業時間／價位、第幾次來」（privacy.tsx 第三節）。這是**偏寬的揭露**（依契約 commit 的舊 prompt 有送座標與位置標籤；W1 新 prompt 可能不再送座標）。W1 合併後請對一次：少送的可以收窄，**多送的一定要補上**。
3. **debug 紀錄的揭露**：隱私頁第四節寫了「除錯紀錄含候選店名與評分、只存手機」，因為 `src/debug.ts` 現在確實存這些（DEV-PLAN-3 §E.1-12 的已知風險）。若 Cross／法務決定拿掉候選店名，這句要同步刪。
4. **日記標題存的是店名**：隱私頁第二節寫了「吃、歇的口令標題就是店名」（`makeEntry` 不再寫 `placeName`，但 `big` 仍是店名，R3§3.4／R10 待 Cross 決定）。處置改了，這句要跟著改。
5. **`[CONTACT_EMAIL]` 與支援網址**：Cross 填。出現在 `src/report.ts`（單一常數）、隱私頁、STORE-LISTING 審核備註。
6. **日本區不要上**：沒有日文介面、日文隱私頁，文案只是草稿（STORE-LISTING 日本章節）。
7. **Capacitor 阻擋項**（W1／W2 的檔案）：API 相對路徑、API 無 CORS——詳見 [CAPACITOR-READY.md](CAPACITOR-READY.md) §2-2。本輪不處理。
8. **icons**：W3 重跑了 `node scripts/build-icons.mjs`，四張 PNG 的位元組與現檔不同（構圖、色常數 `#005800`／`#F8B800`／`#FCFCFC` 都沒變，都在 NES 色盤；差異應只來自本機字型的點陣輸出）。為避免二進位檔無謂變動、且本機字型與原檔可能不同，**我還原成現檔，沒有更新圖示**。`palette-guard` 不檢查 PNG 內容。若 Cross 想要在目前機器的字型下重產，跑 `npm run icons` 即可。

## 5. W3 實際動了哪些檔案

| 檔案 | 動作 |
|---|---|
| `src/consent.tsx`、`src/privacy.tsx`、`src/report.ts` | 實作（原本是空殼；props 與 testid 契約保留，`Consent` 多一個選配 prop `onPrivacy`） |
| `public/manifest.webmanifest` | 加 `id`／`lang`／`dir`／`categories`；`description` 改為商店副標。**`theme_color`／`background_color` 沒動** |
| `index.html` | `<html lang="zh-Hant-TW">`；`description` 同步。`theme-color` 沒動 |
| `docs/round3/STORE-LISTING.md`、`CAPACITOR-READY.md`、`W3-HANDOFF.md` | 新增 |
| `tests/unit/store-listing.test.ts`、`consent.test.tsx`、`report.test.ts`、`manifest.test.ts` | 新增（`consent.test.tsx` 同時測 `<Privacy>`） |

沒碰：`src/types.ts`、`src/app.tsx`、`src/styles.css`、既有測試的任何斷言。
