// 士官階級章資料 — DEV-PLAN-2 階段 C（範圍 C-1：只修徽章，不加角色）。
// 純資料，沒有 React：api/ 經 prompt.ts → officers.ts 會載入這支，lambda 裡不能出現 JSX。
//
// ⚠️ 查證狀態：待核。服制條例附圖三（一手來源）被容器出口政策擋住，兩次都抓不到；
// 「粗折槓 + 細折槓」的數量規則來自多個一致的二手來源（見 docs/C3-insignia-research.md）。

/** 一枚階級章 = 幾條粗折槓 + 幾條細折槓。 */
export interface Insignia {
  thick: number
  thin: number
}

/** 陸軍士官六階（待核）：士官 1 粗、士官長 2 粗；細槓 1／2／3 分三級。 */
export const NCO_INSIGNIA = {
  下士: { thick: 1, thin: 1 },
  中士: { thick: 1, thin: 2 },
  上士: { thick: 1, thin: 3 },
  三等士官長: { thick: 2, thin: 1 },
  二等士官長: { thick: 2, thin: 2 },
  一等士官長: { thick: 2, thin: 3 },
} as const satisfies Record<string, Insignia>

export type NcoRank = keyof typeof NCO_INSIGNIA

/** 給測試與設計稿用：三個角色的徽章必須互不相同。 */
export function insigniaKey(i: Insignia): string {
  return `${i.thick}-${i.thin}`
}
