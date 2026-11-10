import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import '@xyflow/react/dist/style.css'
import './index.css'
import App from './App'
import { StoreProvider } from './store'
import Home from './pages/Home'
import PathDetail from './pages/PathDetail'
import Compare from './pages/Compare'
import Courses from './pages/Courses'
import CourseDetail from './pages/CourseDetail'
import Planner from './pages/Planner'
import Community from './pages/Community'
import Admin from './pages/Admin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<App />}>
            <Route index element={<Home />} />
            <Route path="paths/:id" element={<PathDetail />} />
            <Route path="compare" element={<Compare />} />
            <Route path="courses" element={<Courses />} />
            <Route path="courses/:id" element={<CourseDetail />} />
            <Route path="planner" element={<Planner />} />
            <Route path="community" element={<Community />} />
            <Route path="admin" element={<Admin />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  </StrictMode>,
)
