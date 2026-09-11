# 上線五步（第 15 節）

S1–S9 已經完成並且全綠。剩下這五步需要你本人，因為都要你的帳號或金鑰。
**最短路徑：只做第 1、2、4、5 步就能開始用。** 第 3 步（Google Places）可以晚點再補。

---

## 1. Vercel 匯入 repo

到 https://vercel.com/new → Import `crosswang-collab/general-decision`
Framework 選 **Vite**（通常會自動偵測）。Root Directory 留空（專案就在根目錄）。

## 2. 填環境變數

Settings → Environment Variables，Production 環境：

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | 你的 Anthropic 金鑰（**必要**） |
| `GOOGLE_PLACES_KEY` | Google Places 金鑰（**可選**，見第 3 步） |

> 沒填 `GOOGLE_PLACES_KEY` 也能上線。「吃」「歇」會走第 7 節規則 6 降級：
> 班長不推薦具體店名，改講類型，並在梗圖下標註明「店家資料暫時拿不到」。
> 其他五張卡完全不受影響。

## 3.（可選）Google Places

Google Cloud Console → 啟用 **Places API (New)**
金鑰限制：API restrictions = Places API (New)；Application restrictions = **None**（我們從 server 端呼叫）。
費用：第 16 節——Nearby Search Enterprise 免費 1,000 次/月，單人用不完（程式內另有每日 40 次硬上限）。

## 4. Deploy

按 Deploy，拿到 `https://xxx.vercel.app`。

## 5. 裝到手機

iPhone Safari 開網址 → 分享 → 加入主畫面 → 開啟允許定位。

---

## 驗收（第 15 節）

三個動作都成立才算上線：

1. 按「吃」→ 出現店名
2. 按「報告班長，完成」
3. 打開新兵日記 → 有一筆

命令列也可以驗一次：

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://你的網址.vercel.app
```

```bash
curl -s -X POST https://你的網址.vercel.app/api/order -H 'content-type: application/json' -d '{"module":"sleep","level":1,"choices":{"wake":"07:30"},"now":"2026-09-12T22:00:00+08:00","recentOrders":[]}'
```

第二個應該回一段 JSON，`meme.big` 是「23:30 熄燈」。

---

## 想先在電腦上看

不需要任何金鑰就能看畫面（API 會回錯誤畫面，那條路徑也是照第 11 節設計的）：

```bash
npm run dev
```

有 Anthropic 金鑰的話，整支都會動：

```bash
ANTHROPIC_API_KEY=你的金鑰 npm run dev
```

---

## 已知風險（誠實區）

- **api/ 沒有在真的 Vercel 上跑過。** 本機用 esbuild（Vercel 同一套打包器）驗過兩支函式都 bundle 得起來、
  載入後可回應，也用真 curl 打過 200，但「在 Vercel 實機上」這件事只有你部署了才知道。
  若 `/api/order` 回 500，第一個要看的是 Vercel 的 Function Logs。
- **Claude 的口令品質沒有被測過。** 第 3.1 節寫明產品內 loop（口令品質）不在契約內，要你用人眼迭代。
  提示詞在 `src/prompt.ts`，語料在 `src/officers.ts`。
- **`claude-sonnet-5` 這個 model id** 寫在 `api/order.ts` 與 `api/weekly.ts`。若 API 回 404 model not found，
  換成你帳號可用的 model id。
