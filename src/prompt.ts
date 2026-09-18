// 系統提示詞 — DECIDE-DEV-DOC-v1.md 第 7 節，照抄人設與絕對規則。
import { OFFICER_BY_LEVEL, sampleCorpus } from './officers.ts'
import { CARD_BY_ID } from './cards.ts'
import { attendVerdict, buyVerdict, lightsOut } from './rules.ts'
import type { Level, ModuleId, OrderRequest } from './types.ts'

export interface PlaceCandidate {
  id: string
  name: string
  walkMin?: number
  openUntil?: string
  primaryType?: string
}

export const ORDER_SYSTEM_PROMPT = `你是台灣 1990–2000 年代軍教片裡的班長。三種火力，由 level 決定：
level 0「菜鳥班長 阿良」：剛下部隊，兇不起來，會結巴、會冒汗、講「你各位」會軟掉。
level 1「值星班長 黑面」：標準值星班長。短句、命令式、動詞開頭。口頭禪：「你各位啊」「一個口令一個動作」「合理的要求是訓練，不合理的要求是磨練」「軍中沒有還好」。
level 2「士官長 老郭」：毒舌、比喻狠、不留情。「我看過的菜鳥比你吃過的饅頭多」「這不叫拖延，這叫菜」。

【絕對規則】
1. 罵行為，不罵人：只罵猶豫、拖延、菜、屁股重、賴床。禁止外貌、性別、族群、家庭、健康、性相關詞；禁止髒話。
2. 命令本體零毒性：steps 與 place 只放可執行資訊，不放梗、不放罵。毒只放在 meme.top 與 meme.bot。
3. log（登記）不罵、不誇：只描述時間、口令、使用者做了什麼。例：「你去了你不想去的地方，而且準時。」
4. 不解釋、不道歉、不給第二選項。verdict=stop 時，steps 第一條就是替代行為（且只有一個）。
5. 這八張卡全部是小事，一律要給可執行的口令。禁止回「大事不受理」、禁止叫使用者去找連長或任何人、禁止用「這不是班長管的」之類的話推掉。verdict:'stop' 只有在【已判定】明講時才出現（赴、買不買）。
6. 只能推薦 places 陣列裡的店（若有提供）。不得編造店名。places 為空 → 依 promptHint 用類型代替，並在 meme.bot 註明「店家資料暫時拿不到」。
7. 輸出只有 Order JSON，不加任何前後文、不加 markdown fence。
8. 一律用台灣的繁體中文與台灣生活用語。禁止中國用語（質量／視頻／信息／屏幕／默認／用戶／激活／軟件／網絡／出租車／自行車／盒飯／早點／地鐵）。軍事用語只用國軍的（連、排、班、值星、出操、寢室、輔導長），不得使用解放軍編制用語（指導員、政委）。

【Order JSON 形狀】
{"verdict":"do"|"stop","meme":{"top":"≤16字","big":"≤10字","bot":"≤24字"},"steps":["≤22字",...1到3條],"place":{"id":"","name":"","walkMin":0,"openUntil":"HH:MM"}(可省略),"log":"≤30字"}`

export function buildOrderPrompt(req: OrderRequest, places: PlaceCandidate[]): { system: string; user: string } {
  const card = CARD_BY_ID[req.module]
  const officer = OFFICER_BY_LEVEL[req.level]
  const samples = sampleCorpus(req.level, 3)
  const now = new Date(req.now)

  const system = [
    ORDER_SYSTEM_PROMPT,
    '',
    `【本次火力】level ${req.level}：${officer.rank} ${officer.duty} ${officer.name}`,
    `【當次風格樣本】（改寫，不要整句照抄）\n${samples.map((s) => `・${s}`).join('\n')}`,
    '',
    `【模組規則：${card.title}】\n${card.promptHint}`,
    computedFacts(req, now),
  ].filter(Boolean).join('\n')

  const user = [
    `現在時間：${req.now}`,
    req.loc ? `使用者位置：${req.loc.lat},${req.loc.lng}${req.loc.label ? `（${req.loc.label}）` : ''}` : '使用者沒有給定位。依規則 6 降級，不得編造店名與距離。',
    `使用者的選擇：${JSON.stringify(req.choices, null, 0)}`,
    places.length
      ? `候選店家（只能從這裡挑一家，place.id 要照填）：\n${places.map((p, i) => `${i + 1}. id=${p.id} 名稱=${p.name}${p.walkMin ? ` 步行${p.walkMin}分` : ''}${p.openUntil ? ` 營業到${p.openUntil}` : ''}`).join('\n')}`
      : card.needsPlaces ? '候選店家：（空）— 店家資料暫時拿不到，依規則 6 降級。' : '',
    req.recentOrders.length
      ? `近 7 天口令：\n${req.recentOrders.map((r) => `・${r.at} ${r.module} ${r.big}`).join('\n')}`
      : '近 7 天沒有紀錄。',
    '只輸出 Order JSON。',
  ].filter(Boolean).join('\n\n')

  return { system, user }
}

/** 算得出來的事先算好，不讓模型自己推（第 6 節 sleep / attend / buy 硬規則）。 */
function computedFacts(req: OrderRequest, now: Date): string {
  const lines: string[] = []
  if (req.module === 'sleep') {
    const wake = String(req.choices.wake ?? '07:30')
    lines.push(`【已算好】起床 ${wake} → meme.big 必須是「${lightsOut(wake)} 熄燈」，不要自己再算一次。`)
  }
  if (req.module === 'attend') {
    const v = attendVerdict(Number(req.choices.stars ?? 5), String(req.choices.occasion ?? ''))
    lines.push(`【已判定】verdict 必須是 "${v}"。`)
  }
  if (req.module === 'buy') {
    const v = buyVerdict(req.recentOrders, now)
    lines.push(`【已判定】verdict 必須是 "${v}"。`)
  }
  return lines.length ? `\n${lines.join('\n')}` : ''
}

export const WEEKLY_SYSTEM_PROMPT = `${ORDER_SYSTEM_PROMPT}

【本次任務】讀 entries（本週 DiaryEntry[]）。用同一位班長口吻寫 WeeklyReport.body（≤180 字）：
① 數字：口令數、服從率、罰則次數 ② 一個規律（例：只在不用出門的事上偷懶／晚上意志最弱）③ 下週一個對策 ④ verdict 一句（≤14 字）。
只輸出 WeeklyReport JSON：{"weekStart":"","level":0,"stats":{"orders":0,"complianceRate":0,"punishments":0,"weakestModule":null},"body":"","verdict":""}`

export function levelName(level: Level): string {
  const o = OFFICER_BY_LEVEL[level]
  return `${o.rank} ${o.duty} ${o.name}`
}

export function moduleTitle(id: ModuleId): string {
  return CARD_BY_ID[id].title
}
