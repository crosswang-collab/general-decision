// Jev 對「候選店」下的判斷題（品味判準的執行面）。伺服器端專用。
// 規則（typesafe-ai skill）：已知規則、算術、精確比對留在程式碼；Jev 只回答程式碼答不了的常識題。
// 每家店一個請求、題目並行；全部失敗 → 回空 Map，發掘引擎照樣用程式碼後備（連鎖字表、類型對照）運作。
import { askJev, noulOf, scoreOf, type JevOptions, type JevQuestion } from './typesafe.ts'

export interface JudgeablePlace {
  id: string
  name: string
  primaryType?: string
  types?: string[]
}

export interface PlaceJudgment {
  /** 0–1：這家店是全國性／跨國連鎖或加盟品牌的機率。 */
  chain?: number
  /** 0–1：以使用者忌口來看，這家店的主力菜色明顯踩雷的機率（沒有忌口時不問）。 */
  dietConflict?: number
  /** 0–3：「值得專程發掘」程度（在地特色、有記憶點），用於發掘排序的加權，不用於過濾。 */
  discovery?: number
}

const DIET_TEXT: Record<string, string> = {
  不辣: '不吃辣',
  不吃牛: '不吃牛肉',
  素: '吃素（不吃肉、海鮮）',
}

/** 依使用者選擇組題。題目 id 只給程式碼看，意思必須完整寫在 instructions。 */
export function placeQuestions(choices: Record<string, string | number>): Record<string, JevQuestion> {
  const q: Record<string, JevQuestion> = {
    chain: {
      type: 'noul',
      instructions: '`place.name` 這家店是全國性或跨國的連鎖／加盟品牌嗎（例如麥當勞、摩斯、星巴克、鼎泰豐、松屋、吉野家、八方雲集這種在很多城市都有分店的品牌）？',
      criteria: {
        true: '店名屬於在多個城市有大量分店的連鎖或加盟品牌',
        false: '個人店、在地小店，或只有少數分店的店',
      },
    },
    discovery: {
      type: 'score',
      instructions: '對一個想在附近「發掘新店」的人來說，`place` 這家店有多值得專程去一次？只看店名與類型透露的特色，不看評分。',
      criteria: [
        '隨處可見的連鎖或便利商店型態，沒有任何特色',
        '普通的店，跟附近同類店差不多',
        '有明確特色或專門品項的店（專賣某一道菜、某種料理、某個產地）',
        '一看就很有記憶點、值得專程去、去過會想跟朋友講的店',
      ],
    },
  }
  const diet = DIET_TEXT[String(choices.diet ?? '')]
  if (diet) {
    q.dietConflict = {
      type: 'noul',
      instructions: `使用者${diet}。從 \`place\` 的店名與類型判斷，這家店的主力菜色是不是明顯不適合他（例如吃素的人遇到牛排館、燒肉店；不吃牛的人遇到牛肉麵店；不吃辣的人遇到麻辣鍋）？`,
      criteria: {
        true: '這家店的招牌或主力就是使用者不能吃的東西',
        false: '這家店有適合使用者的選項，或看不出明顯衝突',
      },
    }
  }
  return q
}

/**
 * 對每家候選店問一次 Jev（並行）。回傳 placeId → 判斷；任何一家失敗就少那一家，不丟錯。
 * 總時間被 timeoutMs 限住（預設 1200ms），超過的當作沒有判斷。
 */
export async function judgePlaces(
  places: JudgeablePlace[],
  choices: Record<string, string | number>,
  opts: JevOptions = {},
): Promise<Map<string, PlaceJudgment>> {
  const out = new Map<string, PlaceJudgment>()
  const key = opts.apiKey ?? (typeof process !== 'undefined' ? process.env.TYPESAFE_API_KEY : undefined)
  if (!key || places.length === 0) return out
  const questions = placeQuestions(choices)
  const results = await Promise.all(
    places.map((p) =>
      askJev(
        { place: { name: p.name, primaryType: p.primaryType ?? null, types: p.types ?? [] } },
        questions,
        { timeoutMs: 1200, ...opts, apiKey: key },
      ),
    ),
  )
  results.forEach((a, i) => {
    if (!a) return
    out.set(places[i]!.id, {
      chain: noulOf(a, 'chain'),
      dietConflict: noulOf(a, 'dietConflict'),
      discovery: scoreOf(a, 'discovery'),
    })
  })
  return out
}
