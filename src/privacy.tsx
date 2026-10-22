// 隱私政策頁（App Store 5.1.1；DEV-PLAN-3 W3）。靜態頁，只用既有 .screen / .notice / .back class。
// 文字以資料形式導出（PRIVACY_SECTIONS），測試才掃得到全文；聯絡信箱用 report.ts 的佔位 [CONTACT_EMAIL]，由 Cross 填。
// 寫法原則：誰、拿什麼、為什麼、存哪、怎麼刪，一件一段；不用「可能」「某些情況」這類讓法務看不懂的字。
import { CONTACT_EMAIL, ISSUES_URL, hasContactEmail } from './report.ts'

export const PRIVACY_UPDATED = '2026-10-22'

export interface PrivacySection { title: string; paras: string[] }

export const PRIVACY_SECTIONS: readonly PrivacySection[] = [
  {
    title: '一、這是什麼',
    paras: [
      '「報告班長・決斷連」（下稱本服務）替你決定吃什麼、去哪這類生活小事。沒有帳號、不用登入。以下說明本服務拿了你哪些資料、送給誰、存在哪裡、怎麼刪。',
    ],
  },
  {
    title: '二、我們拿了什麼',
    paras: [
      '位置：你要班長查附近的店時，取得一次手機的位置（需要你在系統跳出的視窗按允許）。你也可以不給，改手動輸入車站或地標名稱。',
      '你的選擇：忌口、預算、步行方式、時間這類你在選單上點的選項。',
      '店家記憶摘要：Google 的店家代碼，加上這家店被派給你、你回報完成的時間；以及你按過「這家不要再來」「列入愛店」，和料理大類的偏好統計。這份摘要沒有店名、沒有評分、沒有位置。',
      '日記與週報素材：每道口令的標題（吃、歇的口令標題就是店名）、時間、你回報完成或沒做。',
      '你主動送出的檢舉：你按「回報這道口令」時，會開啟預先填好口令文字的回報頁（信箱公布前是公開的 GitHub issue，公布後是你的郵件程式），內容是口令文字，不含位置。你按送出才會離開手機。',
      '我們沒有拿：姓名、帳號、電話、通訊錄、照片、廣告識別碼。本服務沒有廣告，也沒有第三方分析工具。',
    ],
  },
  {
    title: '三、送給誰、做什麼',
    paras: [
      'Google（Google Maps Platform）：你的位置（或你手動輸入的地點名稱）會送去查附近的店，拿回店名、評分、營業時間、價位。',
      '決斷連的伺服器：你的選擇、目前時間、位置，加上店家記憶摘要，會送到我們的伺服器，用來決定派你去哪一家、算步行時間。伺服器不建立資料庫、不保存這些內容。',
      'Anthropic（Claude 的開發商）：口令是 Anthropic 的 AI 寫的。送給它的有你的選擇、目前時間、你在哪個國家（不送座標、不送地點名稱）、近 7 天的口令標題、這次被選中那家店的店名與步行分鐘、營業時間、價位，以及「這家你是第幾次來」。店是由程式決定，不是 AI 選的。',
      '託管平台：伺服器架在 Vercel。平台依一般營運會留下連線紀錄（例如 IP 位址、時間），我們不拿來辨識你是誰。',
      '伺服器每道口令會留下幾行技術紀錄：模組、查詢類別或關鍵字（例如「素食」「居酒屋」）、國家、火力、耗時。紀錄不含座標、不含店家代碼、不含店名、不含記憶。',
      '以上第三方如何處理資料，依各自的隱私政策；連結在最下面。',
    ],
  },
  {
    title: '四、存在哪裡、存多久',
    paras: [
      '日記、店家記憶、偏好、你的設定，全部只存在你的手機（瀏覽器的本機儲存空間），我們看不到。你不刪，就一直留在手機上。',
      '除錯紀錄：長按班長名牌才看得到，只存最近 10 次連線的過程（含當時查到的候選店名與評分），只存在手機，不會自動送出；你按「複製」才會離開手機。',
      '伺服器不保存上述任何一項。',
    ],
  },
  {
    title: '五、怎麼刪',
    paras: [
      '在手機上：設定 → Safari → 進階 → 網站資料，找到本網站，滑動刪除；或在設定 → Safari 按「清除瀏覽記錄與網站資料」。若你把本服務加到主畫面使用，先刪掉主畫面上的圖示，再清除 Safari 網站資料，兩步都做最乾淨。',
      '清除後，日記、店家記憶、偏好全部歸零，下次開啟會重新詢問同意。',
      '伺服器端沒有你的資料，沒有需要另外刪除的東西。你寄過檢舉信、想請我們刪除，來信即可，聯絡方式在最下面。',
    ],
  },
  {
    title: '六、你可以決定的事',
    paras: [
      '不同意就不要使用，關掉即可。同意之後想撤回，清除網站資料就是撤回。',
      '位置隨時可以在系統設定裡關掉，關掉後改用手動輸入地點。',
    ],
  },
  {
    title: '七、口令內容的說明',
    paras: [
      '口令由 AI 即時撰寫，語氣是軍教片班長，只拿你的行為開玩笑，不針對人。口令只是生活小事的建議，不是醫療、財務或法律意見。看到不妥的口令，請按口令卡上的「回報這道口令」告訴我們。',
    ],
  },
  {
    title: '八、地圖與店家資料的歸屬',
    paras: [
      '店家資料、評價、營業時間與地圖連結由 Google Maps 提供，使用時也適用 Google 的條款。',
    ],
  },
  {
    title: '九、改版',
    paras: [
      `本政策最後更新：${PRIVACY_UPDATED}。內容有實質變動時，會讓你重新同意一次。`,
    ],
  },
  {
    title: '十、聯絡',
    paras: [
      hasContactEmail()
        ? `任何隱私問題、刪除請求或檢舉，請寫信到 ${CONTACT_EMAIL}。`
        : `任何隱私問題、刪除請求或檢舉，請到 ${ISSUES_URL} 留言。`,
    ],
  },
]

/** 條款連結（App 內顯示成文字連結）。 */
export const PRIVACY_LINKS: readonly { label: string; href: string }[] = [
  { label: 'Google Maps Platform 服務條款', href: 'https://cloud.google.com/maps-platform/terms' },
  { label: 'Google 隱私權政策', href: 'https://policies.google.com/privacy' },
  { label: 'Anthropic 隱私權政策', href: 'https://www.anthropic.com/legal/privacy' },
]

export function Privacy({ onBack }: { onBack: () => void }) {
  return (
    <section className="screen" data-screen="privacy">
      <button className="back" onClick={onBack}>← 回報告</button>
      <div className="notice" data-testid="privacy">
        <b>隱私政策</b>
        <small>最後更新 {PRIVACY_UPDATED}</small>
      </div>
      {PRIVACY_SECTIONS.map((s) => (
        <div className="notice" key={s.title}>
          <b>{s.title}</b>
          {s.paras.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      ))}
      <div className="notice" data-testid="privacy-links">
        <b>條款連結</b>
        {PRIVACY_LINKS.map((l) => (
          <p key={l.href}><a href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a></p>
        ))}
        <small translate="no">Google Maps</small>
      </div>
    </section>
  )
}
