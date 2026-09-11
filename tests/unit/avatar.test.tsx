import { describe, expect, it } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { avatarSvg, Avatar, assetUrl, type Mood } from '../../src/avatar.tsx'
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

  it('onDark 時不畫米白底（放在梗圖卡上）', () => {
    expect(avatarSvg(1, 'bark', true)).toContain('fill="none"')
    expect(avatarSvg(1, 'bark', false)).toContain('url(#bgG)')
  })

  it('各階專屬配件：值星帶（lv1）、哨子與白髮線（lv2）、歪帽與冒汗（lv0）', () => {
    expect(avatarSvg(1, 'idle')).toContain('#C0392B') // 值星帶
    expect(avatarSvg(2, 'idle')).toContain('#8C8C8C') // 白髮線
    expect(avatarSvg(0, 'idle')).toContain('rotate(-7 60 36)') // 歪帽
    expect(avatarSvg(0, 'idle')).toContain('#5DADE2') // 冒汗
  })

  it('第 14 節資產路徑格式正確', () => {
    expect(assetUrl(0, 'idle')).toBe('/officers/0/idle.webp')
    expect(assetUrl(2, 'punish')).toBe('/officers/2/punish.webp')
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
})
