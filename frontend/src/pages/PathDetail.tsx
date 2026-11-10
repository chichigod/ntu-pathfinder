import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type Course, type PathDetail as PathDetailT } from '../api'
import LearningMap from '../components/LearningMap'
import { AddToPlan, ErrorBox, Loading, StatusTag, Stars, Workload, YEAR_CN } from '../components/shared'
import { useStore } from '../store'

export default function PathDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { state, set, isCompleted, plannedIn, setSemesters, notify } = useStore()
  const [path, setPath] = useState<PathDetailT | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState<'map' | 'skills' | 'timeline'>('map')
  const [fav, setFav] = useState(false)
  const [suggesting, setSuggesting] = useState(false)

  useEffect(() => {
    let alive = true
    setPath(null)
    setSelected(null)
    setError('')
    api.path(id)
      .then((p) => { if (alive) setPath(p) })
      .catch((e) => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [id])

  useEffect(() => {
    let alive = true
    setFav(false)
    if (!state.owner) return
    api.favorites(state.owner)
      .then((f) => { if (alive) setFav(f.some((x) => x.target_type === 'path' && x.target_id === id)) })
      .catch(() => {})
    return () => { alive = false }
  }, [state.owner, id])

  const byId = useMemo(() => new Map(path?.courses.map((c) => [c.id, c]) ?? []), [path])
  const selectedCourse = selected ? byId.get(selected) : undefined

  const progress = useMemo(() => {
    if (!path) return { done: 0, planned: 0, total: 0 }
    const total = path.courses.length
    const done = path.courses.filter((c) => isCompleted(c.id)).length
    const planned = path.courses.filter((c) => plannedIn(c.id) >= 0).length
    return { done, planned, total }
  }, [path, isCompleted, plannedIn])

  if (error) return <ErrorBox error={error} />
  if (!path) return <Loading />

  const toggleFav = async () => {
    if (!state.owner) return notify('請先在右上角輸入暱稱')
    try {
      const r = await api.toggleFavorite({ owner: state.owner, target_type: 'path', target_id: path.id })
      setFav(r.favorited)
      notify(r.favorited ? '已收藏此路徑' : '已取消收藏')
    } catch (e) {
      notify(`收藏失敗：${(e as Error).message}`)
    }
  }

  const autoPlan = async () => {
    setSuggesting(true)
    try {
      const first = state.semesters[0] ?? { label: '大二上', term: '上' }
      const r = await api.suggest({
        path_id: path.id,
        completed_course_ids: state.completed,
        start_label: first.label,
        start_term: first.term,
        num_semesters: Math.max(state.semesters.length, 4),
        max_credits: Math.min(state.settings.max_credits, 18),
        workload_limit: Math.min(state.settings.workload_limit, 16),
      })
      setSemesters(r.semesters)
      set({ pathId: path.id })
      notify(
        r.unscheduled.length
          ? `已產生 ${r.semesters.length} 學期建議，${r.unscheduled.length} 門課未排入`
          : `已產生 ${r.semesters.length} 學期建議計畫`,
      )
      navigate('/planner')
    } catch (e) {
      notify(`排課失敗：${(e as Error).message}`)
    } finally {
      setSuggesting(false)
    }
  }

  return (
    <>
      <div className="row between mb">
        <div>
          <span className="tag primary">{path.category}</span>
          <h1 style={{ marginTop: '.3rem' }}>{path.title}</h1>
          <p className="muted" style={{ maxWidth: 760 }}>{path.summary}</p>
        </div>
        <div className="row">
          <button className="btn" onClick={toggleFav}>{fav ? '★ 已收藏' : '☆ 收藏'}{path.favorite_count ? ` (${path.favorite_count})` : ''}</button>
          <button className="btn accent" onClick={autoPlan} disabled={suggesting}>
            {suggesting ? '產生中…' : '依已修課程自動排入學期計畫'}
          </button>
        </div>
      </div>

      <div className="grid cols-4 mb">
        <div className="card compact"><div className="tiny muted">課程數</div><b style={{ fontSize: '1.3rem' }}>{path.courses.length}</b> 門</div>
        <div className="card compact"><div className="tiny muted">總學分</div><b style={{ fontSize: '1.3rem' }}>{path.total_credits}</b> 學分</div>
        <div className="card compact"><div className="tiny muted">你的進度</div><b style={{ fontSize: '1.3rem' }}>{progress.done}</b> 已修 · {progress.planned} 已排入</div>
        <div className="card compact">
          <div className="tiny muted">比較其他方向</div>
          <div className="row" style={{ gap: '.3rem' }}>
            {path.related_paths.map((rp) => (
              <Link key={rp.id} to={`/compare?a=${path.id}&b=${rp.id}`} className="btn sm">vs {rp.title}</Link>
            ))}
          </div>
        </div>
      </div>

      <div className="card mb">
        <h3>這個職業在做什麼？</h3>
        <p className="small">{path.job_description}</p>
        <div className="source-note">
          ✔ {path.verified_by}　·　更新日期 {path.updated_at}　·　資料來源：
          {path.sources.map((s, i) => (
            <span key={s.url}>{i > 0 && '、'}<a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></span>
          ))}
          。本路徑為示意規劃，正式選課請依課程網確認實際先修規定與開課時間。
        </div>
      </div>

      <div className="tabs">
        <button className={tab === 'map' ? 'active' : ''} onClick={() => setTab('map')}>學習地圖</button>
        <button className={tab === 'skills' ? 'active' : ''} onClick={() => setTab('skills')}>能力拆解與推薦理由</button>
        <button className={tab === 'timeline' ? 'active' : ''} onClick={() => setTab('timeline')}>建議修課順序</button>
      </div>

      {tab === 'map' && (
        <div className="detail-layout">
          <div>
            <LearningMap path={path} selectedId={selected} onSelect={setSelected} />
          </div>
          <aside className="side-panel">
            {selectedCourse ? (
              <CoursePanel course={selectedCourse} byId={byId} />
            ) : (
              <div className="card">
                <h3>課程詳情</h3>
                <p className="small muted">點選地圖中的課程節點，查看學分、開課時間、先修條件、課業負擔與推薦理由，並可直接加入學期計畫。</p>
              </div>
            )}
          </aside>
        </div>
      )}

      {tab === 'skills' && (
        <div className="skill-list">
          {path.skills.map((sk, i) => (
            <div key={sk.name} className="card">
              <div className="skill">
                <b>{i + 1}. {sk.name}</b>
                <div className="small">{sk.description}</div>
                <div className="reason">💡 為什麼需要：{sk.reason}</div>
              </div>
              <div className="course-links mt">
                {sk.course_ids.map((cid) => {
                  const c = byId.get(cid)
                  if (!c) return null
                  const cls = isCompleted(cid) ? 'done' : plannedIn(cid) >= 0 ? 'planned' : ''
                  return (
                    <button key={cid} className={`course-pill ${cls}`} onClick={() => { setSelected(cid); setTab('map') }}>
                      {c.name} <span className="tiny muted">{c.code} · {c.credits} 學分</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'timeline' && (
        <>
          <div className="timeline">
            {path.stages.map((st) => (
              <div key={st.label} className="stage">
                <h4>{st.label}</h4>
                {st.course_ids.map((cid) => {
                  const c = byId.get(cid)
                  if (!c) return null
                  const cls = isCompleted(cid) ? 'done' : plannedIn(cid) >= 0 ? 'planned' : ''
                  return (
                    <button key={cid} className={`course-pill ${cls}`} onClick={() => { setSelected(cid); setTab('map') }}>
                      <span>{c.name}</span><span className="tiny muted">{c.credits} 學分</span>
                    </button>
                  )
                })}
                <div className="tiny muted">
                  {st.course_ids.reduce((s, cid) => s + (byId.get(cid)?.credits ?? 0), 0)} 學分 · 負擔 {st.course_ids.reduce((s, cid) => s + (byId.get(cid)?.workload ?? 0), 0)}
                </div>
              </div>
            ))}
          </div>
          <p className="small muted mt">順序為團隊依先修關係與開課學期整理的建議，實際可依個人進度調整。按「依已修課程自動排入學期計畫」可從你目前的進度產生個人化版本。</p>
        </>
      )}
    </>
  )
}

function CoursePanel({ course, byId }: { course: Course; byId: Map<string, Course> }) {
  return (
    <div className="card">
      <div className="row between">
        <h3 style={{ margin: 0 }}>{course.name}</h3>
        <span className={`tag level-${course.level}`}>{course.level}</span>
      </div>
      <div className="small muted">{course.name_en}</div>
      <dl className="kv mt">
        <dt>課號</dt><dd>{course.code}</dd>
        <dt>學分</dt><dd>{course.credits}</dd>
        <dt>開課</dt><dd>{course.terms.join('、')}學期 · 建議大{YEAR_CN[course.suggested_year]}</dd>
        <dt>時間</dt><dd>{course.slot_text}</dd>
        <dt>教師</dt><dd>{course.instructor || '—'}</dd>
        <dt>負擔</dt><dd><Workload value={course.workload} /></dd>
        <dt>評價</dt><dd><Stars value={course.avg_rating} /> {course.review_count ? <span className="tiny muted">({course.review_count} 則)</span> : null}</dd>
        <dt>先修</dt>
        <dd>
          {course.prerequisites.length === 0 && '無'}
          {course.prerequisites.map((p) => (
            <div key={p.course_id}>
              <span className={`tag ${p.type === 'hard' ? 'danger' : 'warn'}`}>{p.type === 'hard' ? '必要' : '建議'}</span>{' '}
              {byId.get(p.course_id)?.name ?? p.course_id} <StatusTag courseId={p.course_id} />
            </div>
          ))}
        </dd>
      </dl>
      <p className="small mt">{course.description}</p>
      {course.workload_note && <p className="small muted">📝 {course.workload_note}</p>}
      <div className="row between mt">
        <AddToPlan course={course} compact />
        <Link to={`/courses/${course.id}`} className="btn sm ghost">完整資訊 →</Link>
      </div>
      <div className="tiny muted mt">資料來源：{course.source} · 更新 {course.updated_at}</div>
    </div>
  )
}
