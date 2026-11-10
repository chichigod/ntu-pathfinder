/** 全站狀態：使用者名稱、已修課程、學期規劃。存在 localStorage，並可同步到後端儲存。 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Semester } from './api'

export type PlannerSettings = { min_credits: number; max_credits: number; workload_limit: number }

export type PlannerState = {
  owner: string
  planName: string
  planId: number | null
  pathId: string | null
  completed: string[]
  semesters: Semester[]
  settings: PlannerSettings
}

const DEFAULT_STATE: PlannerState = {
  owner: '',
  planName: '我的學習計畫',
  planId: null,
  pathId: null,
  completed: [],
  semesters: [
    { label: '大二上', term: '上', course_ids: [] },
    { label: '大二下', term: '下', course_ids: [] },
  ],
  settings: { min_credits: 12, max_credits: 25, workload_limit: 18 },
}

const STORAGE_KEY = 'ntu-pathfinder-planner'

function load(): PlannerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return DEFAULT_STATE
}

type Store = {
  state: PlannerState
  set: (patch: Partial<PlannerState>) => void
  replace: (next: PlannerState) => void
  toggleCompleted: (courseId: string) => void
  addToSemester: (semesterIndex: number, courseId: string) => void
  removeFromSemester: (semesterIndex: number, courseId: string) => void
  addSemester: () => void
  removeSemester: (index: number) => void
  setSemesters: (semesters: Semester[]) => void
  isCompleted: (courseId: string) => boolean
  plannedIn: (courseId: string) => number
  toast: string | null
  notify: (msg: string) => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlannerState>(load)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* ignore */
    }
  }, [state])

  const notify = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }, [])

  const set = useCallback((patch: Partial<PlannerState>) => setState((s) => ({ ...s, ...patch })), [])
  const replace = useCallback((next: PlannerState) => setState(next), [])

  const toggleCompleted = useCallback((courseId: string) => {
    setState((s) => ({
      ...s,
      completed: s.completed.includes(courseId) ? s.completed.filter((c) => c !== courseId) : [...s.completed, courseId],
      semesters: s.semesters.map((sem) => ({ ...sem, course_ids: sem.course_ids.filter((c) => c !== courseId) })),
    }))
  }, [])

  const addToSemester = useCallback((idx: number, courseId: string) => {
    setState((s) => ({
      ...s,
      completed: s.completed.filter((c) => c !== courseId),
      semesters: s.semesters.map((sem, i) => ({
        ...sem,
        course_ids: i === idx
          ? sem.course_ids.includes(courseId) ? sem.course_ids : [...sem.course_ids, courseId]
          : sem.course_ids.filter((c) => c !== courseId),
      })),
    }))
  }, [])

  const removeFromSemester = useCallback((idx: number, courseId: string) => {
    setState((s) => ({
      ...s,
      semesters: s.semesters.map((sem, i) => (i === idx ? { ...sem, course_ids: sem.course_ids.filter((c) => c !== courseId) } : sem)),
    }))
  }, [])

  const addSemester = useCallback(() => {
    setState((s) => {
      const last = s.semesters[s.semesters.length - 1]
      const next = nextLabel(last?.label ?? '大一下')
      return { ...s, semesters: [...s.semesters, { label: next.label, term: next.term, course_ids: [] }] }
    })
  }, [])

  const removeSemester = useCallback((idx: number) => {
    setState((s) => ({ ...s, semesters: s.semesters.filter((_, i) => i !== idx) }))
  }, [])

  const setSemesters = useCallback((semesters: Semester[]) => setState((s) => ({ ...s, semesters })), [])

  const value = useMemo<Store>(
    () => ({
      state,
      set,
      replace,
      toggleCompleted,
      addToSemester,
      removeFromSemester,
      addSemester,
      removeSemester,
      setSemesters,
      isCompleted: (id) => state.completed.includes(id),
      plannedIn: (id) => state.semesters.findIndex((s) => s.course_ids.includes(id)),
      toast,
      notify,
    }),
    [state, set, replace, toggleCompleted, addToSemester, removeFromSemester, addSemester, removeSemester, setSemesters, toast, notify],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore 必須在 StoreProvider 內使用')
  return s
}

const YEARS = ['一', '二', '三', '四', '五', '六']

export function nextLabel(label: string): { label: string; term: '上' | '下' } {
  const yi = YEARS.findIndex((y) => label.includes(`大${y}`))
  const year = yi >= 0 ? yi : 0
  if (label.includes('上')) return { label: `大${YEARS[year]}下`, term: '下' }
  return { label: `大${YEARS[Math.min(year + 1, YEARS.length - 1)]}上`, term: '上' }
}
