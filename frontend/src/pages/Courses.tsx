import { useEffect, useState } from 'react'
import { api, type Course, type Meta } from '../api'
import { AddToPlan, CourseCard, ErrorBox, Loading } from '../components/shared'

export default function Courses() {
  const [q, setQ] = useState('')
  const [department, setDepartment] = useState('')
  const [level, setLevel] = useState('')
  const [term, setTerm] = useState('')
  const [meta, setMeta] = useState<Meta | null>(null)
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.meta().then(setMeta).catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    const t = window.setTimeout(() => {
      api.courses({ q, department, level, term })
        .then((r) => { if (alive) { setCourses(r); setError('') } })
        .catch((e) => { if (alive) setError(e.message) })
    }, 200)
    return () => { alive = false; window.clearTimeout(t) }
  }, [q, department, level, term])

  return (
    <>
      <h1>課程查詢</h1>
      <p className="muted">第一階段收錄電機、資工相關課程。每門課整合課號、學分、授課教師、開課時間、先修條件、預估負擔、學習資源與學生評價。</p>
      <div className="card row mb">
        <input aria-label="搜尋課程" placeholder="搜尋課名、課號、教師或關鍵字" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
        <select value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">所有系所</option>
          {meta?.departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">所有層級</option>
          <option value="基礎">基礎</option>
          <option value="核心">核心</option>
          <option value="進階">進階</option>
        </select>
        <select value={term} onChange={(e) => setTerm(e.target.value)}>
          <option value="">上/下學期</option>
          <option value="上">上學期開課</option>
          <option value="下">下學期開課</option>
        </select>
      </div>
      {error && <ErrorBox error={error} />}
      {!error && !courses && <Loading />}
      {courses && (
        <>
          <div className="small muted mb">共 {courses.length} 門課程 · 資料更新 {meta?.data_updated_at}</div>
          {courses.length === 0 && <div className="card empty">沒有符合條件的課程。</div>}
          <div className="grid cols-3">
            {courses.map((c) => (
              <CourseCard key={c.id} course={c}>
                <AddToPlan course={c} compact />
              </CourseCard>
            ))}
          </div>
        </>
      )}
    </>
  )
}
