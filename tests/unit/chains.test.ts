// W4：連鎖字典、分店字尾、同批聚類（DEV-PLAN-3 B11）。純函式，不碰 I/O。
import { describe, expect, it } from 'vitest'
import { BRANDS, brandKeyOf, clusterKeys, isChainKey, stripBranch } from '../../src/chains.ts'

describe('B11：連鎖判定', () => {
  it('「八方雲集 南京店」「八方雲集 復興店」同品牌鍵', () => {
    const a = brandKeyOf('八方雲集 南京店')
    const b = brandKeyOf('八方雲集 復興店')
    expect(a).toBe('bafang')
    expect(b).toBe(a)
    const m = clusterKeys([{ id: 'a', name: '八方雲集 南京店' }, { id: 'b', name: '八方雲集 復興店' }])
    expect(m.get('a')).toBe(m.get('b'))
  })
  it('「すき家 渋谷店」判連鎖；「阿財魯肉飯」不是', () => {
    expect(brandKeyOf('すき家 渋谷店')).toBe('sukiya')
    expect(isChainKey(brandKeyOf('すき家 渋谷店'))).toBe(true)
    expect(brandKeyOf('阿財魯肉飯')).toBeUndefined()
    expect(isChainKey(brandKeyOf('阿財魯肉飯'))).toBe(false)
    expect(clusterKeys([{ id: 'x', name: '阿財魯肉飯' }]).has('x')).toBe(false)
  })
  it('isChainKey：undefined 不是連鎖；任何鍵（字典或 cluster:）都是', () => {
    expect(isChainKey(undefined)).toBe(false)
    expect(isChainKey('mos')).toBe(true)
    expect(isChainKey('cluster:阿財')).toBe(true)
  })
})

describe('brandKeyOf', () => {
  it('中文寫法命中同一個鍵', () => {
    expect(brandKeyOf('摩斯漢堡 信義店')).toBe('mos')
    expect(brandKeyOf('麥當勞')).toBe('mcdonalds')
    expect(brandKeyOf('MOS BURGER 南京店')).toBe('mos')
    expect(brandKeyOf('モスバーガー 新宿店')).toBe('mos')
    expect(brandKeyOf('マクドナルド 渋谷店')).toBe('mcdonalds')
    expect(brandKeyOf('壽司郎 台北南港店')).toBe('sushiro')
    expect(brandKeyOf('スシロー 新宿店')).toBe('sushiro')
  })
  it('英文標點、全形、大小寫、空白不影響', () => {
    expect(brandKeyOf('McDonald\u0027s 渋谷店')).toBe('mcdonalds')
    expect(brandKeyOf('ＫＦＣ 中山店')).toBe('kfc')
    expect(brandKeyOf('Din Tai Fung 信義店')).toBe('dintaifung')
    expect(brandKeyOf('Carl\u2019s Jr. 西門店')).toBe('carlsjr')
  })
  it('以品牌名開頭才算，中間含有不算', () => {
    expect(brandKeyOf('阿財的八方雲集')).toBeUndefined()
    expect(brandKeyOf('')).toBeUndefined()
    expect(brandKeyOf('   ')).toBeUndefined()
  })
  it('便利商店與純飲料店不收（不是餐廳）', () => {
    for (const n of ['7-ELEVEN 信義門市', '統一超商', '全家 FamilyMart', 'ファミリーマート 渋谷店', 'ローソン', 'セブン-イレブン', '50嵐', '清心福全', '大苑子', '麻古茶坊']) {
      expect(brandKeyOf(n), n).toBeUndefined()
    }
  })
  it('「CoCo壹番屋」（咖哩）與「CoCo都可」（手搖）不混', () => {
    expect(brandKeyOf('CoCo壹番屋 西門店')).toBe('coco')
    expect(brandKeyOf('CoCo都可')).toBeUndefined()
  })
})

describe('stripBranch：六種字尾', () => {
  it('① 「 X店」：空白＋地名店', () => {
    expect(stripBranch('八方雲集 南京店')).toBe('八方雲集')
    expect(stripBranch('すき家 渋谷店')).toBe('すき家')
    expect(stripBranch('Starbucks 信義店')).toBe('Starbucks')
  })
  it('② 「X店」：沒空白，直接黏在後面', () => {
    expect(stripBranch('鼎泰豐信義店')).toBe('鼎泰豐')
    expect(stripBranch('八方雲集南京店')).toBe('八方雲集')
  })
  it('③ 「（X）」：括號分店名，全形、半形都處理', () => {
    expect(stripBranch('星巴克（信義）')).toBe('星巴克')
    expect(stripBranch('麥當勞(中山)')).toBe('麥當勞')
    expect(stripBranch('一蘭 （新宿中央東口）')).toBe('一蘭')
  })
  it('④ 「X分店」', () => {
    expect(stripBranch('鼎泰豐 信義分店')).toBe('鼎泰豐')
    expect(stripBranch('鼎泰豐信義分店')).toBe('鼎泰豐')
  })
  it('⑤ 「X門市」', () => {
    expect(stripBranch('星巴克 信義門市')).toBe('星巴克')
    expect(stripBranch('路易莎咖啡南京門市')).toBe('路易莎咖啡')
  })
  it('⑥ 「 X 店」：字尾「店」自己一段', () => {
    expect(stripBranch('八方雲集 南京 店')).toBe('八方雲集')
    expect(stripBranch('八方雲集 店')).toBe('八方雲集')
  })
  it('日文「号店」「號店」、括號與店字尾疊用', () => {
    expect(stripBranch('ココス 渋谷号店')).toBe('ココス')
    expect(stripBranch('ABC 一號店')).toBe('ABC')
    expect(stripBranch('八方雲集 南京店（二店）')).toBe('八方雲集')
  })
  it('英文品牌名的空白不被誤砍：「Pizza Hut 店」只拿掉「店」', () => {
    expect(stripBranch('Pizza Hut 店')).toBe('Pizza Hut')
  })
  it('不是分店字尾的名字原樣不動；剩下不足兩字就不砍', () => {
    expect(stripBranch('阿財魯肉飯')).toBe('阿財魯肉飯')
    expect(stripBranch('Din Tai Fung')).toBe('Din Tai Fung')
    expect(stripBranch('ラーメン二郎')).toBe('ラーメン二郎')
    expect(stripBranch('阿財店')).toBe('阿財店')
    expect(stripBranch('  八方雲集 南京店  ')).toBe('八方雲集')
  })
})

