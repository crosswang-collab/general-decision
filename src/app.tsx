// 單頁狀態機 home→intake→cmd→(log|stand)；diary；weekly（第 4 節）。
import { useCallback, useEffect, useState } from 'react'
import { CARD_BY_ID, CARDS, MAJOR_IDS, MINOR_IDS, MODULE_BARKS } from './cards.ts'
import { OFFICER_BY_LEVEL } from './officers.ts'
import { Avatar } from './avatar.tsx'
import { MemeCard, StepsCard } from './meme.tsx'
import { MOCK_ORDERS, MOCK_REISSUE } from './mockOrders.ts'
import type { Level, ModuleCard, ModuleId, Order } from './types.ts'

type Screen = 'home' | 'intake' | 'cmd' | 'log' | 'stand' | 'diary' | 'weekly'

const LEVEL_KEY = 'decide.level'

function loadLevel(): Level {
  try {
    const raw = localStorage.getItem(LEVEL_KEY)
    // 注意：Number(null) === 0，不能直接轉，否則新使用者會拿到 level 0。
    if (raw !== null) {
      const v = Number(raw)
      if (v === 0 || v === 1 || v === 2) return v
    }
  } catch { /* 無痕模式或被擋，用預設 */ }
  return 1 // 第 2 節：預設中檔
}

export function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [level, setLevel] = useState<Level>(loadLevel)
  const [card, setCard] = useState<ModuleCard | null>(null)
  const [choices, setChoices] = useState<Record<string, string | number>>({})
  const [order, setOrder] = useState<Order | null>(null)
  const [reissued, setReissued] = useState(false)


  useEffect(() => {
    try { localStorage.setItem(LEVEL_KEY, String(level)) } catch { /* 忽略 */ }
  }, [level])

  const cycleOfficer = useCallback(() => setLevel((l) => ((l + 1) % 3) as Level), [])

  const openIntake = useCallback((id: ModuleId) => {
    const c = CARD_BY_ID[id]
    setCard(c)
    setChoices(Object.fromEntries(c.intake.map((f) => [f.key, f.default])))
    setOrder(null)
    setReissued(false)
    setScreen('intake')
  }, [])

  const submit = useCallback(() => {
    if (!card) return
    setOrder(MOCK_ORDERS[card.id])
    setScreen('cmd')
  }, [card])

  const reissue = useCallback(() => {
    if (!card) return
    setOrder(MOCK_REISSUE[card.id] ?? MOCK_ORDERS[card.id])
    setReissued(true)
  }, [card])

  const goHome = useCallback(() => setScreen('home'), [])

  return (
    <>
      <main>
        {screen === 'home' && (
          <Home level={level} onCycle={cycleOfficer} onPick={openIntake} onDiary={() => setScreen('diary')} />
        )}
        {screen === 'intake' && card && (
          <Intake
            card={card} level={level} choices={choices}
            onChange={(k, v) => setChoices((c) => ({ ...c, [k]: v }))}
            onBack={goHome} onSubmit={submit}
          />
        )}
        {screen === 'cmd' && card && order && (
          <Cmd
            card={card} level={level} order={order} canReissue={!reissued && !!card.reissueLabel}
            onDone={() => setScreen('log')} onReissue={reissue} onSkip={() => setScreen('stand')}
          />
        )}
        {screen === 'log' && order && <LogScreen level={level} order={order} onHome={goHome} />}
        {screen === 'stand' && <Stand level={level} onDone={goHome} />}
        {screen === 'diary' && <Placeholder title="新兵日記" onBack={goHome} />}
        {screen === 'weekly' && <Placeholder title="莒光園地" onBack={goHome} />}
      </main>
      <footer>
        <span>班長有什麼了不起？— 你小學當的那個不算。</span>
      </footer>
    </>
  )
}

function OfficerPlate({ level, mood, onCycle, meta, tap }: {
  level: Level; mood: 'idle' | 'bark'; onCycle?: () => void; meta?: string; tap?: boolean
}) {
  const o = OFFICER_BY_LEVEL[level]
  return (
    <div className="officer">
      <Avatar
        className="av" level={level} mood={mood} onClick={onCycle}
        title={onCycle ? '點頭像換班長' : undefined}
      />
      <div className="plate">
        <span className="rank">{o.rank}</span>
        <div className="name" data-testid="officer-name">{o.name}</div>
        {meta && <div className="meta">{meta}</div>}
        {tap && <div className="tap">點頭像換班長</div>}
      </div>
    </div>
  )
}

