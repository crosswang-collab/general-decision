// S4 用的固定 Order 樣本（取自 decide-mock-v5.html 的 MOD 表）。
// S6 之後前端改打 /api/order，這份只留給 e2e 的 mock 路由與離線示範。
import type { ModuleId, Order } from './types.ts'

export const MOCK_ORDERS: Record<ModuleId, Order> = {
  eat: {
    verdict: 'do',
    meme: { top: '去吃熱的', big: '阿財魯肉飯', bot: '這週兩天超商了' },
    steps: ['步行 6 分鐘，營業到 21:00。', '魯肉飯、滷蛋、燙青菜。', '12 分鐘吃完，手機收起來。'],
    place: { id: 'mock-eat-1', name: '阿財魯肉飯', walkMin: 6, openUntil: '21:00' },
    log: '12:41 魯肉飯，12:58 完成。',
  },
  go: {
    verdict: 'do',
    meme: { top: '週四晚上，出去走', big: '象山，上去', bot: '拍一張，回家' },
    steps: ['捷運象山站 2 號出口，18 分鐘。', '走到六巨石，拍一張。', '下山不逛街，直接回營。'],
    log: '18:20 象山，20:05 回報。',
  },
  attend: {
    verdict: 'do',
    meme: { top: '四顆星的人邀你', big: '去！', bot: '90 分鐘就可以走' },
    steps: ['19:00 到，不早不晚。', 'smart casual：深色長褲、有領上衣。', '90 分鐘，可以走。'],
    log: '赴飯局 90 分，20:35 準時離場。',
  },
  rest: {
    verdict: 'do',
    meme: { top: '起來喝一杯', big: 'Fika Fika Café', bot: '20 分鐘，手機面朝下' },
    steps: ['步行 4 分鐘，營業中。', '一杯，不加糖。', '坐 20 分鐘，手機面朝下。'],
    place: { id: 'mock-rest-1', name: 'Fika Fika Café', walkMin: 4 },
    log: '15:10 Fika Fika，15:34 回報。',
  },
  sleep: {
    verdict: 'do',
    meme: { top: '八小時', big: '23:30 熄燈', bot: '一個口令一個動作' },
    steps: ['23:00 充電器插客廳。', '23:15 刷牙。', '23:30 關燈，不確認訊息。'],
    log: '23:30 熄燈，23:28 回報。',
  },
  reply: {
    verdict: 'do',
    meme: { top: '拖一小時了', big: '現在回。兩句。', bot: '答案，然後時程' },
    steps: ['第一句：答案。', '第二句：什麼時候給完整版。', '送出，關掉。'],
    log: '兩句回覆，14:02 送出。',
  },
  buy: {
    verdict: 'stop',
    meme: { top: '本週第二次猶豫', big: '不買。', bot: '72 小時後再來報告' },
    steps: ['關掉頁面。', '72 小時後還想要，再來報告。'],
    log: '不買，頁面已關。',
  },
  travel: {
    verdict: 'do',
    meme: { top: '護照拿出來', big: '日本 福岡', bot: '五天，夠你把屁股從椅子上拔起來' },
    steps: ['今天 22:00 前訂機票。', '出發前查護照效期滿六個月。', '週日回國。'],
    log: '出國，福岡五天，機票已訂。',
  },
}

/** 換口令用的第二家（mock v5 的 reissue()）。 */
export const MOCK_REISSUE: Partial<Record<ModuleId, Order>> = {
  eat: {
    verdict: 'do',
    meme: { top: '店關了不是你的錯', big: '巷口牛肉麵', bot: '第二道口令一樣算' },
    steps: ['步行 3 分鐘，營業中。', '清燉，不加辣。'],
    place: { id: 'mock-eat-2', name: '巷口牛肉麵', walkMin: 3 },
    log: '13:05 牛肉麵，13:22 完成。',
  },
  rest: {
    verdict: 'do',
    meme: { top: '換一家', big: '路上咖啡', bot: '一樣坐 20 分鐘' },
    steps: ['步行 5 分鐘，營業中。', '一杯，不加糖。', '坐 20 分鐘，手機面朝下。'],
    place: { id: 'mock-rest-2', name: '路上咖啡', walkMin: 5 },
    log: '15:40 路上咖啡，16:02 回報。',
  },
  go: {
    verdict: 'do',
    meme: { top: '路封了就繞', big: '大安森林公園', bot: '一樣要流汗' },
    steps: ['捷運大安森林公園站，12 分鐘。', '繞外圈走一圈。', '走完直接回營。'],
    log: '19:10 大安森林公園，20:00 回報。',
  },
}
