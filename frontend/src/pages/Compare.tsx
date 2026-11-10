import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type Compare as CompareT, type CompareCourse, type PathSummary } from '../api'
import { ErrorBox, Loading, StatusTag, Workload } from '../components/shared'

export default function Compare() {
  const [params, setParams] = useSearchParams()
  const a = params.get('a') ?? ''
  const b = params.get('b') ?? ''
  const [paths, setPaths] = useState<PathSummary[]>([])
  const [data, setData] = useState<CompareT | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.paths().then(setPaths).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    let alive = true
    setData(null)
    setError('')
    if (!a || !b || a === b) return
    api.compare(a, b)
      .then((d) => { if (alive) setData(d) })
      .catch((e) => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [a, b])

  const pick = (key: 'a' | 'b', v: string) => setParams({ a, b, [key]: v })

  return (
    <>
      <h1>比較兩條學習路徑</h1>
      <p className="muted">例如從數位 IC 轉向類比 IC 時，直接看出哪些課共用、哪些需要補修。</p>
      <div className="card row mb">
        <select value={a} onChange={(e) => pick('a', e.target.value)}>
          <option value="">選擇路徑 A</option>
          {paths.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <span className="muted">vs</span>
        <select value={b} onChange={(e) => pick('b', e.target.value)}>
          <option value="">選擇路徑 B</option>
          {paths.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>
      {error && <ErrorBox error={error} />}
      {a && b && a === b && <div className="alert warning">請選擇兩條不同的路徑。</div>}
      {a && b && a !== b && !data && !error && <Loading />}
      {data && (
        <>
          <div className="grid cols-2 mb">
            {[data.a, data.b].map((p) => (
              <div key={p.id} className="card">
                <h3><Link to={`/paths/${p.id}`}>{p.title}</Link></h3>
                <div className="small muted">共 {p.total_credits} 學分</div>
                <div className="course-links">{p.skills.map((s) => <span key={s} className="tag">{s}</span>)}</div>
              </div>
            ))}
          </div>
          <div className="compare-grid">
            <Column title={`僅 ${data.a.title}`} items={data.only_a} tone="warn" />
            <Column title="兩條路徑共同" items={data.common} tone="accent" />
            <Column title={`僅 ${data.b.title}`} items={data.only_b} tone="warn" />
          </div>
        </>
      )}
    </>
  )
}

function Column({ title, items, tone }: { title: string; items: CompareCourse[]; tone: string }) {
  return (
    <div className="card">
      <h3><span className={`tag ${tone}`}>{items.length} 門</span> {title}</h3>
      <div className="small muted mb">{items.reduce((s, c) => s + c.credits, 0)} 學分</div>
      {items.length === 0 && <div className="muted small">無</div>}
      {items.map((c) => (
        <div key={c.id} className="row between" style={{ padding: '.35rem 0', borderTop: '1px solid var(--border)' }}>
          <div>
            <Link to={`/courses/${c.id}`}>{c.name}</Link>
            <div className="tiny muted">{c.code} · {c.credits} 學分 · {c.level}</div>
          </div>
          <div className="row" style={{ gap: '.4rem' }}>
            <StatusTag courseId={c.id} />
            <Workload value={c.workload} showLabel={false} />
          </div>
        </div>
      ))}
    </div>
  )
}