function Home({ level, onCycle, onPick, onDiary }: {
  level: Level; onCycle: () => void; onPick: (id: ModuleId) => void; onDiary: () => void
}) {
  const o = OFFICER_BY_LEVEL[level]
  return (
    <section className="screen" data-screen="home">
      <div className="topnav"><button onClick={onDiary}>新兵日記</button></div>
      <OfficerPlate level={level} mood="idle" onCycle={onCycle} meta="決斷連 · 大事不受理" tap />
      <div className="bubble" data-testid="bubble">
        {o.hello}
        {o.helloSub && <small>{o.helloSub}</small>}
      </div>
      <div className="grid">
        {MAJOR_IDS.map((id) => {
          const c = CARD_BY_ID[id]
          return (
            <button key={id} className="tile" data-card={id} onClick={() => onPick(id)}>
              <b>{c.title}</b><span>{c.subtitle}</span>
            </button>
          )
        })}
      </div>
      <div className="minor">
        {MINOR_IDS.map((id) => (
          <button key={id} data-card={id} onClick={() => onPick(id)}>{CARD_BY_ID[id].title}</button>
        ))}
      </div>
      <p className="hint">大事不受理。班長只管小事，大事你自己去找連長。</p>
    </section>
  )
}

function Intake({ card, level, choices, onChange, onBack, onSubmit }: {
  card: ModuleCard; level: Level; choices: Record<string, string | number>
  onChange: (k: string, v: string | number) => void; onBack: () => void; onSubmit: () => void
}) {
  return (
    <section className="screen" data-screen="intake">
      <button className="back" onClick={onBack}>← 回報告</button>
      <OfficerPlate level={level} mood="bark" />
      <div className="bubble" data-testid="bubble">{MODULE_BARKS[card.id][level]}</div>
      <div>
        {card.intake.map((f) => (
          <div key={f.key}>
            <p className="lab">{f.label}</p>
            {f.type === 'stars' ? (
              <div className="stars" data-field={f.key}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n} className={n <= Number(choices[f.key] ?? f.default) ? 'lit' : ''}
                    aria-label={`${n} 星`} onClick={() => onChange(f.key, n)}
                  >★</button>
                ))}
              </div>
            ) : (
              <div className="chips" data-field={f.key}>
                {(f.options ?? []).map((o) => (
                  <button
                    key={o} className="chip" aria-pressed={choices[f.key] === o}
                    onClick={() => onChange(f.key, o)}
                  >{o}</button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="row"><button className="btn" onClick={onSubmit}>是！班長</button></div>
    </section>
  )
}

function Cmd({ card, level, order, canReissue, onDone, onReissue, onSkip }: {
  card: ModuleCard; level: Level; order: Order; canReissue: boolean
  onDone: () => void; onReissue: () => void; onSkip: () => void
}) {
  return (
    <section className="screen" data-screen="cmd">
      <MemeCard
        tone={order.verdict === 'stop' ? 'red' : 'olive'}
        tag="決斷連 · 一個口令一個動作"
        top={order.meme.top} big={order.meme.big} bot={order.meme.bot}
        level={level} mood="bark"
      />
      <StepsCard steps={order.steps} />
      <div className="row">
        <button className="btn" onClick={onDone}>報告班長，完成</button>
        {canReissue && <button className="btn line" data-testid="reissue" onClick={onReissue}>{card.reissueLabel}</button>}
        <button className="btn ghost" onClick={onSkip}>沒做</button>
      </div>
    </section>
  )
}

function LogScreen({ level, order, onHome }: { level: Level; order: Order; onHome: () => void }) {
  return (
    <section className="screen" data-screen="log">
      <MemeCard
        tone="ok" tag="莒光日 · 榮譽榜" top="登記" big={order.log} bot="雄壯！威武！"
        level={level} mood="praise"
      />
      <div className="row">
        <button className="btn" onClick={onHome}>解散</button>
      </div>
    </section>
  )
}

function Stand({ level, onDone }: { level: Level; onDone: () => void }) {
  const p = OFFICER_BY_LEVEL[level].punishment
  const [n, setN] = useState(p.count)
  useEffect(() => {
    const t = setInterval(() => {
      setN((v) => {
        if (v <= 1) { clearInterval(t); onDone(); return 0 }
        return v - 1
      })
    }, p.stepMs)
    return () => clearInterval(t)
  }, [p.stepMs, onDone])
  return (
    <section className="screen" data-screen="stand">
      <MemeCard
        tone="red" tag="決斷連 · 違紀登記"
        top={`${p.action}，${p.countLabel}！數給我聽！`} number={n} bot={p.line}
        level={level} mood="punish"
      />
    </section>
  )
}

function Placeholder({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <section className="screen" data-screen="placeholder">
      <button className="back" onClick={onBack}>← 回報告</button>
      <div className="bubble">{title}</div>
    </section>
  )
}

export const ALL_CARD_IDS = CARDS.map((c) => c.id)
