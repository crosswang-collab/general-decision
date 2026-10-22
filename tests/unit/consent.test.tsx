import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { CONSENT_CLOSING, CONSENT_DECLINE, CONSENT_ITEMS, CONSENT_KEY, CONSENT_LEAD, CONSENT_VERSION, Consent } from '../../src/consent.tsx'
import { PRIVACY_LINKS, PRIVACY_SECTIONS, Privacy } from '../../src/privacy.tsx'
import { CONTACT_EMAIL } from '../../src/report.ts'
import { findBanned } from '../../src/banned.ts'
import { localizeText } from '../../src/locale.ts'
import type { Level } from '../../src/types.ts'

const LEVELS: Level[] = [0, 1, 2]

afterEach(() => cleanup())

describe('<Consent>（5.1.2(i)）', () => {
  it('契約不變：key 與版本', () => {
    expect(CONSENT_KEY).toBe('decide.consent')
    expect(CONSENT_VERSION).toBe('v1')
  })

  it('三個火力都渲染得出來，且保留 data-testid：consent、consent-accept', () => {
    for (const lv of LEVELS) {
      const { getByTestId, container } = render(<Consent level={lv} onAccept={() => {}} />)
      expect(getByTestId('consent').textContent).toContain(CONSENT_LEAD[lv])
      expect(getByTestId('consent-accept').textContent).toBe('是！班長')
      expect(container.querySelector('[data-screen="consent"]')).not.toBeNull()
      cleanup()
    }
  })

  it('點主鍵呼叫 onAccept 一次；元件本身不寫 storage', () => {
    localStorage.clear()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const onAccept = vi.fn()
    const { getByTestId } = render(<Consent level={1} onAccept={onAccept} />)
    fireEvent.click(getByTestId('consent-accept'))
    expect(onAccept).toHaveBeenCalledTimes(1)
    expect(setItem).not.toHaveBeenCalled()
    expect(localStorage.getItem(CONSENT_KEY)).toBeNull()
    setItem.mockRestore()
  })

  it('三項揭露都在畫面上：位置→Google、選擇→Anthropic、日記與記憶→只在手機', () => {
    const { getByTestId } = render(<Consent level={0} onAccept={() => {}} />)
    const text = getByTestId('consent').textContent ?? ''
    expect(CONSENT_ITEMS).toHaveLength(3)
    expect(text).toContain('Google')
    expect(text).toContain('Anthropic')
    expect(text).toContain('手機')
    for (const it of CONSENT_ITEMS) expect(text).toContain(it.text)
  })

  it('記憶摘要明講「沒有店名、沒有位置」', () => {
    expect(CONSENT_ITEMS[1]!.text).toContain('沒有店名')
    expect(CONSENT_ITEMS[1]!.text).toContain('沒有位置')
  })

  it('onPrivacy 有給才出現「看完整隱私說明」，點了會呼叫', () => {
    const a = render(<Consent level={0} onAccept={() => {}} />)
    expect(a.queryByTestId('consent-privacy')).toBeNull()
    cleanup()
    const onPrivacy = vi.fn()
    const b = render(<Consent level={0} onAccept={() => {}} onPrivacy={onPrivacy} />)
    fireEvent.click(b.getByTestId('consent-privacy'))
    expect(onPrivacy).toHaveBeenCalledTimes(1)
  })

  it('不同意的出口有講（關掉即可）', () => {
    expect(CONSENT_DECLINE).toContain('關掉')
    const { container } = render(<Consent level={0} onAccept={() => {}} />)
    expect(container.textContent).toContain(CONSENT_DECLINE)
  })

  it('全部文案：護欄禁詞 0 命中、沒有中國用語', () => {
    const all = [...Object.values(CONSENT_LEAD), ...CONSENT_ITEMS.flatMap((i) => [i.label, i.text]), CONSENT_CLOSING, CONSENT_DECLINE].join('\n')
    expect(findBanned(all)).toEqual([])
    expect(localizeText(all).hits).toEqual([])
  })
})

describe('<Privacy>（5.1.1）', () => {
  it('保留 data-testid="privacy"；點「回報告」呼叫 onBack', () => {
    const onBack = vi.fn()
    const { getByTestId, getByText } = render(<Privacy onBack={onBack} />)
    expect(getByTestId('privacy')).not.toBeNull()
    fireEvent.click(getByText('← 回報告'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('蒐集什麼／送給誰／存哪裡／怎麼刪／聯絡 都有講', () => {
    const titles = PRIVACY_SECTIONS.map((s) => s.title).join('|')
    for (const k of ['拿了什麼', '送給誰', '存在哪裡', '怎麼刪', '聯絡']) expect(titles).toContain(k)
  })

  it('怎麼刪寫了清除網站資料；聯絡用 [CONTACT_EMAIL] 佔位', () => {
    const { container } = render(<Privacy onBack={() => {}} />)
    const text = container.textContent ?? ''
    expect(text).toContain('清除瀏覽記錄與網站資料')
    expect(text).toContain(CONTACT_EMAIL)
    expect(CONTACT_EMAIL).toBe('[CONTACT_EMAIL]')
  })

  it('Google Maps 歸屬（translate=no）與條款連結都在，連結 https 且 noopener', () => {
    const { container } = render(<Privacy onBack={() => {}} />)
    const attr = container.querySelector('small[translate="no"]')
    expect(attr?.textContent).toBe('Google Maps')
    const links = [...container.querySelectorAll('a')]
    expect(links).toHaveLength(PRIVACY_LINKS.length)
    for (const a of links) {
      expect(a.getAttribute('href')).toMatch(/^https:\/\//)
      expect(a.getAttribute('rel')).toContain('noopener')
    }
  })

  it('隱私頁與同意畫面一致：兩邊都提到 Google 與 Anthropic', () => {
    const p = PRIVACY_SECTIONS.flatMap((s) => s.paras).join('\n')
    expect(p).toContain('Google')
    expect(p).toContain('Anthropic')
  })

  it('全文：護欄禁詞 0 命中、沒有中國用語', () => {
    const all = PRIVACY_SECTIONS.flatMap((s) => [s.title, ...s.paras]).join('\n')
    expect(findBanned(all)).toEqual([])
    expect(localizeText(all).hits).toEqual([])
  })
})
