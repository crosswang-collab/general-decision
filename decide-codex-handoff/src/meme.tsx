// 梗圖卡 — 第 9 節：兩欄 grid（1fr 38%），左欄文字、右欄角色，角色不得壓字。
import type { ReactNode } from 'react'
import { Avatar, type Mood } from './avatar.tsx'
import type { Level } from './types.ts'

export type MemeTone = 'olive' | 'red' | 'ok'

export interface MemeCardProps {
  tone?: MemeTone
  tag: string
  top: string
  /** 主字。與 number 二選一。 */
  big?: string
  /** 倒數數字（罰則畫面）。給了就取代 big。 */
  number?: number
  total?: number
  bot: string
  level: Level
  mood: Mood
  /** 週報用：單欄、自動高度。 */
  wide?: boolean
  children?: ReactNode
}

export function MemeCard({
  tone = 'olive', tag, top, big, number, total, bot, level, mood, wide = false, children,
}: MemeCardProps) {
  return (
    <div className={`meme ${tone}${wide ? ' wide' : ''}${number !== undefined ? ' counting' : ''}${number === 0 ? ' released' : ''}`} data-testid="meme" data-mood={mood}>
      <span className="tag">{tag}</span>
      <div className="txt">
        <div className="cap top" data-testid="meme-top">{top}</div>
        {number === undefined
          ? (big ? <div className="cap big" data-testid="meme-big">{big}</div> : null)
          : <div key={number} className="num" data-testid="meme-num" role="timer" aria-label={`剩餘 ${number}`}>{number}</div>}
        {children}
        <div className="cap bot" data-testid="meme-bot">{bot}</div>
      </div>
      <Avatar className="face" level={level} mood={mood} onDark />
      {number !== undefined && total !== undefined && (
        <div className="count-track" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => <i key={i} className={i < number ? 'active' : ''} />)}
        </div>
      )}
    </div>
  )
}

/** 步驟卡 — 第 9 節：梗圖卡下方白卡，▸ 前綴，無梗。 */
export function StepsCard({ steps }: { steps: string[] }) {
  return (
    <div className="steps" data-testid="steps">
      {steps.map((s, i) => <p key={i}>{s}</p>)}
    </div>
  )
}
