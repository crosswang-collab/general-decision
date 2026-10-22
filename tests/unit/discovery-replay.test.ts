// @vitest-environment node
// S6 離線重播（DEV-PLAN-3 A.3、附錄 1）：合成候選池（不用任何 Google 真實資料，R4）× 三種方針 × 200 種子 × 14 天 × 2 餐。
// console 印 JSON 報表，每項門檻都要 pass:true。門檻不准改；達不到只准在 R3§2.4 範圍內調 src/discovery.ts PARAMS。
import { describe, expect, it, vi } from 'vitest'
import { metrics, SEEDS } from './replay-sim.ts'

describe('S6 離線重播（DEV-PLAN-3 A.3）', () => {
  it('三方針 × 200 種子：全部門檻 pass', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {}) // 放寬的 warn 在重播裡很吵，報表才是重點
    const m = { familiar: metrics('familiar'), balanced: metrics('balanced'), recon: metrics('recon') }
    const gate = (value: number, pass: boolean, rule: string) => ({ value, rule, pass })
    const report = {
      seeds: SEEDS,
      days: 14,
      mealsPerDay: 2,
      balanced: {
        repeat7d: gate(m.balanced.repeat7d, m.balanced.repeat7d < 0.15, '< 0.15'),
        distinct12: gate(m.balanced.distinct12, m.balanced.distinct12 >= 9, '≥ 9'),
        top3Share: gate(m.balanced.top3Share, m.balanced.top3Share < 0.5, '< 0.50'),
        // Team Lead 裁定（2026-10-22）：原門檻「相對池子前 8 名降幅 ≤0.15」與 repeat7d<0.15 數學上互斥——
        // 14 天 28 餐、7 天重複率 <15% 至少要 ~20 家不同的店，而「挑最好的 20 家」這個上帝視角解的降幅就已經是 0.175。
        // 改用 oracleGap（同樣家數下與最佳解的差距）當擋門檻；bayesDrop 照印，只作紀錄。
        oracleGap: gate(m.balanced.oracleGap, m.balanced.oracleGap <= 0.08, '≤ 0.08（vs 同家數最佳解）'),
        bayesDropInfo: gate(m.balanced.bayesDrop, true, '紀錄用（原 ≤0.15 不可行，見上）'),
        chainShare: gate(m.balanced.chainShare, m.balanced.chainShare <= 0.7, '≤ 0.70'),
        belowFloor: gate(m.balanced.belowFloor, m.balanced.belowFloor === 0, '= 0'),
        budgetHit: gate(m.balanced.budgetHit, m.balanced.budgetHit >= 0.95, '≥ 0.95'),
        dislikedHit: gate(m.balanced.dislikedHit, m.balanced.dislikedHit === 0, '= 0'),
      },
      recon: {
        repeat7d: gate(m.recon.repeat7d, m.recon.repeat7d < 0.15, '< 0.15'),
        distinct12: gate(m.recon.distinct12, m.recon.distinct12 >= 9, '≥ 9'),
        top3Share: gate(m.recon.top3Share, m.recon.top3Share < 0.5, '< 0.50'),
        chainWhenFresh: gate(m.recon.reconChainWhenFresh, m.recon.reconChainWhenFresh === 0, '非連鎖 ≥3 家時 = 0'),
        belowFloor: gate(m.recon.belowFloor, m.recon.belowFloor === 0, '= 0'),
        budgetHit: gate(m.recon.budgetHit, m.recon.budgetHit >= 0.95, '≥ 0.95'),
        dislikedHit: gate(m.recon.dislikedHit, m.recon.dislikedHit === 0, '= 0'),
      },
      familiar: {
        familiarRevisit: gate(m.familiar.familiarRevisit, m.familiar.familiarRevisit >= 0.35 && m.familiar.familiarRevisit <= 0.65, '0.35–0.65'),
        top3Share: gate(m.familiar.top3Share, m.familiar.top3Share < 0.5, '< 0.50'),
        belowFloor: gate(m.familiar.belowFloor, m.familiar.belowFloor === 0, '= 0'),
        budgetHit: gate(m.familiar.budgetHit, m.familiar.budgetHit >= 0.95, '≥ 0.95'),
        dislikedHit: gate(m.familiar.dislikedHit, m.familiar.dislikedHit === 0, '= 0'),
      },
      raw: m,
    }
    console.log(JSON.stringify(report, null, 2))
    const failed = (['balanced', 'recon', 'familiar'] as const).flatMap((k) =>
      Object.entries(report[k]).filter(([, g]) => !g.pass).map(([name]) => `${k}.${name}`))
    expect(failed).toEqual([])
  }, 120_000)
})
