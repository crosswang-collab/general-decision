// 首次同意畫面（App Store 5.1.2(i)；DEV-PLAN-3 W3）。
// 元件本身不碰 storage：寫入 decide.consent 由呼叫端在 onAccept 裡做（key 與版本見下面兩個常數）。
// 只用既有 .screen / .notice / .btn class，不新增 CSS；要加的樣式寫在 docs/round3/W3-HANDOFF.md。
// 文案規則：台灣用語、班長口吻只放在開頭一句；三項揭露一律白話講清楚，法務看得懂（對象、內容、存哪）。
import type { Level } from './types.ts'

export const CONSENT_KEY = 'decide.consent'
export const CONSENT_VERSION = 'v1'

/** 開頭一句（依班長火力）。只有這一句帶人設，揭露本文不帶。 */
export const CONSENT_LEAD: Record<Level, string> = {
  0: '報、報告！下令之前，先把三件事講清楚。',
  1: '你各位聽好。下令之前，三件事先交代。',
  2: '站好。三件事，聽完才開始。',
}

/** 三項揭露。導出給測試與 Privacy 對照用，改字請連同 privacy.tsx 一起看。 */
export const CONSENT_ITEMS: readonly { label: string; text: string }[] = [
  {
    label: '① 位置 → Google',
    text: '你叫班長查附近的店時，手機的位置會送到 Google 地圖查店。不想給位置也行，手動報個車站或地標就好。',
  },
  {
    label: '② 選擇 → Anthropic',
    text: '你選的忌口、預算這些選項，加上班長記得的店家代碼和時間（沒有店名、沒有位置），會送到決斷連的伺服器，口令由 Anthropic 的 AI 寫。',
  },
  {
    label: '③ 日記與記憶 → 只在你的手機',
    text: '日記、去過哪些店、你的偏好，全部存在這支手機裡。這裡沒有帳號，伺服器也不存你的資料。',
  },
]

export const CONSENT_CLOSING = '按下「是！班長」，代表你同意以上三項。想反悔，清除這個網站的資料就全部歸零。'
export const CONSENT_DECLINE = '不同意？直接關掉就好，班長不勉強。'

export function Consent({ level, onAccept, onPrivacy }: {
  level: Level
  onAccept: () => void
  /** 選配：點「看完整隱私說明」。沒給就不顯示這顆鍵。 */
  onPrivacy?: () => void
}) {
  return (
    <section className="screen" data-screen="consent">
      <div className="notice" data-testid="consent">
        <p>{CONSENT_LEAD[level]}</p>
        {CONSENT_ITEMS.map((it) => (
          <p key={it.label}><b>{it.label}</b>　{it.text}</p>
        ))}
        <small>{CONSENT_CLOSING}</small>
      </div>
      <p className="hint">{CONSENT_DECLINE}</p>
      <div className="row">
        <button className="btn" data-testid="consent-accept" onClick={onAccept}>是！班長</button>
        {onPrivacy && <button className="btn line" data-testid="consent-privacy" onClick={onPrivacy}>看完整隱私說明</button>}
      </div>
    </section>
  )
}
