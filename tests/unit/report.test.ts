// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { CONTACT_EMAIL, ISSUES_URL, REPORT_SUBJECT, reportHref, reportIssueUrl, reportMailto } from '../../src/report.ts'
import type { Order } from '../../src/types.ts'

const ORDER: Order = {
  verdict: 'do',
  meme: { top: '今天這家你沒去過', big: '阿財魯肉飯', bot: '別讓我說第二次' },
  steps: ['步行 6 分鐘', '營業到 21:00 & 價位≈NT$150–400'],
  place: {
    id: 'ChIJ_SECRET_PLACE_ID',
    name: '阿財魯肉飯',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=25.0330,121.5654&query_place_id=ChIJ_SECRET_PLACE_ID',
  },
  log: '收到',
}

function parts(url: string) {
  const [head, query = ''] = url.split('?')
  const p = new URLSearchParams(query)
  return { head, subject: p.get('subject') ?? '', body: p.get('body') ?? '' }
}

describe('reportMailto（App Store 1.2 檢舉入口）', () => {
  it('收件人是 [CONTACT_EMAIL] 佔位，協定是 mailto:', () => {
    const { head } = parts(reportMailto(ORDER, 1))
    expect(head).toBe(`mailto:${CONTACT_EMAIL}`)
  })

  it('subject 與 body 都用 encodeURIComponent 編碼：不含原始空白、換行、&、中文字', () => {
    const url = reportMailto(ORDER, 0)
    const query = url.split('?')[1]!
    expect(query).not.toMatch(/[\s\n\r]/)
    expect(query).not.toMatch(/[\u4e00-\u9fff]/)
    // 兩個參數以單一 & 分開：subject 一個、body 一個。body 裡的 & 已被編成 %26。
    expect(query.split('&')).toHaveLength(2)
    expect(query).toContain('%26')
  })

  it('解碼後：subject 固定；body 含 meme 三行與每一條 steps', () => {
    const { subject, body } = parts(reportMailto(ORDER, 1))
    expect(subject).toBe(REPORT_SUBJECT)
    expect(body).toContain('上：今天這家你沒去過')
    expect(body).toContain('中：阿財魯肉飯')
    expect(body).toContain('下：別讓我說第二次')
    expect(body).toContain('步驟1：步行 6 分鐘')
    expect(body).toContain('步驟2：營業到 21:00 & 價位≈NT$150–400')
  })

  it('body 帶是哪一位班長（依 level）', () => {
    expect(parts(reportMailto(ORDER, 0)).body).toContain('阿良')
    expect(parts(reportMailto(ORDER, 1)).body).toContain('黑面')
    expect(parts(reportMailto(ORDER, 2)).body).toContain('老郭')
  })

  it('不含座標、place.id、mapUrl（隱私）', () => {
    const url = reportMailto(ORDER, 1)
    const { body } = parts(url)
    for (const s of [url, body]) {
      expect(s).not.toContain('ChIJ')
      expect(s).not.toContain('25.0330')
      expect(s).not.toContain('121.5654')
      expect(s).not.toContain('google.com/maps')
    }
  })

  it('沒有 steps 或 place 也不拋錯', () => {
    const bare: Order = { verdict: 'stop', meme: { top: 'a', big: 'b', bot: 'c' }, steps: [], log: '' }
    expect(() => reportMailto(bare, 2)).not.toThrow()
    expect(parts(reportMailto(bare, 2)).body).toContain('上：a')
  })

  it('純函式：同樣輸入同樣輸出，且不修改傳入的 order', () => {
    const before = JSON.stringify(ORDER)
    expect(reportMailto(ORDER, 1)).toBe(reportMailto(ORDER, 1))
    expect(JSON.stringify(ORDER)).toBe(before)
  })
})

describe('reportHref（R2-07：信箱佔位時改走 GitHub issue）', () => {
  it('信箱仍是 [CONTACT_EMAIL] 佔位 → GitHub 新 issue 連結，不是 mailto', () => {
    expect(CONTACT_EMAIL).toBe('[CONTACT_EMAIL]')
    const href = reportHref(ORDER, 1)
    expect(href.startsWith(`${ISSUES_URL}/new?`)).toBe(true)
    expect(href).toBe(reportIssueUrl(ORDER, 1))
    expect(href).not.toMatch(/^mailto:/)
  })

  it('title 與 body 以 encodeURIComponent 編碼；body 含 meme 三行、steps、火力，不含座標／place.id／mapUrl', () => {
    const href = reportHref(ORDER, 0)
    const query = href.split('?')[1]!
    expect(query).not.toMatch(/[\s\u4e00-\u9fff]/)
    const p = new URLSearchParams(query)
    expect(p.get('title')).toBe(REPORT_SUBJECT)
    const body = p.get('body')!
    for (const s of ['上：今天這家你沒去過', '中：阿財魯肉飯', '下：別讓我說第二次', '步驟1：步行 6 分鐘', '步驟2：營業到 21:00 & 價位≈NT$150–400', '阿良']) {
      expect(body).toContain(s)
    }
    for (const s of [href, body]) {
      expect(s).not.toContain('ChIJ')
      expect(s).not.toContain('25.0330')
      expect(s).not.toContain('121.5654')
      expect(s).not.toContain('google.com/maps')
    }
  })

  it('填了真信箱才用 mailto', () => {
    const href = reportHref(ORDER, 1, 'help@example.com')
    expect(href.startsWith('mailto:help@example.com?')).toBe(true)
  })
})
