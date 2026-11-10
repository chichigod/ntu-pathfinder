import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { WORKLOAD_LABEL, type Course } from '../api'
import { useStore } from '../store'

export const YEAR_CN = ['', '一', '二', '三', '四', '五', '六']

export function Workload({ value, showLabel = true }: { value: number; showLabel?: boolean }) {
  return (
    <span title={`預估課業負擔 ${value}/5`}>
      <span className="workload-bar">
        {[1, 2, 3, 4, 5].map((i) => (
          <i key={i} className={i <= value ? `on${value >= 5 ? ' hot' : ''}` : ''} />
        ))}
      </span>
      {showLabel && <span className="tiny muted"> {WORKLOAD_LABEL[value]}</span>}
    </span>
  )
}

export function Stars({ value }: { value: number | null | undefined }) {
  if (!value) return <span className="tiny muted">尚無評價</span>
  const full = Math.round(value)
  return (
    <span className="rating" title={`平均推薦度 ${value}/5`}>
      {'★'.repeat(full)}
      {'☆'.repeat(5 - full)} <span className="tiny muted">{value}</span>
    </span>
  )
}

/** 課程狀態標籤：已修 / 已排入某學期。 */
export function StatusTag({ courseId }: { courseId: string }) {
  const { isCompleted, plannedIn, state } = useStore()
  if (isCompleted(courseId)) return <span className="tag accent">已修</span>
  const idx = plannedIn(courseId)
  if (idx >= 0) return <span className="tag primary">{state.semesters[idx].label}</span>
  return null
}

/** 將課程加入某學期或標記已修。 */
export function AddToPlan({ course, compact = false }: { course: Course; compact?: boolean }) {
  const { state, addToSemester, removeFromSemester, toggleCompleted, isCompleted, plannedIn, notify } = useStore()
  const [sel, setSel] = useState('')
  const done = isCompleted(course.id)
  const planned = plannedIn(course.id)

  return (
    <div className="row" style={{ gap: '.4rem' }}>
      <select
        value={sel}
        onChange={(e) => {
          const v = e.target.value
          setSel('')
          if (v === '') return
          if (v === 'done') {
            if (!done) toggleCompleted(course.id)
            notify(`「${course.name}」已標記為已修`)
            return
          }
          const idx = Number(v)
          addToSemester(idx, course.id)
          notify(`「${course.name}」已加入 ${state.semesters[idx].label}`)
        }}
        style={{ padding: '.3rem .5rem', fontSize: '.85rem' }}
      >
        <option value="">{compact ? '加入…' : '加入學期計畫…'}</option>
        {state.semesters.map((s, i) => (
          <option key={i} value={i} disabled={planned === i}>
            {s.label}{planned === i ? '（已排入）' : ''}
          </option>
        ))}
        <option value="done" disabled={done}>標記為已修</option>
      </select>
      {(done || planned >= 0) && (
        <button
          className="btn sm ghost"
          onClick={() => {
            if (done) toggleCompleted(course.id)
            else removeFromSemester(planned, course.id)
            notify(`已移除「${course.name}」`)
          }}
        >
          移除
        </button>
      )}
    </div>
  )
}

export function CourseCard({ course, children }: { course: Course; children?: ReactNode }) {
  return (
    <div className="card compact course-card">
      <div className="row between" style={{ gap: '.4rem' }}>
        <Link to={`/courses/${course.id}`} className="name">{course.name}</Link>
        <span className={`tag level-${course.level}`}>{course.level}</span>
      </div>
      <div className="meta">
        {course.code} · {course.department} · {course.credits} 學分 · {course.terms.join('/')}學期 · 建議大{YEAR_CN[course.suggested_year]}
      </div>
      <div className="meta">{course.slot_text ?? ''}{course.instructor ? ` · ${course.instructor}` : ''}</div>
      <div className="row between">
        <Workload value={course.workload} />
        <Stars value={course.avg_rating} />
      </div>
      <div className="row between">
        <StatusTag courseId={course.id} />
        {children}
      </div>
    </div>
  )
}

export function Loading({ text = '載入中…' }: { text?: string }) {
  return <div className="spinner">{text}</div>
}

export function ErrorBox({ error }: { error: string }) {
  return <div className="alert error">{error}（請確認後端 API 已啟動於 http://localhost:8000）</div>
}
