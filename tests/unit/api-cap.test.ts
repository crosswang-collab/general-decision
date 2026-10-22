// @vitest-environment jsdom
// R2-12：geocode 也是一次 Places 呼叫，要計入每日上限。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ERROR_TEXT, placesCallsToday, requestGeocode, underPlacesCap } from '../../src/api.ts'
import { DAILY_PLACES_CAP } from '../../src/places.ts'

function mockFetch(calls: string) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ loc: { lat: 25.0478, lng: 121.517 }, label: '台北車站' }),
    { status: 200, headers: { 'content-type': 'application/json', 'x-places-calls': calls } },
  )))
}

beforeEach(() => { localStorage.clear() })
afterEach(() => { vi.unstubAllGlobals() })

describe('requestGeocode 計入每日上限', () => {
  it('讀 x-places-calls 累加進 decide.placesCalls', async () => {
    mockFetch('1')
    expect(placesCallsToday()).toBe(0)
    await requestGeocode('台北車站')
    expect(placesCallsToday()).toBe(1)
    await requestGeocode('台北車站')
    expect(placesCallsToday()).toBe(2)
  })

  it('累到上限就 underPlacesCap() = false', async () => {
    mockFetch(String(DAILY_PLACES_CAP))
    expect(underPlacesCap()).toBe(true)
    await requestGeocode('台北車站')
    expect(underPlacesCap()).toBe(false)
  })

  it('沒有這個 header 不加', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ loc: { lat: 1, lng: 2 }, label: 'x' }), { status: 200 })))
    await requestGeocode('x')
    expect(placesCallsToday()).toBe(0)
  })
})

describe('over_cap 文案', () => {
  it('今天的偵察額度用完了。明天再報告。', () => {
    expect(ERROR_TEXT.over_cap.line).toBe('今天的偵察額度用完了。明天再報告。')
  })
})
