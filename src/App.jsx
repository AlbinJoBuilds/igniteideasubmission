import { Routes, Route, Navigate } from 'react-router-dom'
import PixelBlast from './components/PixelBlast.jsx'
import TeamEntry from './pages/TeamEntry.jsx'
import SprintScreen from './pages/SprintScreen.jsx'
import SubmissionScreen from './pages/SubmissionScreen.jsx'
import LiveBoard from './pages/LiveBoard.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import { getAdminToken } from './supabaseClient.js'

function RequireAdmin({ children }) {
  return getAdminToken() ? children : <Navigate to="/admin" replace />
}

export default function App() {
  return (
    <div className="app-shell">
      <PixelBlast />
      <div className="app-content">
        <Routes>
          <Route path="/" element={<TeamEntry />} />
          <Route path="/sprint" element={<SprintScreen />} />
          <Route path="/submit" element={<SubmissionScreen />} />
          <Route path="/board" element={<LiveBoard />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route
            path="/admin/panel"
            element={
              <RequireAdmin>
                <AdminPanel />
              </RequireAdmin>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  )
}
