import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { api, type Meta } from './api'
import { useStore } from './store'

export default function App() {
  const { state, set, toast } = useStore()
  const [meta, setMeta] = useState<Meta | null>(null)
  const [name, setName] = useState(state.owner)

  useEffect(() => {
    api.meta().then(setMeta).catch(() => setMeta(null))
  }, [])

  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <NavLink to="/" className="brand">
            NTU PathFinder <span>beta</span>
          </NavLink>
          <nav className="nav-links">
            <NavLink to="/" end>學習路徑</NavLink>
            <NavLink to="/courses">課程查詢</NavLink>
            <NavLink to="/planner">我的規劃</NavLink>
            <NavLink to="/community">路徑投稿</NavLink>
          </nav>
          <div className="nav-user">
            <span className="tiny">使用者</span>
            <input
              aria-label="使用者暱稱"
              placeholder="輸入暱稱以儲存"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => set({ owner: name.trim() })}
              onKeyDown={(e) => e.key === 'Enter' && set({ owner: name.trim() })}
            />
          </div>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
      <footer className="footer">
        NTU PathFinder — 台大學生個人化學習地圖（第 G 組期末專題）。
        {meta && (
          <>
            {' '}課程資料來源：<a href={meta.data_source_url} target="_blank" rel="noreferrer">{meta.data_source}</a>，更新日期 {meta.data_updated_at}。
            課號與時段為人工整理，選課前請以臺大課程網為準。
          </>
        )}
        {!meta && <> 無法連線到後端 API，請先啟動 backend（port 8000）。</>}
      </footer>
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
