// 連鎖判定（DEV-PLAN-3 A5）。字典是我方資料，不是 Google 內容。純函式，無 I/O。
// 用途：發掘時連鎖降權、「全面偵察」排除連鎖、同品牌不同分店的曝光合併計算（今天摩斯 A 店，明天就不派摩斯 B 店）。
import type { Country } from './types.ts'

export interface Brand { key: string; names: string[]; country: Country | 'both' }

/**
 * 連鎖字典（我方資料，不含任何 Google 回傳的評分／座標）。台灣 ≥50、日本 ≥50（country 為該國或 'both' 都算）。
 * 收錄原則：真實存在的餐飲連鎖（速食、咖啡館、定食、拉麵、火鍋、燒肉、壽司、居酒屋、家庭餐廳、早餐店）；
 * 便利商店與純飲料手搖店不收（不是餐廳）；沒把握是否真實存在的不收。
 * names 放中／日／英常見寫法；比對時正規化（NFKC、轉小寫、去空白與標點），所以「MOS BURGER」「Mos Burger」是同一個。
 * 刻意不收太短、太通用的簡稱（例如「マック」會誤中「マックスバリュ」超市），比對是「以品牌名開頭」，名字越短誤判越多。
 */
export const BRANDS: Brand[] = [
  // ── 台日都有（速食、咖啡、定食、壽司、拉麵、燒肉）──
  { key: 'mcdonalds', names: ['麥當勞', "McDonald's", 'McDonalds', 'マクドナルド'], country: 'both' },
  { key: 'mos', names: ['摩斯漢堡', 'MOS BURGER', 'モスバーガー'], country: 'both' },
  { key: 'kfc', names: ['肯德基', 'KFC', 'ケンタッキー'], country: 'both' },
  { key: 'burgerking', names: ['漢堡王', 'Burger King', 'バーガーキング'], country: 'both' },
  { key: 'subway', names: ['賽百味', 'SUBWAY', 'サブウェイ'], country: 'both' },
  { key: 'dominos', names: ['達美樂', "Domino's Pizza", "Domino's", 'ドミノ・ピザ', 'ドミノピザ'], country: 'both' },
  { key: 'pizzahut', names: ['必勝客', 'Pizza Hut', 'ピザハット'], country: 'both' },
  { key: 'starbucks', names: ['星巴克', 'Starbucks', 'スターバックス', 'スタバ'], country: 'both' },
  { key: 'dintaifung', names: ['鼎泰豐', 'Din Tai Fung', '鼎泰豊'], country: 'both' },
  { key: 'yoshinoya', names: ['吉野家', 'Yoshinoya'], country: 'both' },
  { key: 'sukiya', names: ['すき家', 'Sukiya', 'SUKIYA', '食其家'], country: 'both' },
  { key: 'ichiran', names: ['一蘭', 'ICHIRAN'], country: 'both' },
  { key: 'ippudo', names: ['一風堂', 'IPPUDO'], country: 'both' },
  { key: 'santouka', names: ['山頭火', 'らーめん山頭火', 'Santouka'], country: 'both' },
  { key: 'musashi', names: ['麵屋武藏', '麺屋武蔵', '麵屋武蔵', 'Menya Musashi'], country: 'both' },
  { key: 'saizeriya', names: ['薩莉亞', 'サイゼリヤ', 'Saizeriya'], country: 'both' },
  { key: 'sushiro', names: ['壽司郎', '寿司郎', 'スシロー', 'Sushiro'], country: 'both' },
  { key: 'kura', names: ['藏壽司', 'くら寿司', 'Kura Sushi'], country: 'both' },
  { key: 'ootoya', names: ['大戶屋', '大戸屋', 'Ootoya'], country: 'both' },
  { key: 'wako', names: ['和幸', 'とんかつ和幸'], country: 'both' },
  { key: 'coco', names: ['CoCo壹番屋', 'CoCo壱番屋', 'カレーハウスCoCo壱番屋', 'ココイチ'], country: 'both' },
  { key: 'osakaohsho', names: ['大阪王將', '大阪王将', 'Osaka Ohsho'], country: 'both' },
  { key: 'wenyecai', names: ['溫野菜', '温野菜', 'しゃぶしゃぶ温野菜'], country: 'both' },
  { key: 'gyukaku', names: ['牛角', 'Gyu-Kaku', 'Gyukaku'], country: 'both' },
  { key: 'torikizoku', names: ['鳥貴族', 'Torikizoku'], country: 'both' },
  { key: 'marugame', names: ['丸龜製麵', '丸亀製麺', '丸亀製麵', 'Marugame Seimen'], country: 'both' },
  { key: 'haidilao', names: ['海底撈', '海底捞', 'Haidilao'], country: 'both' },

  // ── 台灣 ──
  { key: 'bafang', names: ['八方雲集'], country: 'TW' },
  { key: 'louisa', names: ['路易莎', 'Louisa Coffee'], country: 'TW' },
  { key: 'dingguagua', names: ['頂呱呱'], country: 'TW' },
  { key: 'carlsjr', names: ['卡樂星', "Carl's Jr."], country: 'TW' },
  { key: 'qburger', names: ['Q Burger'], country: 'TW' },
  { key: 'napoli', names: ['拿坡里披薩', '拿坡里Pizza'], country: 'TW' },
  { key: 'wowprime', names: ['王品牛排', '王品'], country: 'TW' },
  { key: 'tasty', names: ['西堤牛排', '西堤'], country: 'TW' },
  { key: 'tokiya', names: ['陶板屋'], country: 'TW' },
  { key: 'chamonix', names: ['夏慕尼'], country: 'TW' },
  { key: 'ju', names: ['聚北海道昆布鍋'], country: 'TW' },
  { key: 'shiergo', names: ['石二鍋'], country: 'TW' },
  { key: 'pintian', names: ['品田牧場'], country: 'TW' },
  { key: 'yuanshao', names: ['原燒'], country: 'TW' },
  { key: 'apricot', names: ['杏子日式豬排'], country: 'TW' },
  { key: 'katsubo', names: ['勝博殿'], country: 'TW' },
  { key: 'fukusuitei', names: ['福勝亭'], country: 'TW' },
  { key: 'hushuzhang', names: ['鬍鬚張'], country: 'TW' },
  { key: 'sanshang', names: ['三商巧福'], country: 'TW' },
  { key: 'zhengxian', names: ['爭鮮'], country: 'TW' },
  { key: 'wulao', names: ['無老鍋'], country: 'TW' },
  { key: 'mala', names: ['馬辣'], country: 'TW' },
  { key: 'dingwang', names: ['鼎王麻辣鍋', '鼎王'], country: 'TW' },
  { key: 'qinghuajiao', names: ['青花驕'], country: 'TW' },
  { key: 'zhujian', names: ['築間幸福鍋物', '築間'], country: 'TW' },
  { key: 'xiaomengniu', names: ['小蒙牛'], country: 'TW' },
  { key: 'roduoduo', names: ['肉多多火鍋', '肉多多'], country: 'TW' },
  { key: 'sanmama', names: ['三媽臭臭鍋'], country: 'TW' },
  { key: 'zheyiguo', names: ['這一鍋'], country: 'TW' },
  { key: 'juandoufu', names: ['涓豆腐'], country: 'TW' },
  { key: 'waca', names: ['瓦城'], country: 'TW' },
  { key: 'verythai', names: ['非常泰'], country: 'TW' },
  { key: 'tgifridays', names: ['星期五餐廳', 'TGI Fridays'], country: 'TW' },
  { key: 'secondfloor', names: ['貳樓餐廳', '貳樓', 'Second Floor Cafe'], country: 'TW' },
  { key: 'eatogether', names: ['饗食天堂', 'Eatogether'], country: 'TW' },
  { key: 'hanlai', names: ['漢來海港'], country: 'TW' },
  { key: 'xinye', names: ['欣葉'], country: 'TW' },
  { key: 'kaifan', names: ['開飯川食堂'], country: 'TW' },
  { key: 'xianwudon', names: ['鮮五丼'], country: 'TW' },
  { key: 'sihaiyoulong', names: ['四海遊龍'], country: 'TW' },
  { key: 'maiweideng', names: ['麥味登'], country: 'TW' },
  { key: 'meierm', names: ['美而美'], country: 'TW' },
  { key: 'laya', names: ['拉亞漢堡'], country: 'TW' },
  { key: 'chenjian', names: ['晨間廚房'], country: 'TW' },
  { key: 'hongye', names: ['弘爺漢堡'], country: 'TW' },
  { key: 'zaoanmcc', names: ['早安美芝城'], country: 'TW' },
  { key: 'jiguang', names: ['繼光香香雞'], country: 'TW' },
  { key: 'haodada', names: ['豪大大雞排', 'Hot-Star'], country: 'TW' },
  { key: 'dante', names: ['丹堤咖啡', 'Dante Coffee'], country: 'TW' },
  { key: 'eccoffee', names: ['怡客咖啡', 'EC Coffee'], country: 'TW' },
  { key: 'mrbrown', names: ['伯朗咖啡', 'Mr. Brown Coffee'], country: 'TW' },
  { key: 'seattle', names: ['西雅圖極品咖啡'], country: 'TW' },
  { key: 'cama', names: ['cama cafe', 'cama café'], country: 'TW' },

  // ── 日本 ──
  { key: 'matsuya', names: ['松屋', 'Matsuya'], country: 'JP' },
  { key: 'matsunoya', names: ['松のや'], country: 'JP' },
  { key: 'nakau', names: ['なか卯', 'Nakau'], country: 'JP' },
  { key: 'tenya', names: ['天丼てんや', 'てんや'], country: 'JP' },
  { key: 'katsuya', names: ['かつや', 'Katsuya'], country: 'JP' },
  { key: 'yayoiken', names: ['やよい軒', 'Yayoiken'], country: 'JP' },
  { key: 'hottomotto', names: ['ほっともっと', 'Hotto Motto'], country: 'JP' },
  { key: 'hidakaya', names: ['日高屋', 'Hidakaya'], country: 'JP' },
  { key: 'kourakuen', names: ['幸楽苑', 'Kourakuen'], country: 'JP' },
  { key: 'tenkaippin', names: ['天下一品', 'Tenkaippin'], country: 'JP' },
  { key: 'rairaitei', names: ['来来亭'], country: 'JP' },
  { key: 'marugen', names: ['丸源ラーメン'], country: 'JP' },
  { key: 'ringerhut', names: ['リンガーハット', 'Ringer Hut'], country: 'JP' },
  { key: 'gyozaohsho', names: ['餃子の王将'], country: 'JP' },
  { key: 'manshu', names: ['餃子の満洲'], country: 'JP' },
  { key: 'ginodako', names: ['築地銀だこ'], country: 'JP' },
  { key: 'hanamaru', names: ['はなまるうどん', 'Hanamaru Udon'], country: 'JP' },
  { key: 'sukesan', names: ['資さんうどん'], country: 'JP' },
  { key: 'hamasushi', names: ['はま寿司', 'Hama Sushi'], country: 'JP' },
  { key: 'kappasushi', names: ['かっぱ寿司', 'Kappa Sushi'], country: 'JP' },
  { key: 'anrakutei', names: ['安楽亭'], country: 'JP' },
  { key: 'yakinikuking', names: ['焼肉きんぐ'], country: 'JP' },
  { key: 'shabuyo', names: ['しゃぶ葉'], country: 'JP' },
  { key: 'gusto', names: ['ガスト', 'Gusto'], country: 'JP' },
  { key: 'jonathans', names: ['ジョナサン', "Jonathan's"], country: 'JP' },
  { key: 'royalhost', names: ['ロイヤルホスト', 'Royal Host'], country: 'JP' },
  { key: 'dennys', names: ['デニーズ', "Denny's"], country: 'JP' },
  { key: 'bamiyan', names: ['バーミヤン', 'Bamiyan'], country: 'JP' },
  { key: 'cocos', names: ['ココス', "COCO'S"], country: 'JP' },
  { key: 'joyfull', names: ['ジョイフル', 'Joyfull'], country: 'JP' },
  { key: 'skylark', names: ['スカイラーク'], country: 'JP' },
  { key: 'bikkuri', names: ['びっくりドンキー'], country: 'JP' },
  { key: 'ikinari', names: ['いきなり!ステーキ', 'いきなりステーキ', 'Ikinari Steak'], country: 'JP' },
  { key: 'lotteria', names: ['ロッテリア', 'Lotteria'], country: 'JP' },
  { key: 'freshness', names: ['フレッシュネスバーガー', 'Freshness Burger'], country: 'JP' },
  { key: 'pizzala', names: ['ピザーラ', 'Pizza-La'], country: 'JP' },
  { key: 'isomaru', names: ['磯丸水産'], country: 'JP' },
  { key: 'uotami', names: ['魚民'], country: 'JP' },
  { key: 'shirokiya', names: ['白木屋'], country: 'JP' },
  { key: 'warawara', names: ['笑笑'], country: 'JP' },
  { key: 'tsukadanojo', names: ['塚田農場'], country: 'JP' },
  { key: 'watami', names: ['和民', 'ワタミ'], country: 'JP' },
  { key: 'doutor', names: ['ドトールコーヒー', 'ドトール', 'Doutor'], country: 'JP' },
  { key: 'tullys', names: ['タリーズコーヒー', "Tully's Coffee"], country: 'JP' },
  { key: 'komeda', names: ['コメダ珈琲店', 'コメダ珈琲', 'Komeda'], country: 'JP' },
  { key: 'saintmarc', names: ['サンマルクカフェ', 'Saint Marc Cafe'], country: 'JP' },
  { key: 'ueshima', names: ['上島珈琲店'], country: 'JP' },
  { key: 'veloce', names: ['ベローチェ', 'Veloce'], country: 'JP' },
  { key: 'excelsior', names: ['エクセルシオールカフェ', 'Excelsior Caffe'], country: 'JP' },
]

