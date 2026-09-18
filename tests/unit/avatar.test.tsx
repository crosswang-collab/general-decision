import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, cleanup } from '@testing-library/react'
import { avatarSvg, Avatar, assetUrl, probeAsset, resetAssetCache, type Mood } from '../../src/avatar.tsx'
import { MemeCard, StepsCard } from '../../src/meme.tsx'
import type { Level } from '../../src/types.ts'

const LEVELS: Level[] = [0, 1, 2]
const MOODS: Mood[] = ['idle', 'bark', 'praise', 'punish']

describe('avatar（第 12 節 S3：3×4 表情不拋錯）', () => {
  it('avatarSvg 對 3 階 × 4 表情都回傳合法 SVG', () => {
    for (const lv of LEVELS) {
      for (const mood of MOODS) {
        const svg = avatarSvg(lv, mood)
        expect(svg.startsWith('<svg'), `${lv}/${mood}`).toBe(true)
        expect(svg.endsWith('</svg>'), `${lv}/${mood}`).toBe(true)
        expect(svg).toContain('viewBox="0 0 120 120"')
        expect(svg).not.toContain('undefined')
        expect(svg).not.toContain('NaN')
      }
    }
  })

  it('<Avatar> 渲染 3×4 共 12 種組合都不拋錯', () => {
    for (const lv of LEVELS) {
      for (const mood of MOODS) {
        const { container } = render(<Avatar level={lv} mood={mood} />)
        expect(container.querySelector('svg'), `${lv}/${mood}`).not.toBeNull()
        cleanup()
      }
    }
  })

  // 下面三條斷言的色值在階段 A 換過：舊色稿的 19 個 hex 沒有一個在 NES 色盤內（DEV-PLAN-2 附錄 A-4），
  // 改的理由是「正確答案變了」，不是為了讓測試變綠。新色值是否合法由 palette-guard.test.ts 獨立把關。
  it('onDark 時不畫米白底（放在梗圖卡上）', () => {
    expect(avatarSvg(1, 'bark', true)).toContain('fill="none"')
    expect(avatarSvg(1, 'bark', false)).toContain('fill="#FCE0A8"')
  })

  it('NES 沒有漸層，底色與制服一律扁平填色', () => {
    for (const lv of LEVELS) {
      expect(avatarSvg(lv, 'idle')).not.toContain('Gradient')
      expect(avatarSvg(lv, 'idle')).not.toContain('url(#')
    }
  })

  it('各階專屬配件：值星帶（lv1）、哨子與白髮線（lv2）、歪帽與冒汗（lv0）', () => {
    expect(avatarSvg(1, 'idle')).toContain('#F83800') // 值星帶
    expect(avatarSvg(2, 'idle')).toContain('#BCBCBC') // 白髮線
    expect(avatarSvg(0, 'idle')).toContain('rotate(-7 60 36)') // 歪帽
    expect(avatarSvg(0, 'idle')).toContain('#3CBCFC') // 冒汗
  })

  it('punish 在梗圖卡上用 currentColor，跟著卡片文字色走（卡底改中性後不能寫死白色）', () => {
    expect(avatarSvg(1, 'punish', true)).toContain('stroke="currentColor"')
    expect(avatarSvg(1, 'punish', false)).not.toContain('currentColor')
  })

  it('第 14 節資產路徑格式正確', () => {
    expect(assetUrl(0, 'idle')).toBe('/officers/0/idle.webp')
    expect(assetUrl(2, 'punish')).toBe('/officers/2/punish.webp')
  })
})

