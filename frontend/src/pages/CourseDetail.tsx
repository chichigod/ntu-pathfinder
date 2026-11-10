import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type CourseDetail as CourseDetailT } from '../api'
import { AddToPlan, ErrorBox, Loading, StatusTag, Stars, Workload, YEAR_CN } from '../components/shared'
import { useStore } from '../store'

export default function CourseDetail() {
  const { id = '' } = useParams()
  const { state, notify } = useStore()
  const [course, setCourse] = useState<CourseDetailT | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ rating: 4, workload: 3, comment: '', semester: '' })
  const [sending, setSending] = useState(false)

  const load = () => api.course(id).then(setCourse).catch((e) => setError(e.message))
  useEffect(() => {
    let alive = true
    setCourse(null)
    setError('')
    api.course(id)
      .then((c) => { if (alive) setCourse(c) })
      .catch((e) => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [id])

  if (error) return <ErrorBox error={error} />
  if (!course) return <Loading />

  const submitReview = async (e: FormEvent) => {
    e.preventDefault()
    setSending(true)
    try {
      await api.addReview(course.id, { author: state.owner || '匿名', ...form })
      setForm({ rating: 4, workload: 3, comment: '', semester: '' })
      notify('感謝你的評價！')
      await load()
    } catch (err) {
      notify(`送出失敗：${(err as Error).message}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="detail-layout">
      <div className="stack">
        <div className="card">
          <div className="row between">
            <div>
              <span className={`tag level-${course.level}`}>{course.level}</span> <span className="tag">{course.department}</span>
              <h1 style={{ marginTop: '.3rem' }}>{course.name}</h1>
              <div className="muted">{course.name_en}</div>
            </div>
            <StatusTag courseId={course.id} />
          </div>
          <dl className="kv mt">
            <dt>課號</dt><dd>{course.code}</dd>
            <dt>學分</dt><dd>{course.credits}</dd>
            <dt>授課教師</dt><dd>{course.instructor || '—'}</dd>
            <dt>開課學期</dt><dd>{course.terms.join('、')}學期 · 建議大{YEAR_CN[course.suggested_year]}修</dd>
            <dt>上課時間</dt><dd>{course.slot_text}</dd>
            <dt>課業負擔</dt><dd><Workload value={course.workload} />{course.avg_workload ? <span className="tiny muted">（學生評 {course.avg_workload}）</span> : null}</dd>
            <dt>學生評價</dt><dd><Stars value={course.avg_rating} /> {course.review_count ? <span className="tiny muted">({course.review_count} 則)</span> : null}</dd>
          </dl>
          <p className="mt">{course.description}</p>
          {course.workload_note && <div className="alert info">📝 負擔說明：{course.workload_note}</div>}
          <div className="row between mt">
            <AddToPlan course={course} />
            <span className="tiny muted">資料來源：<a href={course.source_url} target="_blank" rel="noreferrer">{course.source}</a> · 更新 {course.updated_at}</span>
          </div>
        </div>

        <div className="grid cols-2">
          <div className="card">
            <h3>先修條件</h3>
            {course.prerequisite_courses.length === 0 && <div className="muted small">無先修要求</div>}
            {course.prerequisite_courses.map((p) => (
              <div key={p.course_id} className="row between" style={{ padding: '.3rem 0' }}>
                <span>
                  <span className={`tag ${p.type === 'hard' ? 'danger' : 'warn'}`}>{p.type === 'hard' ? '必要先修' : '建議先修'}</span>{' '}
                  <Link to={`/courses/${p.course_id}`}>{p.name}</Link> <span className="tiny muted">{p.code}</span>
                </span>
                <StatusTag courseId={p.course_id} />
              </div>
            ))}
          </div>
          <div className="card">
            <h3>修完可以往哪裡走</h3>
            {course.unlocks.length === 0 && <div className="muted small">目前資料庫中沒有以本課為先修的課程</div>}
            {course.unlocks.map((u) => (
              <div key={u.course_id} className="row between" style={{ padding: '.3rem 0' }}>
                <span>
                  <Link to={`/courses/${u.course_id}`}>{u.name}</Link> <span className="tiny muted">{u.code}</span>
                </span>
                <span className={`tag ${u.type === 'hard' ? 'danger' : 'warn'}`}>{u.type === 'hard' ? '必要' : '建議'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>學生課程評價（{course.reviews.length}）</h3>
          {course.reviews.length === 0 && <div className="muted small">還沒有人評價，成為第一個分享的人吧。</div>}
          {course.reviews.map((r) => (
            <div key={r.id} className="review">
              <div className="head">
                <b>{r.author}</b>{r.semester && <span>{r.semester}</span>}
                <span className="rating">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                <span>負擔 {r.workload}/5</span>
                <span>{r.created_at.replace('T', ' ')}</span>
              </div>
              <div>{r.comment}</div>
            </div>
          ))}
          <form className="stack mt" onSubmit={submitReview}>
            <b className="small">分享你的修課經驗</b>
            <div className="row">
              <label className="field">推薦度
                <select value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}>
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} 星</option>)}
                </select>
              </label>
              <label className="field">課業負擔
                <select value={form.workload} onChange={(e) => setForm({ ...form, workload: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}（{['', '輕鬆', '偏輕', '中等', '偏重', '極重'][n]}）</option>)}
                </select>
              </label>
              <label className="field">修課學期
                <input placeholder="例如 113-1" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} style={{ width: 110 }} />
              </label>
            </div>
            <textarea placeholder="作業量、考試、給學弟妹的建議…" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} required />
            <div className="row between">
              <span className="tiny muted">以「{state.owner || '匿名'}」身分送出</span>
              <button className="btn primary" disabled={sending}>送出評價</button>
            </div>
          </form>
        </div>
      </div>

      <aside className="side-panel stack">
        <div className="card">
          <h3>學習資源</h3>
          {course.resources.length === 0 && <div className="muted small">尚未整理</div>}
          {course.resources.map((r) => (
            <div key={r.title} style={{ padding: '.3rem 0' }}>
              {r.url ? <a href={r.url} target="_blank" rel="noreferrer">{r.title}</a> : r.title}
              <div className="tiny muted">{r.type}</div>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>出現在這些學習路徑</h3>
          {course.in_paths.length === 0 && <div className="muted small">—</div>}
          {course.in_paths.map((p) => (
            <div key={p.path_id} style={{ padding: '.25rem 0' }}><Link to={`/paths/${p.path_id}`}>{p.title}</Link></div>
          ))}
        </div>
      </aside>
    </div>
  )
}
