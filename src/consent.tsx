// 首次同意畫面（App Store 5.1.2(i)；DEV-PLAN-3 W3）。契約空殼：W3 實作。元件本身不碰 storage，寫入由 onAccept 的呼叫端做。
import type { Level } from './types.ts'

export const CONSENT_KEY = 'decide.consent'
export const CONSENT_VERSION = 'v1'

export function Consent({ level, onAccept }: { level: Level; onAccept: () => void }) {
  void level
  return (
    <section className="screen" data-screen="consent">
      <div className="notice" data-testid="consent">位置會送 Google 查店；選擇與記憶摘要會送 Anthropic 寫口令；日記只存在手機。</div>
      <div className="row"><button className="btn" data-testid="consent-accept" onClick={onAccept}>是！班長</button></div>
    </section>
  )
}