const norm = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[\s'’・·.\-]/g, '')

const BRANCH_TAIL = /(分店|門市|號店|号店|店)$/
const BARE_TAIL = /^(分店|門市|號店|号店|店)$/
const CJK_SHORT = /^[\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}]{1,4}$/u
const PAREN_TAIL = /\s*[（(][^（）()]*[）)]\s*$/

/** 去掉分店字尾：「○○ 南京店」「○○店」「○○ 渋谷店」「○○（信義）」「○○分店」「○○門市」「○○ 南京 店」→ 品牌名。 */
export function stripBranch(name: string): string {
  let s = name.trim().replace(PAREN_TAIL, '').trim()
  const parts = s.split(/\s+/)
  if (parts.length > 1) {
    const last = parts.at(-1)!
    // 「八方雲集 南京 店」：字尾單獨一段，前一段若是短的中日文地名就一起拿掉；英文品牌名（Pizza Hut 店）不誤砍。
    if (BARE_TAIL.test(last)) return parts.slice(0, parts.length > 2 && CJK_SHORT.test(parts.at(-2)!) ? -2 : -1).join(' ')
    // 有空白：最後一段若以店／分店／門市結尾就整段拿掉（「すき家 渋谷店」「八方雲集 南京店」）。
    if (BRANCH_TAIL.test(last)) return parts.slice(0, -1).join(' ')
  }
  // 沒空白：「鼎泰豐信義店」→ 拿掉「兩個字 + 店」，剩下 ≥2 字才算（「阿財魯肉飯」不動；「阿財店」不被砍成一個字）。
  const m = s.match(/^(.{2,}?)([\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}A-Za-z0-9]{2})(分店|門市|號店|号店|店)$/u)
  if (m) s = m[1]!
  return s
}

