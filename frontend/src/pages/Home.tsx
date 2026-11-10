import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type PathSummary } from '../api'
import { ErrorBox, Loading } from '../components/shared'

const EXAMPLES = ['我想成為類比 IC 設計工程師', '數位晶片設計', '後端軟體工程師', 'AI 工程師', '射頻 / 無線通訊']

export default function Home() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [input, setInput] = useState(q)
  const [paths, setPaths] = useState<PathSummary[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setPaths(null)
    setError('')
    api.paths(q)
      .then((r) => { if (alive) setPaths(r) })
      .catch((e) => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [q])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setParams(input.trim() ? { q: input.trim() } : {})
  }

  return (
    <>
      <section className="hero">
        <h1>從職涯目標出發，規劃你的臺大修課地圖</h1>
        <p>
          輸入想學的領域或未來職業，系統會依臺大實際開設的課程，提供建議學習路徑、先修關係、課程資訊與跨學期修課規劃。
          所有推薦都附上理由與資料來源。
        </p>
        <form className="search-box" onSubmit={submit}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="例如：我想成為類比 IC 設計工程師" />
          <button className="btn primary" type="submit">搜尋路徑</button>
        </form>
        <div className="chips">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="chip" onClick={() => { setInput(ex); setParams({ q: ex }) }}>
              {ex}
            </button>
          ))}
        </div>
      </section>

      <div className="row between mb">
        <h2>{q ? `「${q}」的學習路徑` : '所有職涯學習路徑'}</h2>
        {q && <button className="btn ghost" onClick={() => { setInput(''); setParams({}) }}>顯示全部</button>}
      </div>

      {error && <ErrorBox error={error} />}
      {!error && !paths && <Loading />}
      {paths && paths.length === 0 && (
        <div className="card empty">
          找不到符合「{q}」的路徑。第一階段僅收錄電機與資工相關領域，可改用「IC 設計」「軟體」「AI」等關鍵字，或
          <Link to="/community"> 到投稿區分享你的路徑</Link>。
        </div>
      )}
      {paths && paths.length > 0 && (
        <div className="grid cols-3">
          {paths.map((p) => (
            <Link key={p.id} to={`/paths/${p.id}`} className="card path-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="row between">
                <span className="tag primary">{p.category}</span>
                {q && p.matched.length > 0 && <span className="tiny muted">符合：{p.matched.join('、')}</span>}
              </div>
              <div className="title">{p.title}</div>
              <p className="small muted" style={{ flex: 1 }}>{p.summary}</p>
              <div className="stat-row">
                <span><b>{p.skill_count}</b> 項能力</span>
                <span><b>{p.course_count}</b> 門課</span>
                <span><b>{p.total_credits}</b> 學分</span>
              </div>
              <div className="tiny muted">✔ {p.verified_by} · 更新 {p.updated_at}</div>
            </Link>
          ))}
        </div>
      )}

      <section className="grid cols-3 mt">
        <div className="card">
          <h3>1. 職涯 → 能力 → 課程</h3>
          <p className="small muted">每條路徑先拆解成需要具備的能力，再對應到臺大實際課程，並說明為什麼推薦這門課。</p>
        </div>
        <div className="card">
          <h3>2. 先修關係視覺化</h3>
          <p className="small muted">以互動式學習地圖呈現課程之間的硬性與建議先修關係，一眼看出哪些是基礎、哪些是進階。</p>
        </div>
        <div className="card">
          <h3>3. 跨學期規劃與檢查</h3>
          <p className="small muted">輸入已修課程，把推薦課程排進未來學期，自動檢查衝堂、學分上下限、先修條件與課業負擔。</p>
        </div>
      </section>
    </>
  )
}
