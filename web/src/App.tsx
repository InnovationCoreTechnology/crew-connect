import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './app/ErrorBoundary'
import { PublicOnly } from './app/PublicOnly'
import { RequireRole } from './app/RequireRole'
import { PATHS } from './app/paths'
import { AuthPage } from './features/auth/AuthPage'
import { AuthProvider } from './features/auth/context/AuthProvider'

// Each dashboard is downloaded only when its role logs in, so the login page stays small and fast
// (performance budget: DEVELOPMENT_ROADMAP.md section 5). The dashboards use named exports, hence the .then().
const AdminDashboard = lazy(() => import('./features/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })))
const CandidateDashboard = lazy(() => import('./features/candidate/CandidateDashboard').then((m) => ({ default: m.CandidateDashboard })))
const EmployerDashboard = lazy(() => import('./features/employer/EmployerDashboard').then((m) => ({ default: m.EmployerDashboard })))

// This file only connects pages to addresses. Keep it small.
// To ADD a feature: create a folder in src/features, then add one <Route> here.
// To REMOVE a feature: delete its <Route> here, then delete its folder.
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<p className="center-note">Loading…</p>}>
            <Routes>
              <Route path={PATHS.login} element={<PublicOnly><AuthPage /></PublicOnly>} />
              <Route path={PATHS.candidate} element={<RequireRole role="candidate"><CandidateDashboard /></RequireRole>} />
              <Route path={PATHS.employer} element={<RequireRole role="employer"><EmployerDashboard /></RequireRole>} />
              <Route path={PATHS.admin} element={<RequireRole role="admin"><AdminDashboard /></RequireRole>} />
              <Route path="*" element={<Navigate to={PATHS.login} replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
// TODO (Deploy, Phase 2.1): BrowserRouter needs a "rewrite all paths to index.html" rule on the host,
// or refreshing /employer shows a 404. Cloudflare's exact setting must be taken from its official docs then.
