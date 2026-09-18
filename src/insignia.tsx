// 士官階級章 SVG — 資料在 insignia.ts（純 .ts，api/ 也會載），這裡只有 React 元件。
//
// ⚠️ 查證狀態：待核（見 insignia.ts 檔頭）。V 形開口方向、粗細槓的上下順序、顏色，
// 二手來源都沒有可引述的文字，是本檔的**假設**，全部集中在下面的常數，看到附圖三後只要改常數。
import type { Insignia } from './insignia.ts'

// ── 假設區（看到附圖三之後改這裡）────────────────────────────────
/** V 形開口朝下（尖端朝上，^ 形）。 */
const POINT_UP = true
/** 細槓在上、粗槓在下。 */
const THIN_ABOVE_THICK = true
/** 士官長（2 粗）用銅金色，士官用素色——二手來源稱「軍官及士官長階級標識為金色」。 */
const BRASS_FROM_THICK = 2
// ────────────────────────────────────────────────────────────

const W = 26
const THICK = 3
const THIN = 1.5
const GAP = 2
const DEPTH = 6 // V 的高度（兩端到尖端的垂直距離）

/**
 * 內建 SVG。尺寸跟著 font-size 走（em），放在 11px 的名牌上約 26×18。
 * 用 currentColor 畫素色槓，銅金色吃 --brass token（淺 #AC7C00／深 #F8B800，lv2 反白名牌另有覆寫）。
 */
export function InsigniaMark({ insignia, title }: { insignia: Insignia; title?: string }) {
  const bars: { width: number }[] = []
  const thin = Array.from({ length: insignia.thin }, () => ({ width: THIN }))
  const thick = Array.from({ length: insignia.thick }, () => ({ width: THICK }))
  bars.push(...(THIN_ABOVE_THICK ? [...thin, ...thick] : [...thick, ...thin]))

  // 由上往下疊：每條槓佔 width + GAP
  const height = bars.reduce((h, b) => h + b.width + GAP, 0) - GAP + DEPTH
  const brass = insignia.thick >= BRASS_FROM_THICK
  const stroke = brass ? 'var(--brass)' : 'currentColor'

  let y = 0
  const lines = bars.map((b, i) => {
    const top = y + b.width / 2
    y += b.width + GAP
    // 尖端朝上：兩端在下、中點在上；反之鏡射
    const [ya, yb] = POINT_UP ? [top + DEPTH, top] : [top, top + DEPTH]
    return (
      <polyline
        key={i}
        points={`1,${ya} ${W / 2},${yb} ${W - 1},${ya}`}
        fill="none"
        stroke={stroke}
        strokeWidth={b.width}
        strokeLinejoin="miter"
        strokeLinecap="butt"
        data-bar={b.width === THICK ? 'thick' : 'thin'}
      />
    )
  })

  return (
    <svg
      className="insignia"
      viewBox={`0 0 ${W} ${height}`}
      width={W}
      height={height}
      role="img"
      aria-label={title}
      data-insignia={`${insignia.thick}-${insignia.thin}`}
      shapeRendering="crispEdges"
    >
      {title && <title>{title}</title>}
      {lines}
    </svg>
  )
}


