/** 與後端 FastAPI 溝通的型別與函式。開發時由 vite.config.ts 將 /api 代理到 localhost:8000。 */

export type Prereq = { course_id: string; type: 'hard' | 'suggested' }
export type Slot = { day: number; periods: number[] }

export type Course = {
  id: string
  code: string
  name: string
  name_en: string
  department: string
  credits: number
  level: string
  suggested_year: number
  terms: string[]
  instructor: string
  slots: Slot[]
  slot_text?: string
  prerequisites: Prereq[]
  workload: number
  workload_note: string
  description: string
  resources: { title: string; url: string; type: string }[]
  source: string
  source_url: string
  updated_at: string
  review_count?: number
  avg_rating?: number | null
  avg_workload?: number | null
}

export type Review = {
  id: number
  course_id: string
  author: string
  rating: number
  workload: number
  comment: string
  semester: string
  created_at: string
}

export type CourseDetail = Course & {
  prerequisite_courses: (Prereq & { name: string; code: string })[]
  unlocks: { course_id: string; name: string; code: string; type: 'hard' | 'suggested' }[]
  in_paths: { path_id: string; title: string }[]
  reviews: Review[]
}

export type Skill = { name: string; description: string; course_ids: string[]; reason: string }
export type Stage = { label: string; year: number; term: string; course_ids: string[] }

export type PathSummary = {
  id: string
  title: string
  category: string
  summary: string
  keywords: string[]
  course_count: number
  total_credits: number
  skill_count: number
  score: number
  matched: string[]
  updated_at: string
  verified_by: string
}

export type PathDetail = {
  id: string
  title: string
  category: string
  keywords: string[]
  summary: string
  job_description: string
  skills: Skill[]
  stages: Stage[]
  related_paths: { id: string; title: string }[]
  verified_by: string
  sources: { title: string; url: string }[]
  updated_at: string
  courses: Course[]
  edges: { source: string; target: string; type: 'hard' | 'suggested' }[]
  total_credits: number
  favorite_count: number
}

export type Semester = { label: string; term: '上' | '下'; course_ids: string[] }

export type Issue = { level: 'error' | 'warning' | 'info'; kind: string; message: string; course_ids: string[] }
export type CheckResult = {
  ok: boolean
  summary: { error: number; warning: number; info: number }
  unknown_course_ids: string[]
  semesters: { label: string; term: string; credits: number; workload: number; issues: Issue[] }[]
}

export type SuggestResult = {
  semesters: Semester[]
  unscheduled: { course_id: string; reason: string }[]
}

export type Plan = {
  id: number
  owner: string
  name: string
  path_id: string | null
  completed_course_ids: string[]
  semesters: Semester[]
  settings: Record<string, number>
  created_at: string
  updated_at: string
}

export type Submission = {
  id: number
  author: string
  title: string
  goal: string
  description: string
  course_ids: string[]
  courses?: { id: string; name: string; code: string }[]
  status: 'pending' | 'approved' | 'rejected'
  likes: number
  comments: { author: string; text: string; created_at: string }[]
  created_at: string
}

export type Compare = {
  a: { id: string; title: string; total_credits: number; skills: string[] }
  b: { id: string; title: string; total_credits: number; skills: string[] }
  common: CompareCourse[]
  only_a: CompareCourse[]
  only_b: CompareCourse[]
}
export type CompareCourse = { id: string; name: string; code: string; credits: number; level: string; workload: number }

export type Meta = {
  name: string
  data_updated_at: string
  data_source: string
  data_source_url: string
  departments: string[]
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* ignore */
    }
    throw new Error(detail || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

const qs = (params: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') p.set(k, String(v))
  })
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const api = {
  meta: () => request<Meta>('/api/meta'),
  courses: (params: { q?: string; department?: string; level?: string; term?: string } = {}) =>
    request<Course[]>(`/api/courses${qs(params)}`),
  course: (id: string) => request<CourseDetail>(`/api/courses/${id}`),
  addReview: (id: string, body: Omit<Review, 'id' | 'course_id' | 'created_at'>) =>
    request<Review>(`/api/courses/${id}/reviews`, { method: 'POST', body: JSON.stringify(body) }),

  paths: (q = '') => request<PathSummary[]>(`/api/paths${qs({ q })}`),
  path: (id: string) => request<PathDetail>(`/api/paths/${id}`),
  compare: (a: string, b: string) => request<Compare>(`/api/paths/${a}/compare/${b}`),

  checkPlan: (body: {
    completed_course_ids: string[]
    semesters: Semester[]
    min_credits: number
    max_credits: number
    workload_limit: number
  }) => request<CheckResult>('/api/plans/check', { method: 'POST', body: JSON.stringify(body) }),
  suggest: (body: {
    path_id: string
    completed_course_ids: string[]
    start_label: string
    start_term: string
    num_semesters: number
    max_credits: number
    workload_limit: number
  }) => request<SuggestResult>('/api/plans/suggest', { method: 'POST', body: JSON.stringify(body) }),
  plans: (owner: string) => request<Plan[]>(`/api/plans${qs({ owner })}`),
  createPlan: (body: Omit<Plan, 'id' | 'created_at' | 'updated_at'>) =>
    request<Plan>('/api/plans', { method: 'POST', body: JSON.stringify(body) }),
  updatePlan: (id: number, body: Omit<Plan, 'id' | 'created_at' | 'updated_at'>) =>
    request<Plan>(`/api/plans/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePlan: (id: number, owner: string) =>
    request<void>(`/api/plans/${id}${qs({ owner })}`, { method: 'DELETE' }),

  submissions: (status = 'approved', token = '') =>
    request<Submission[]>(`/api/submissions${qs({ status, token })}`),
  createSubmission: (body: { author: string; title: string; goal: string; description: string; course_ids: string[] }) =>
    request<Submission>('/api/submissions', { method: 'POST', body: JSON.stringify(body) }),
  likeSubmission: (id: number) => request<{ id: number; likes: number }>(`/api/submissions/${id}/like`, { method: 'POST' }),
  commentSubmission: (id: number, body: { author: string; text: string }) =>
    request<Submission>(`/api/submissions/${id}/comments`, { method: 'POST', body: JSON.stringify(body) }),
  reviewSubmission: (id: number, action: 'approve' | 'reject', token: string) =>
    request<Submission>(`/api/submissions/${id}/review${qs({ action, token })}`, { method: 'POST' }),

  favorites: (owner: string) => request<{ target_type: string; target_id: string }[]>(`/api/favorites${qs({ owner })}`),
  toggleFavorite: (body: { owner: string; target_type: string; target_id: string }) =>
    request<{ favorited: boolean }>('/api/favorites', { method: 'POST', body: JSON.stringify(body) }),
}

export const DAY_NAMES = ['', '一', '二', '三', '四', '五', '六', '日']
export const PERIOD_TIMES: Record<number, string> = {
  1: '8:10', 2: '9:10', 3: '10:20', 4: '11:20', 5: '12:20', 6: '13:20', 7: '14:20', 8: '15:30', 9: '16:30', 10: '17:30',
}

export function slotText(slots: Slot[]): string {
  if (!slots.length) return '時間另訂'
  return slots.map((s) => `週${DAY_NAMES[s.day]} ${s.periods.join('/')} 節`).join('、')
}

export const WORKLOAD_LABEL = ['', '輕鬆', '偏輕', '中等', '偏重', '極重']
