import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, DAY_NAMES, PERIOD_TIMES, type CheckResult, type Course, type Issue, type PathSummary, type Plan } from '../api'
import { ErrorBox, Loading, Workload } from '../components/shared'
import { useStore } from '../store'

export default function Planner() {
  const store = useStore()
  const { state, set, toggleCompleted, addToSemester, removeFromSemester, addSemester, removeSemester, setSemesters, replace, notify } = store
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [paths, setPaths] = useState<PathSummary[]>([])
  const [error, setError] = useState('')
  const [check, setCheck] = useState<CheckResult | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [viewSem, setViewSem] = useState(0)
  const [filter, setFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [pathCourseIds, setPathCourseIds] = useState<string[]>([])

  useEffect(() => {
    api.courses().then(setCourses).catch((e) => setError(e.message))
    api.paths().then(setPaths).catch(() => {})
  }, [])

  // 目標路徑的課程：加入課程下拉選單時優先列出，其餘依系所分組
  useEffect(() => {
    let alive = true
    if (!state.pathId) return setPathCourseIds([])
    api.path(state.pathId)
      .then((p) => { if (alive) setPathCourseIds(p.courses.map((c) => c.id)) })
      .catch(() => { if (alive) setPathCourseIds([]) })
    return () => { alive = false }
  }, [state.pathId])

  const loadPlans = () => {
    if (!state.owner) return setPlans([])
    api.plans(state.owner).then(setPlans).catch(() => {})
  }
  useEffect(loadPlans, [state.owner])

  // 任何變更都重新檢查（去抖動）
  useEffect(() => {
    const t = window.setTimeout(() => {
      api.checkPlan({ completed_course_ids: state.completed, semesters: state.semesters, ...state.settings })
        .then(setCheck)
        .catch((e) => setError(e.message))
    }, 250)
    return () => window.clearTimeout(t)
  }, [state.completed, state.semesters, state.settings])

  const byId = useMemo(() => new Map(courses?.map((c) => [c.id, c]) ?? []), [courses])
  const issueMap = useMemo(() => {
    const m = new Map<string, Issue['level']>()
    check?.semesters.forEach((s, si) =>
      s.issues.forEach((i) =>
        i.course_ids.forEach((cid) => {
          if (!state.semesters[si]?.course_ids.includes(cid)) return
          const key = `${si}:${cid}`
          const cur = m.get(key)
          if (i.level === 'error' || (i.level === 'warning' && cur !== 'error')) m.set(key, i.level)
        }),
      ),
    )
    return m
  }, [check, state.semesters])

  if (error) return <ErrorBox error={error} />
  if (!courses) return <Loading />

  const totalPlannedCredits = state.semesters.reduce((s, sem) => s + sem.course_ids.reduce((a, c) => a + (byId.get(c)?.credits ?? 0), 0), 0)
  const completedCredits = state.completed.reduce((a, c) => a + (byId.get(c)?.credits ?? 0), 0)

  const savePlan = async () => {
    if (!state.owner) return notify('請先在右上角輸入暱稱，才能儲存到伺服器')
    setSaving(true)
    const body = {
      owner: state.owner, name: state.planName, path_id: state.pathId,
      completed_course_ids: state.completed, semesters: state.semesters, settings: state.settings,
    }
    try {
      const saved = state.planId ? await api.updatePlan(state.planId, body) : await api.createPlan(body)
      set({ planId: saved.id })
      notify(`已儲存「${saved.name}」`)
      loadPlans()
    } catch (e) {
      // 若原計畫已不存在，改為新建
      try {
        const saved = await api.createPlan(body)
        set({ planId: saved.id })
        notify(`已另存為新計畫「${saved.name}」`)
        loadPlans()
      } catch (e2) {
        notify(`儲存失敗：${(e2 as Error).message}`)
      }
      void e
    } finally {
      setSaving(false)
    }
  }

  const loadPlan = (p: Plan) => {
    replace({
      ...state, planId: p.id, planName: p.name, pathId: p.path_id,
      completed: p.completed_course_ids, semesters: p.semesters,
      settings: { ...state.settings, ...(p.settings as typeof state.settings) },
    })
    notify(`已載入「${p.name}」`)
  }

  const deletePlan = async (p: Plan) => {
    if (!window.confirm(`確定刪除「${p.name}」？`)) return
    try {
      await api.deletePlan(p.id, state.owner)
      if (state.planId === p.id) set({ planId: null })
      loadPlans()
      notify('已刪除')
    } catch (e) {
      notify(`刪除失敗：${(e as Error).message}`)
    }
  }

  const newPlan = () => {
    set({ planId: null, planName: '新的學習計畫', semesters: [{ label: '大二上', term: '上', course_ids: [] }, { label: '大二下', term: '下', course_ids: [] }] })
  }

  const autoPlan = async () => {
    if (!state.pathId) return notify('請先選擇目標學習路徑')
    const first = state.semesters[0] ?? { label: '大二上', term: '上' }
    try {
      const r = await api.suggest({
        path_id: state.pathId, completed_course_ids: state.completed, start_label: first.label, start_term: first.term,
        num_semesters: Math.max(state.semesters.length, 4), max_credits: Math.min(state.settings.max_credits, 18),
        workload_limit: Math.min(state.settings.workload_limit, 16),
      })
      setSemesters(r.semesters)
      notify(r.unscheduled.length ? `已產生建議，${r.unscheduled.length} 門課未排入（${r.unscheduled.map((u) => `${byId.get(u.course_id)?.name}：${u.reason}`).join('；')}）` : '已產生建議計畫')
    } catch (e) {
      notify(`排課失敗：${(e as Error).message}`)
    }
  }

  const filtered = courses.filter((c) => !filter || c.name.includes(filter) || c.code.toLowerCase().includes(filter.toLowerCase()))
  const viewSemester = state.semesters[Math.min(viewSem, state.semesters.length - 1)]

  // 加入課程下拉選單的分組：目標路徑課程優先，其餘依系所分組（避免某一系所的課程佔滿清單前段）
  const addGroups = (sem: { course_ids: string[] }) => {
    const candidates = courses.filter((c) => !state.completed.includes(c.id) && !sem.course_ids.includes(c.id))
    const pathSet = new Set(pathCourseIds)
    const groups: { label: string; items: Course[] }[] = []
    if (pathSet.size) {
      const inPath = candidates.filter((c) => pathSet.has(c.id))
      if (inPath.length) groups.push({ label: '目標路徑的課程', items: inPath })
    }
    const rest = candidates.filter((c) => !pathSet.has(c.id))
    const depts = [...new Set(rest.map((c) => c.department))].sort((x, y) => x.localeCompare(y, 'zh-Hant'))
    depts.forEach((d) => groups.push({ label: pathSet.size ? `其他 · ${d}` : d, items: rest.filter((c) => c.department === d) }))
    return groups
  }

  return (
    <>
      <div className="row between mb">
        <div>
          <h1>我的學習規劃</h1>
          <p className="muted">輸入已修課程，把推薦課程排入未來學期。系統即時檢查衝堂、學分上下限、先修條件、開課學期與課業負擔。</p>
        </div>
      </div>

      {/* 總覽與檢查結果 */}
      <div className="grid cols-4 mb">
        <div className="card compact"><div className="tiny muted">已修學分</div><b style={{ fontSize: '1.3rem' }}>{completedCredits}</b> 學分 · {state.completed.length} 門</div>
        <div className="card compact"><div className="tiny muted">規劃中</div><b style={{ fontSize: '1.3rem' }}>{totalPlannedCredits}</b> 學分 · {state.semesters.length} 學期</div>
        <div className="card compact">
          <div className="tiny muted">檢查結果</div>
          {check ? (
            <span>
              <span className={`tag ${check.summary.error ? 'danger' : 'accent'}`}>{check.summary.error} 錯誤</span>{' '}
              <span className="tag warn">{check.summary.warning} 警告</span>{' '}
              <span className="tag info">{check.summary.info} 提示</span>
            </span>
          ) : <span className="muted small">檢查中…</span>}
        </div>
        <div className="card compact">
          <div className="tiny muted">目標路徑</div>
          <select aria-label="目標路徑" value={state.pathId ?? ''} onChange={(e) => set({ pathId: e.target.value || null })} style={{ width: '100%', padding: '.3rem' }}>
            <option value="">（未選擇）</option>
            {paths.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
      </div>

      <div className="detail-layout">
        <div className="stack">
          {/* 學期欄位 */}
          <div className="card">
            <div className="row between mb">
              <h3 style={{ margin: 0 }}>學期規劃</h3>
              <div className="row">
                <button className="btn sm accent" onClick={autoPlan}>依路徑自動排課</button>
                <button className="btn sm" onClick={addSemester}>+ 新增學期</button>
              </div>
            </div>
            <div className="grid cols-2">
              {state.semesters.map((sem, si) => {
                const rep = check?.semesters[si]
                return (
                  <div key={si} className="semester-col">
                    <h4>
                      <span className="row" style={{ gap: '.3rem' }}>
                        <input aria-label="學期名稱" value={sem.label} onChange={(e) => setSemesters(state.semesters.map((s, i) => (i === si ? { ...s, label: e.target.value } : s)))} style={{ width: 80, padding: '.15rem .4rem', fontSize: '.85rem' }} />
                        <select aria-label="上下學期" value={sem.term} onChange={(e) => setSemesters(state.semesters.map((s, i) => (i === si ? { ...s, term: e.target.value as '上' | '下' } : s)))} style={{ padding: '.15rem .3rem', fontSize: '.85rem' }}>
                          <option value="上">上</option><option value="下">下</option>
                        </select>
                      </span>
                      <span className="tiny muted">
                        {rep ? `${rep.credits} 學分 · 負擔 ${rep.workload}` : ''}
                        <button className="btn sm ghost" onClick={() => setViewSem(si)} title="查看週課表">📅</button>
                        <button className="btn sm ghost" onClick={() => removeSemester(si)} title="刪除學期">✕</button>
                      </span>
                    </h4>
                    {sem.course_ids.map((cid) => {
                      const c = byId.get(cid)
                      const lv = issueMap.get(`${si}:${cid}`)
                      return (
                        <div key={cid} className={`item ${lv === 'error' ? 'bad' : lv === 'warning' ? 'warn' : ''}`}>
                          <span><Link to={`/courses/${cid}`}>{c?.name ?? cid}</Link> <span className="tiny muted">{c?.credits} 學分</span></span>
                          <span className="row" style={{ gap: '.2rem' }}>
                            {c && <Workload value={c.workload} showLabel={false} />}
                            <button onClick={() => removeFromSemester(si, cid)} title="移除">✕</button>
                          </span>
                        </div>
                      )
                    })}
                    <div className="add-row">
                      <select aria-label={`加入課程到 ${sem.label}`} value="" onChange={(e) => { if (e.target.value) addToSemester(si, e.target.value) }}>
                        <option value="">+ 加入課程…</option>
                        {addGroups(sem).map((g) => (
                          <optgroup key={g.label} label={g.label}>
                            {g.items.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}（{c.credits} 學分，{c.terms.join('/')}）</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    {rep && rep.issues.length > 0 && (
                      <div className="stack mt" style={{ gap: '.3rem' }}>
                        {rep.issues.map((i, k) => <div key={k} className={`alert ${i.level}`} style={{ padding: '.3rem .5rem', fontSize: '.8rem' }}>{i.message}</div>)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {state.semesters.length === 0 && <div className="empty">尚無學期，按「新增學期」開始規劃。</div>}
          </div>

          {/* 週課表 */}
          {viewSemester && (
            <div className="card">
              <div className="row between mb">
                <h3 style={{ margin: 0 }}>週課表 · {viewSemester.label}</h3>
                <select aria-label="選擇課表學期" value={Math.min(viewSem, state.semesters.length - 1)} onChange={(e) => setViewSem(Number(e.target.value))}>
                  {state.semesters.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
                </select>
              </div>
              <Timetable courses={viewSemester.course_ids.map((c) => byId.get(c)).filter((c): c is Course => !!c)} />
              <div className="tiny muted mt">「專題研究」等時間另訂的課程不會顯示在課表中。紅色代表衝堂。</div>
            </div>
          )}
        </div>

        <aside className="stack">
          {/* 儲存 */}
          <div className="card">
            <h3>儲存計畫</h3>
            <label className="field">計畫名稱
              <input value={state.planName} onChange={(e) => set({ planName: e.target.value })} />
            </label>
            <div className="row mt">
              <button className="btn primary" onClick={savePlan} disabled={saving}>{state.planId ? '更新到伺服器' : '儲存到伺服器'}</button>
              <button className="btn" onClick={newPlan}>新計畫</button>
            </div>
            <div className="tiny muted mt">目前規劃會自動保存在這台瀏覽器；儲存到伺服器後可在其他裝置以相同暱稱載入。</div>
            {state.owner && plans.length > 0 && (
              <div className="mt">
                <b className="small">「{state.owner}」的計畫</b>
                {plans.map((p) => (
                  <div key={p.id} className="row between" style={{ padding: '.3rem 0', borderTop: '1px solid var(--border)' }}>
                    <span className="small">{p.name}{state.planId === p.id && <span className="tag primary" style={{ marginLeft: 4 }}>目前</span>}<div className="tiny muted">更新 {p.updated_at.replace('T', ' ')}</div></span>
                    <span className="row" style={{ gap: '.2rem' }}>
                      <button className="btn sm" onClick={() => loadPlan(p)}>載入</button>
                      <button className="btn sm danger" onClick={() => deletePlan(p)}>刪除</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 設定 */}
          <div className="card">
            <h3>修課限制</h3>
            <div className="row">
              <label className="field">學分下限<input type="number" value={state.settings.min_credits} onChange={(e) => set({ settings: { ...state.settings, min_credits: Number(e.target.value) } })} style={{ width: 70 }} /></label>
              <label className="field">學分上限<input type="number" value={state.settings.max_credits} onChange={(e) => set({ settings: { ...state.settings, max_credits: Number(e.target.value) } })} style={{ width: 70 }} /></label>
              <label className="field">負擔上限<input type="number" value={state.settings.workload_limit} onChange={(e) => set({ settings: { ...state.settings, workload_limit: Number(e.target.value) } })} style={{ width: 70 }} /></label>
            </div>
            <div className="tiny muted mt">臺大一般學期學分下限 12（大四 9）、上限 25。負擔指數為各課「預估課業負擔 1~5」加總。</div>
          </div>

          {/* 已修課程 */}
          <div className="card">
            <h3>已修課程（{state.completed.length}）</h3>
            <input aria-label="篩選已修課程" placeholder="篩選課名或課號" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: '100%' }} className="mb" />
            <div className="scroll-list">
              {filtered.map((c) => (
                <label key={c.id} className="check">
                  <input type="checkbox" checked={state.completed.includes(c.id)} onChange={() => toggleCompleted(c.id)} />
                  <span style={{ flex: 1 }}>{c.name} <span className="tiny muted">{c.code} · {c.credits} 學分</span></span>
                </label>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}

function Timetable({ courses }: { courses: Course[] }) {
  const periods = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  const days = [1, 2, 3, 4, 5]
  const cell = new Map<string, Course[]>()
  courses.forEach((c) => c.slots.forEach((s) => s.periods.forEach((p) => {
    const key = `${s.day}-${p}`
    cell.set(key, [...(cell.get(key) ?? []), c])
  })))
  return (
    <table className="timetable">
      <thead>
        <tr><th style={{ width: 54 }}>節次</th>{days.map((d) => <th key={d}>週{DAY_NAMES[d]}</th>)}</tr>
      </thead>
      <tbody>
        {periods.map((p) => (
          <tr key={p}>
            <th>{p}<span className="time">{PERIOD_TIMES[p]}</span></th>
            {days.map((d) => {
              const cs = cell.get(`${d}-${p}`) ?? []
              return (
                <td key={d} className={cs.length > 1 ? 'clash' : cs.length ? 'filled' : ''} title={cs.map((c) => c.name).join(' / ')}>
                  {cs.map((c) => c.name).join(' / ')}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
