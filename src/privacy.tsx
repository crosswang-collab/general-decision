// 隱私政策頁（App Store 5.1.1；DEV-PLAN-3 W3）。契約空殼：W3 實作。
export function Privacy({ onBack }: { onBack: () => void }) {
  return (
    <section className="screen" data-screen="privacy">
      <button className="back" onClick={onBack}>← 回報告</button>
      <div className="notice" data-testid="privacy">隱私政策</div>
    </section>
  )
}
