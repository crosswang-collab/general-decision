// 單頁狀態機 home→intake→cmd→(log|stand)；diary；weekly（第 4 節）。
import { useCallback, useEffect, useRef, useState } from 'react'
import { CARD_BY_ID, MAJOR_IDS, MINOR_IDS, MODULE_BARKS } from './cards.ts'
import { OFFICER_BY_LEVEL } from './officers.ts'
import { Avatar } from './avatar.tsx'
import { MemeCard, StepsCard } from './meme.tsx'
import { ApiError, ERROR_TEXT, GEO_DENIED_LINE, getLocation, requestOrder, underPlacesCap } from './api.ts'
import {
  allEntries, dayLabel, groupByDay, makeEntry, putEntry, recentOrders, stats, timeLabel,
} from './diary.ts'
import type { DiaryEntry, Level, ModuleCard, ModuleId, Order } from './types.ts'

type Screen = 'home' | 'intake' | 'waiting' | 'cmd' | 'log' | 'stand' | 'error' | 'diary' | 'weekly'

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
  const [geoDenied, setGeoDenied] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const excluded = useRef<string[]>([])
  /** 這一道口令的時間戳，換口令時沿用，讓日記只留一筆（第 10 節）。 */
  const issuedAt = useRef<string>('')

  useEffect(() => { void allEntries().then(setEntries) }, [])

  const record = useCallback(async (outcome: DiaryEntry['outcome'], o: Order | null, c: ModuleCard | null) => {
    if (!o || !c || !issuedAt.current) return
    const list = await putEntry(
      makeEntry(issuedAt.current, c.id, level, o.meme.big, outcome, o.place?.name),
    )
    setEntries([...list].sort((a, b) => b.ts.localeCompare(a.ts)))
  }, [level])

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
    setGeoDenied(false)
    setError(null)
    excluded.current = []
    issuedAt.current = ''
    setScreen('intake')
  }, [])

  const fetchOrder = useCallback(async (c: ModuleCard, ch: Record<string, string | number>) => {
    setScreen('waiting')
    setError(null)

    // 第 8 節：需要 Places 且今天還沒超過上限，才去要定位。
    let loc: { lat: number; lng: number } | undefined
    if (c.needsPlaces && underPlacesCap()) {
      const geo = await getLocation()
      loc = geo.loc
      setGeoDenied(geo.denied)
    } else {
      setGeoDenied(false)
    }

    try {
      const o = await requestOrder({
        module: c.id,
        level,
        choices: ch,
        loc,
        now: new Date().toISOString(),
        exclude: excluded.current.length ? [...excluded.current] : undefined,
        recentOrders: recentOrders(entries),
      })
      if (!issuedAt.current) issuedAt.current = new Date().toISOString()
      setOrder(o)
      setScreen('cmd')
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError('upstream', ERROR_TEXT.upstream.line))
      setScreen('error')
    }
  }, [level, entries])

  const submit = useCallback(() => { if (card) void fetchOrder(card, choices) }, [card, choices, fetchOrder])

  const reissue = useCallback(() => {
    if (!card || reissued) return
    if (order?.place?.id) excluded.current.push(order.place.id)
    setReissued(true) // 第 10 節：一次口令最多換 1 次
    void record('reissued', order, card)
    void fetchOrder(card, choices)
  }, [card, choices, fetchOrder, order, record, reissued])

  const done = useCallback(() => {
    void record('done', order, card)
    setScreen('log')
  }, [card, order, record])

  const skip = useCallback(() => {
    void record('punished', order, card)
    setScreen('stand')
  }, [card, order, record])

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
        {screen === 'waiting' && <Waiting level={level} />}
        {screen === 'error' && error && (
          <ErrorScreen level={level} error={error} onRetry={submit} onHome={goHome} onDiary={() => setScreen('diary')} />
        )}
        {screen === 'cmd' && card && order && (
          <Cmd
            card={card} level={level} order={order} geoDenied={geoDenied}
            canReissue={!reissued && !!card.reissueLabel}
            onDone={done} onReissue={reissue} onSkip={skip}
          />
        )}
        {screen === 'log' && order && <LogScreen level={level} order={order} onHome={goHome} />}
        {screen === 'stand' && <Stand level={level} onDone={goHome} />}
        {screen === 'diary' && (
          <Diary level={level} entries={entries} onBack={goHome} onWeekly={() => setScreen('weekly')} />
        )}
        {screen === 'weekly' && <Placeholder title="莒光園地" onBack={() => setScreen('diary')} />}
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

