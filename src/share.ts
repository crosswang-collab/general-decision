// 分享 — 第 10 節：navigator.share 分享 html-to-image 轉出的 PNG；不支援時顯示「長按截圖」。
import { toPng } from 'html-to-image'

export type ShareResult = 'shared' | 'unsupported' | 'failed'

export function canShareFiles(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  )
}

export async function shareNode(node: HTMLElement, filename: string): Promise<ShareResult> {
  if (!canShareFiles()) return 'unsupported'
  try {
    const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true })
    const blob = await (await fetch(dataUrl)).blob()
    const file = new File([blob], filename, { type: 'image/png' })
    if (!navigator.canShare({ files: [file] })) return 'unsupported'
    await navigator.share({ files: [file] })
    return 'shared'
  } catch (e) {
    // 使用者按取消也會走到這裡，不當成錯誤畫面處理。
    if ((e as Error)?.name === 'AbortError') return 'shared'
    return 'failed'
  }
}

export const SHARE_FALLBACK = '這台裝置不支援直接分享。長按上面那張卡截圖。'
