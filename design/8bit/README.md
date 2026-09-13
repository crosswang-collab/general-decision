# 8-bit 方向（C）工作檔

由 `design/sprites.mjs` 與 `design/build8bit.mjs` 產生，**不要手改這裡的 .dc.html**。

```bash
node design/build8bit.mjs     # 重新產生 8bit/*.dc.html + canvas.json
```

- `sprites.mjs` 是角色系統：三人共用格線（眼線 Y24、肩線 Y38），
  表情只換眉與嘴。改表情 = 改一個函式，不重畫任何像素。
- `design/*.dc.html`（上一層）是舊的軍教片方向，保留供對照。