describe('clusterKeys', () => {
  it('字典品牌一律有鍵，即使這一批只有一家（跨天同品牌曝光要能合併）', () => {
    const m = clusterKeys([{ id: 'a', name: '摩斯漢堡 信義店' }, { id: 'b', name: '阿財魯肉飯' }])
    expect(m.get('a')).toBe('mos')
    expect(m.has('b')).toBe(false)
    expect(m.size).toBe(1)
  })
  it('只有 1 家的非字典店不成立（不是連鎖）', () => {
    expect(clusterKeys([{ id: 'a', name: '阿財小館 中山店' }, { id: 'b', name: '老王牛肉麵 南京店' }]).size).toBe(0)
  })
  it('前綴相同 ≥2 家才聚成 cluster:<前綴>；不同前綴不會聚在一起', () => {
    const m = clusterKeys([
      { id: 'a', name: '阿財小館 中山店' },
      { id: 'b', name: '阿財小館 南京店' },
      { id: 'c', name: '阿財小館（信義）' },
      { id: 'd', name: '老王牛肉麵 中山店' },
      { id: 'e', name: '老王牛肉麵 南京店' },
      { id: 'f', name: '獨立小店' },
    ])
    expect(m.get('a')).toBe('cluster:阿財小館')
    expect(m.get('b')).toBe('cluster:阿財小館')
    expect(m.get('c')).toBe('cluster:阿財小館')
    expect(m.get('d')).toBe('cluster:老王牛肉麵')
    expect(m.get('d')).toBe(m.get('e'))
    expect(m.has('f')).toBe(false)
  })
  it('字典品牌與非字典混在同一批：各走各的；空陣列與過短名字不聚', () => {
    const m = clusterKeys([
      { id: '1', name: '八方雲集 南京店' }, { id: '2', name: '八方雲集 復興店' },
      { id: '3', name: 'Bob 小館 A店' }, { id: '4', name: 'Bob 小館 B店' }, { id: '5', name: '獨立小店' },
    ])
    expect(m.get('1')).toBe('bafang')
    expect(m.get('2')).toBe('bafang')
    expect(m.get('3')).toBe(m.get('4'))
    expect(m.get('3')).toMatch(/^cluster:/)
    expect(m.has('5')).toBe(false)
    expect(clusterKeys([]).size).toBe(0)
    expect(clusterKeys([{ id: 'a', name: '麵' }, { id: 'b', name: '麵' }]).size).toBe(0)
  })
})

describe('BRANDS 字典品質', () => {
  const norm = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[\s\u0027\u2019・·.\-]/g, '')
  it('台灣 ≥ 50、日本 ≥ 50（country 為該國或 both）', () => {
    expect(BRANDS.filter((b) => b.country === 'TW' || b.country === 'both').length).toBeGreaterThanOrEqual(50)
    expect(BRANDS.filter((b) => b.country === 'JP' || b.country === 'both').length).toBeGreaterThanOrEqual(50)
  })
  it('key 不重複、每個品牌至少一個名字、country 合法', () => {
    expect(new Set(BRANDS.map((b) => b.key)).size).toBe(BRANDS.length)
    for (const b of BRANDS) {
      expect(b.names.length, b.key).toBeGreaterThan(0)
      expect(['TW', 'JP', 'both'], b.key).toContain(b.country)
    }
  })
  it('不同品牌之間，正規化後的名字不重複（否則誰先誰贏是偶然）', () => {
    const seen = new Map<string, string>()
    for (const b of BRANDS) for (const n of b.names) {
      const k = norm(n)
      const prev = seen.get(k)
      expect(prev === undefined || prev === b.key, `${n} 同時屬於 ${prev} 與 ${b.key}`).toBe(true)
      seen.set(k, b.key)
    }
  })
  it('每個品牌的每個名字都能反查回自己的鍵（含「名字 + 分店」）', () => {
    for (const b of BRANDS) for (const n of b.names) {
      if (norm(n).length < 2) continue
      expect(brandKeyOf(n), `${b.key}:${n}`).toBe(b.key)
      expect(brandKeyOf(`${n} 信義店`), `${b.key}:${n} 信義店`).toBe(b.key)
    }
  })
})
