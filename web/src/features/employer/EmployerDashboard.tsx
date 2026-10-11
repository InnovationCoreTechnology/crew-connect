import { useState } from 'react'
import { PRICING } from '../../app/config'
import { getEmployerAccount } from '../../data/api'
import { unlockBlockReason } from '../../data/rules'
import { DashboardShell } from '../../shared/components/DashboardShell'
import { StatsRow } from '../../shared/components/StatsRow'
import { Tabs } from '../../shared/components/Tabs'
import { formatInr } from '../../shared/format'
import { useResource } from '../../shared/hooks/useResource'
import { useAuth } from '../auth/context/useAuth'
import { FindCandidatesTab } from './FindCandidatesTab'
import { UnlockedTab } from './UnlockedTab'

// Employer screen = stat cards + tabs. Each tab is its own file.
// TODO (Post jobs): form to create / edit / close jobs, and a list of applicants per job (new tab + new file).
// TODO (Payments): buy unlock packs with Razorpay (for example ₹300 for 10 unlocks).
// TODO (Company verification): collect company name and GST/CIN; admin approves before unlocking is allowed.
export function EmployerDashboard() {
  const { user, logout } = useAuth()
  const phone = user?.phone ?? ''
  const accountRes = useResource(getEmployerAccount)
  const [tab, setTab] = useState('find')
  const account = accountRes.data
  const blockReason = account ? unlockBlockReason(account) : ''

  return (
    <DashboardShell title={account?.companyName || 'Employer dashboard'} subtitle={`+91 ${phone}`} onLogout={logout}>
      {!accountRes.data && accountRes.loading && <p className="center-note">Loading…</p>}
      {accountRes.error && <p className="ferr" role="alert">{accountRes.error}</p>}
      {account && (
        <>
          {blockReason && <div className={`banner ${account.status === 'Blocked' ? 'bad' : 'warn'}`}>{blockReason}</div>}
          <StatsRow items={[
            { label: 'Free unlocks left', value: account.freeUnlocksLeft },
            { label: 'Candidates unlocked', value: account.unlockedCount },
            { label: 'Spent', value: formatInr(account.spentInr) },
            { label: 'Price per unlock', value: formatInr(PRICING.pricePerUnlockInr), note: 'after free unlocks' },
          ]} />
          <Tabs
            items={[{ key: 'find', label: 'Find candidates' }, { key: 'unlocked', label: `Unlocked (${account.unlockedCount})` }]}
            active={tab}
            onChange={setTab}
          />
          {tab === 'find' && <FindCandidatesTab account={account} canUnlock={!blockReason} onAccountChange={accountRes.setData} />}
          {tab === 'unlocked' && <UnlockedTab />}
        </>
      )}
    </DashboardShell>
  )
}
