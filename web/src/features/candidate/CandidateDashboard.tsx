import { useCallback, useState } from 'react'
import { getCandidateProfile } from '../../data/api'
import { isProfileComplete } from '../../data/rules'
import { DashboardShell } from '../../shared/components/DashboardShell'
import { Tabs } from '../../shared/components/Tabs'
import { useResource } from '../../shared/hooks/useResource'
import { useAuth } from '../auth/context/useAuth'
import { ApplicationsTab } from './ApplicationsTab'
import { JobsTab } from './JobsTab'
import { ProfileForm } from './ProfileForm'

// Candidate screen = tabs. Each tab is its own file, so adding or removing one is easy.
// TODO (Job alerts): push notification when a matching job is posted (Firebase Cloud Messaging).
// TODO (Documents): optional resume / ID photo upload (Supabase Storage). Do NOT store Aadhaar numbers.
export function CandidateDashboard() {
  const { user, logout } = useAuth()
  const userId = user?.id ?? ''
  const phone = user?.phone ?? ''
  const loader = useCallback(() => getCandidateProfile(userId, phone), [userId, phone])
  const profileRes = useResource(loader)
  const [tab, setTab] = useState('profile')
  const profile = profileRes.data

  return (
    <DashboardShell title="Candidate dashboard" subtitle={`+91 ${phone}`} onLogout={logout}>
      {!profileRes.data && profileRes.loading && <p className="center-note">Loading…</p>}
      {profileRes.error && <p className="ferr" role="alert">{profileRes.error}</p>}
      {profile && (
        <>
          {profile.blocked && <div className="banner bad">Your account is blocked, so you cannot apply for jobs. Please contact support.</div>}
          {!profile.blocked && !isProfileComplete(profile) && (
            <div className="banner warn">Complete your profile to apply for jobs and to appear in employer searches.</div>
          )}
          <Tabs
            items={[{ key: 'profile', label: 'My profile' }, { key: 'jobs', label: 'Find jobs' }, { key: 'apps', label: 'Applications' }]}
            active={tab}
            onChange={setTab}
          />
          {tab === 'profile' && <ProfileForm key={profile.id} profile={profile} onSaved={profileRes.reload} />}
          {tab === 'jobs' && <JobsTab profile={profile} onGoToProfile={() => setTab('profile')} />}
          {tab === 'apps' && <ApplicationsTab candidateId={profile.id} />}
        </>
      )}
    </DashboardShell>
  )
}
