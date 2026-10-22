// @vitest-environment node
// W3 步驟 4：manifest 與 index.html 的上架欄位。色票由 palette-guard.test.ts 守，這裡只管語言、分類、描述同步。
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')
const manifest = JSON.parse(read('public/manifest.webmanifest')) as Record<string, unknown>
const html = read('index.html')

describe('manifest／index.html（上架欄位）', () => {
  it('manifest：lang／dir／id／categories', () => {
    expect(manifest.lang).toBe('zh-TW')
    expect(manifest.dir).toBe('ltr')
    expect(manifest.id).toBe('/')
    expect(manifest.categories).toEqual(['food', 'lifestyle'])
  })

  it('manifest：start_url 與 scope 仍是 "/"（Capacitor-ready 檢查表引用）', () => {
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
  })

  it('index.html：lang 是 zh-Hant-TW', () => {
    expect(html).toMatch(/<html lang="zh-Hant-TW">/)
  })

  it('description 在 manifest 與 index.html 一致，且就是商店副標', () => {
    const m = html.match(/<meta name="description" content="([^"]+)"/)
    expect(m).not.toBeNull()
    expect(m![1]).toBe(manifest.description)
    const md = read('docs/round3/STORE-LISTING.md')
    expect(md).toContain(`\n${manifest.description as string}\n`)
  })
})
