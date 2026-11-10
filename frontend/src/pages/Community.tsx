import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, type Course, type Submission } from '../api'
import { ErrorBox, Loading } from '../components/shared'
import { useStore } from '../store'

export default function Community() {
  const { state, notify } = useStore()
  const [subs, setSubs] = useState<Submission[] | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [error, setError] = useState('')
  const [favs, setFavs] = useState<Set<string>>(new Set())
  const [form, setForm] = useState({ title: '', goal: '', description: '', course_ids: [] as string[] })
  const [filter, setFilter] = useState('')
  const [commentText, setCommentText] = useState<Record<number, string>>({})
  const [sending, setSending] = useState(false)

  const load = () => api.submissions().then(setSubs).catch((e) => setError(e.message))
  useEffect(() => {
    load()
    api.courses().then(setCourses).catch(() => {})
  }, [])
  useEffect(() => {
    if (!state.owner) return setFavs(new Set())
    api.favorites(state.owner).then((f) => setFavs(new Set(f.filter((x) => x.target_type === 'submission').map((x) => x.target_id)))).catch(() => {})
  }, [state.owner])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (form.course_ids.length === 0) return notify('請至少選擇一門課程')
    setSending(true)
    try {
      await api.createSubmission({ author: state.owner || '匿名', ...form })
      setForm({ title: '', goal: '', description: '', course_ids: [] })
      notify('投稿已送出，管理員審核後公開')
    } catch (err) {
      notify(`送出失敗：${(err as Error).message}`)
    } finally {
      setSending(false)
    }
  }

  const like = async (s: Submission) => {
    try {
      const r = await api.likeSubmission(s.id)
      setSubs((cur) => cur?.map((x) => (x.id === s.id ? { ...x, likes: r.likes } : x)) ?? null)
    } catch (err) {
      notify(`按讚失敗：${(err as Error).message}`)
    }
  }

  const fav = async (s: Submission) => {
    if (!state.owner) return notify('請先在右上角輸入暱稱')
    try {
      const r = await api.toggleFavorite({ owner: state.owner, target_type: 'submission', target_id: String(s.id) })
      setFavs((cur) => { const n = new Set(cur); if (r.favorited) n.add(String(s.id)); else n.delete(String(s.id)); return n })
    } catch (err) {
      notify(`收藏失敗：${(err as Error).message}`)
    }
  }

  const comment = async (s: Submission) => {
    const text = (commentText[s.id] ?? '').trim()
    if (!text) return
    try {
      const updated = await api.commentSubmission(s.id, { author: state.owner || '匿名', text })
      setSubs((cur) => cur?.map((x) => (x.id === s.id ? { ...x, comments: updated.comments } : x)) ?? null)
      setCommentText((cur) => ({ ...cur, [s.id]: '' }))
    } catch (err) {
      notify(`留言失敗：${(err as Error).message}`)
    }
  }

  const toggleCourse = (id: string) =>
    setForm((f) => ({ ...f, course_ids: f.course_ids.includes(id) ? f.course_ids.filter((c) => c !== id) : [...f.course_ids, id] }))

  const filteredCourses = courses.filter((c) => !filter || c.name.includes(filter) || c.code.toLowerCase().includes(filter.toLowerCase()))

  return (
    <>
      <h1>學習路徑投稿與評價</h1>
      <p className="muted">分享你的修課經驗與建議順序。投稿經管理員審核後公開，其他同學可以按讚、收藏與提出建議。<Link to="/admin" className="small"> 管理員審核 →</Link></p>
      {error && <ErrorBox error={error} />}
      <div className="detail-layout">
        <div className="stack">
          {!subs && !error && <Loading />}
          {subs?.length === 0 && <div className="card empty">還沒有公開的投稿。</div>}
          {subs?.map((s) => (
            <div key={s.id} className="card">
              <div className="row between">
                <div>
                  <span className="tag primary">{s.goal || '未分類'}</span>
                  <h3 style={{ marginTop: '.3rem' }}>{s.title}</h3>
                  <div className="tiny muted">{s.author} · {s.created_at.replace('T', ' ')}</div>
                </div>
                <div className="row" style={{ gap: '.3rem' }}>
                  <button className="btn sm" onClick={() => like(s)}>👍 {s.likes}</button>
                  <button className="btn sm" onClick={() => fav(s)}>{favs.has(String(s.id)) ? '★ 已收藏' : '☆ 收藏'}</button>
                </div>
              </div>
              <p className="small mt">{s.description}</p>
              <div className="course-links">
                {s.courses?.map((c, i) => (
                  <span key={c.id} className="row" style={{ gap: '.2rem' }}>
                    {i > 0 && <span className="muted">→</span>}
                    <Link to={`/courses/${c.id}`} className="course-pill">{c.name}</Link>
                  </span>
                ))}
              </div>
              <div className="mt">
                {s.comments.map((c, i) => (
                  <div key={i} className="review">
                    <div className="head"><b>{c.author}</b><span>{c.created_at}</span></div>
                    <div>{c.text}</div>
                  </div>
                ))}
                <div className="row mt" style={{ gap: '.4rem' }}>
                  <input aria-label="留言" placeholder="提出建議或提問…" value={commentText[s.id] ?? ''} onChange={(e) => setCommentText({ ...commentText, [s.id]: e.target.value })} style={{ flex: 1 }} onKeyDown={(e) => e.key === 'Enter' && comment(s)} />
                  <button className="btn sm" onClick={() => comment(s)}>送出</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="side-panel">
          <form className="card stack" onSubmit={submit}>
            <h3 style={{ margin: 0 }}>投稿你的學習路徑</h3>
            <label className="field">標題<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="例如：從電子學到類比 IC 實驗室的三年路線" /></label>
            <label className="field">職涯目標<input value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="例如：類比 IC 設計工程師" /></label>
            <label className="field">經驗與建議<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="為什麼這樣排？哪些課要先修？負擔如何？" /></label>
            <div className="field">
              課程（依建議順序點選，已選 {form.course_ids.length} 門）
              <input aria-label="篩選課程" placeholder="篩選課程" value={filter} onChange={(e) => setFilter(e.target.value)} />
              <div className="scroll-list" style={{ maxHeight: 220 }}>
                {filteredCourses.map((c) => (
                  <label key={c.id} className="check">
                    <input type="checkbox" checked={form.course_ids.includes(c.id)} onChange={() => toggleCourse(c.id)} />
                    <span style={{ flex: 1 }}>{form.course_ids.includes(c.id) && <b>{form.course_ids.indexOf(c.id) + 1}. </b>}{c.name} <span className="tiny muted">{c.code}</span></span>
                  </label>
                ))}
              </div>
            </div>
            <div className="row between">
              <span className="tiny muted">以「{state.owner || '匿名'}」投稿</span>
              <button className="btn primary" disabled={sending}>送出審核</button>
            </div>
          </form>
        </aside>
      </div>
    </>
  )
}
