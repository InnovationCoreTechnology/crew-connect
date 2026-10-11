import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { PublicOnly } from './app/PublicOnly'
import { RequireRole } from './app/RequireRole'
import { PATHS } from './app/paths'
import { AuthPage } from './features/auth/AuthPage'
import { AuthProvider } from './features/auth/context/AuthProvider'
import { CandidateDashboard } from './features/candidate/CandidateDashboard'
import { EmployerDashboard } from './features/employer/EmployerDashboard'

// This file only connects pages to addresses. Keep it small.
// To ADD a feature: create a folder in src/features, then add one <Route> here.
// To REMOVE a feature: delete its <Route> here, then delete its folder.
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path={PATHS.login} element={<PublicOnly><AuthPage /></PublicOnly>} />
          <Route path={PATHS.candidate} element={<RequireRole role="candidate"><CandidateDashboard /></RequireRole>} />
          <Route path={PATHS.employer} element={<RequireRole role="employer"><EmployerDashboard /></RequireRole>} />
          {/* TODO (Admin): add an admin Route here. Admin should NOT be self-registered:
              create admin users manually in Supabase and give them role 'admin'. */}
          <Route path="*" element={<Navigate to={PATHS.login} replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
// TODO (Deploy): BrowserRouter needs a "rewrite all paths to index.html" rule on the host,
// or refreshing /employer shows a 404. On Vercel, add web/vercel.json:
// { "rewrites": [{ "source": "/(.*)", "destination": "/" }] }