function Waiting({ level }: { level: Level }) {
  return (
    <section className="screen" data-screen="waiting">
      <OfficerPlate level={level} mood="bark" />
      <div className="waiting">
        <div className="dots" data-testid="waiting">班長在想……</div>
        <div className="hint">一個口令一個動作。等著。</div>
      </div>
    </section>
  )
}

function ErrorScreen({ level, error, onRetry, onHome, onDiary }: {
  level: Level; error: ApiError; onRetry: () => void; onHome: () => void; onDiary: () => void
}) {
  const t = ERROR_TEXT[error.kind]
  return (
    <section className="screen" data-screen="error">
      <button className="back" onClick={onHome}>← 回報告</button>
      <OfficerPlate level={level} mood="bark" />
      <div className="notice" data-testid="error-line">
        {t.line}
        {t.sub && <small>{t.sub}</small>}
      </div>
      <div className="row">
        <button className="btn" data-testid="retry" onClick={onRetry}>再報告一次</button>
        <button className="btn line" onClick={onDiary}>看日記</button>
      </div>
    </section>
  )
}

function Cmd({ card, level, order, canReissue, geoDenied, onDone, onReissue, onSkip }: {
  card: ModuleCard; level: Level; order: Order; canReissue: boolean; geoDenied: boolean
  onDone: () => void; onReissue: () => void; onSkip: () => void
}) {
  return (
    <section className="screen" data-screen="cmd">
      {geoDenied && <div className="notice" data-testid="geo-denied">{GEO_DENIED_LINE}</div>}
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
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const t = setInterval(() => {
      setN((v) => {
        if (v <= 1) { clearInterval(t); done.current(); return 0 }
        return v - 1
      })
    }, p.stepMs)
    return () => clearInterval(t)
  }, [p.stepMs])
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

const OUTCOME_LABEL: Record<DiaryEntry['outcome'], [string, string]> = {
  done: ['完成', 'ok'],
  reissued: ['換口令', 're'],
  punished: ['罰則', 'bad'],
}

function Diary({ level, entries, onBack, onWeekly }: {
  level: Level; entries: DiaryEntry[]; onBack: () => void; onWeekly: () => void
}) {
  const s = stats(entries)
  const days = groupByDay(entries)
  return (
    <section className="screen" data-screen="diary">
      <button className="back" onClick={onBack}>← 回報告</button>
      <div className="officer">
        <Avatar className="av" level={level} mood="idle" />
        <div className="plate">
          <span className="rank">新兵日記</span>
          <div className="name">{entries.length ? dayLabel(entries.at(-1)!.ts) + ' 起' : '還沒有紀錄'}</div>
          <div className="meta">每一道口令自動登記。不用寫，班長替你寫。</div>
        </div>
      </div>
      <div className="stats" data-testid="stats">
        <div className="stat"><b data-testid="stat-orders">{s.orders}</b><span>道口令</span></div>
        <div className="stat"><b data-testid="stat-rate">{s.complianceRate}%</b><span>服從率</span></div>
        <div className="stat"><b data-testid="stat-punish">{s.punishments}</b><span>次罰則</span></div>
      </div>
      <div data-testid="days">
        {days.length === 0 && (
          <p className="empty">還沒有紀錄。去按一顆鍵，班長會替你寫第一筆。</p>
        )}
        {days.map((d) => (
          <div className="day" key={d.label}>
            <h4>{d.label}</h4>
            {d.entries.map((e) => (
              <div className="ent" key={e.id} data-testid="entry">
                <time>{timeLabel(e.ts)}</time>
                <span className="o">{CARD_BY_ID[e.module].title} · {e.placeName ?? e.big}</span>
                <span className={`r ${OUTCOME_LABEL[e.outcome][1]}`}>{OUTCOME_LABEL[e.outcome][0]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="row"><button className="btn" onClick={onWeekly}>看本週莒光園地</button></div>
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