describe('avatar 資產探測快取（DEV-PLAN-2 A-1 ④：換表情不得閃回 SVG）', () => {
  /** 假的 Image：設定 src 後在下一個 microtask 觸發 onload，並記錄每個 url 被請求幾次。 */
  const requested: string[] = []
  class FakeImage {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(url: string) {
      requested.push(url)
      queueMicrotask(() => this.onload?.())
    }
  }
  // 前一個 describe 用真的 jsdom Image 探測過（永遠不會 onload），先清掉那些懸著的 probe。
  beforeEach(() => resetAssetCache())
  afterEach(() => { vi.unstubAllGlobals(); resetAssetCache(); requested.length = 0; cleanup() })

  it('資產載到後換 mood，直接渲染 <img>，中間沒有一幀退回 SVG', async () => {
    vi.stubGlobal('Image', FakeImage)
    const { container, rerender } = render(<Avatar level={1} mood="idle" />)
    expect(container.querySelector('svg')).not.toBeNull() // 第一幀：還沒探測到，先畫 SVG（不閃白）
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/officers/1/idle.webp')

    rerender(<Avatar level={1} mood="bark" />)
    // 換表情的同步那一幀就必須是 <img>，不能先退回 SVG。
    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/officers/1/bark.webp')
  })

  it('掛載時預載同一位班長的四種表情，且同一個 url 只探測一次', async () => {
    vi.stubGlobal('Image', FakeImage)
    render(<Avatar level={2} mood="idle" />)
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    const lv2 = requested.filter((u) => u.startsWith('/officers/2/'))
    expect(new Set(lv2)).toEqual(new Set(['idle', 'bark', 'praise', 'punish'].map((m) => `/officers/2/${m}.webp`)))
    expect(lv2.length).toBe(4)
    await expect(probeAsset('/officers/2/praise.webp')).resolves.toBe(true)
    expect(requested.filter((u) => u === '/officers/2/praise.webp').length).toBe(1)
  })

  it('資產 404 → 留在 SVG，不會出現空 <img>', async () => {
    class FailImage extends FakeImage {
      override set src(url: string) { requested.push(url); queueMicrotask(() => this.onerror?.()) }
    }
    vi.stubGlobal('Image', FailImage)
    const { container } = render(<Avatar level={0} mood="idle" />)
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
  })
})

describe('meme 卡（第 9 節版面規則）', () => {
  it('渲染 top / big / bot 三段文字與角色', () => {
    const { getByTestId, container } = render(
      <MemeCard tag="決斷連" top="去吃熱的" big="阿財魯肉飯" bot="這週兩天超商了" level={1} mood="bark" />,
    )
    expect(getByTestId('meme-top').textContent).toBe('去吃熱的')
    expect(getByTestId('meme-big').textContent).toBe('阿財魯肉飯')
    expect(getByTestId('meme-bot').textContent).toBe('這週兩天超商了')
    expect(container.querySelector('.face svg')).not.toBeNull()
  })

  it('角色在文字之後、同一層 grid，不是絕對定位壓字（v4 的錯）', () => {
    const { getByTestId } = render(
      <MemeCard tag="t" top="a" big="b" bot="c" level={1} mood="bark" />,
    )
    const meme = getByTestId('meme')
    const kids = [...meme.children].map((c) => c.className)
    expect(kids).toEqual(['tag', 'txt', 'face'])
  })

  it('number 取代 big（罰則倒數畫面）', () => {
    const { getByTestId, queryByTestId } = render(
      <MemeCard tone="red" tag="違紀登記" top="罰站" number={10} bot="想清楚" level={1} mood="punish" />,
    )
    expect(getByTestId('meme-num').textContent).toBe('10')
    expect(queryByTestId('meme-big')).toBeNull()
    expect(getByTestId('meme').className).toContain('red')
  })

  it('steps 卡逐條渲染', () => {
    const { getByTestId } = render(<StepsCard steps={['步行 6 分鐘。', '魯肉飯、滷蛋。']} />)
    expect(getByTestId('steps').querySelectorAll('p')).toHaveLength(2)
  })

  it('階段 B：有 mapUrl 時店名是新分頁的 Google Maps 連結', () => {
    const { getByTestId } = render(
      <StepsCard steps={['步行 6 分鐘。']} place={{ name: '阿財魯肉飯', mapUrl: 'https://www.google.com/maps/search/?api=1&query=x&query_place_id=ChIJxxx' }} />,
    )
    const a = getByTestId('place-link') as HTMLAnchorElement
    expect(a.textContent).toBe('阿財魯肉飯')
    expect(a.getAttribute('href')).toContain('query_place_id=ChIJxxx')
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('階段 B：沒有 mapUrl（Places 降級／比不中）→ 不畫任何連結', () => {
    const { queryByTestId, container } = render(<StepsCard steps={['步行 6 分鐘。']} place={{ name: '阿財魯肉飯' }} />)
    expect(queryByTestId('place-link')).toBeNull()
    expect(container.querySelector('a')).toBeNull()
  })
})