const INDEX: { n: string; key: string }[] = BRANDS
  .flatMap((b) => b.names.map((n) => ({ n: norm(n), key: b.key })))
  .filter((x) => x.n.length >= 2)
  .sort((a, b) => b.n.length - a.n.length) // 長的先比，避免短名誤中

/** 店名命中字典 → 品牌鍵；否則 undefined。比對規則：正規化後以品牌名開頭。 */
export function brandKeyOf(name: string): string | undefined {
  const n = norm(name)
  return INDEX.find((x) => n.startsWith(x.n))?.key
}

/**
 * 同一批候選內分群：字典品牌一律給鍵（即使只有一家，讓跨天的同品牌曝光能合併）；
 * 不在字典的，stripBranch 後前綴相同 ≥2 家才聚成 'cluster:<前綴>'。單獨一家的非字典店不出現在 Map 裡。
 */
export function clusterKeys(cands: { id: string; name: string }[]): Map<string, string> {
  const out = new Map<string, string>()
  const byPrefix = new Map<string, string[]>()
  for (const c of cands) {
    const k = brandKeyOf(c.name)
    if (k) { out.set(c.id, k); continue }
    const p = norm(stripBranch(c.name))
    if (p.length < 2) continue
    byPrefix.set(p, [...(byPrefix.get(p) ?? []), c.id])
  }
  for (const [p, ids] of byPrefix) if (ids.length >= 2) for (const id of ids) out.set(id, `cluster:${p}`)
  return out
}

/** 這個鍵是不是連鎖（字典品牌，或同批候選裡 ≥2 家聚成的 cluster）。 */
export function isChainKey(key: string | undefined): boolean {
  return !!key
}
