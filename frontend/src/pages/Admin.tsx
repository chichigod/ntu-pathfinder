import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Submission } from '../api'
import { useStore } from '../store'

export default function Admin() {
  const { notify } = useStore()
  const [token, setToken] = useState('')
  const [subs, setSubs] = useState<Submission[] | null>(null)
  const [error, setError] = useState('')

  const load = async (t = token) => {
    setError('')
    try {
      setSubs(await api.submissions('all', t))
    } catch (e) {
      setSubs(null)
      setError((e as Error).message)
    }
  }

  const review = async (s: Submission, action: 'approve' | 'reject') => {
    try {
      await api.reviewSubmission(s.id, action, token)
      notify(action === 'approve' ? '已核准公開' : '已退回')
      load()
    } catch (e) {
      notify(`操作失敗：${(e as Error).message}`)
    }
  }

  const label: Record<Submission['status'], string> = { pending: '待審核', approved: '已公開', rejected: '已退回' }
  const tone: Record<Submission['status'], string> = { pending: 'warn', approved: 'accent', rejected: 'danger' }

  return (
    <>
      <h1>管理員審核</h1>
      <p className="muted">審核學生投稿的學習路徑。預設管理員密碼為 <code>ntu-admin</code>（可用環境變數 ADMIN_TOKEN 更改）。<Link to="/community" className="small"> ← 回投稿區</Link></p>
      <div className="card row mb">
        <input type="password" aria-label="管理員密碼" placeholder="管理員密碼" value={token} onChange={(e) => setToken(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        <button className="btn primary" onClick={() => load()}>登入並載入</button>
        {error && <span className="alert error" style={{ padding: '.3rem .6rem' }}>{error}</span>}
      </div>
      {subs && (
        <table className="table card" style={{ padding: 0 }}>
          <thead>
            <tr><th>狀態</th><th>標題 / 作者</th><th>目標</th><th>課程</th><th>讚</th><th>操作</th></tr>
          </thead>
          <tbody>
            {[...subs].sort((a, b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1)).map((s) => (
              <tr key={s.id}>
                <td><span className={`tag ${tone[s.status]}`}>{label[s.status]}</span></td>
                <td><b>{s.title}</b><div className="tiny muted">{s.author} · {s.created_at.replace('T', ' ')}</div><div className="small">{s.description}</div></td>
                <td>{s.goal}</td>
                <td className="small">{s.courses?.map((c) => c.name).join(' → ')}</td>
                <td>{s.likes}</td>
                <td>
                  <div className="row" style={{ gap: '.3rem' }}>
                    {s.status !== 'approved' && <button className="btn sm accent" onClick={() => review(s, 'approve')}>核准</button>}
                    {s.status !== 'rejected' && <button className="btn sm danger" onClick={() => review(s, 'reject')}>退回</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
