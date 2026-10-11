import { DashboardShell } from '../../shared/components/DashboardShell'
import { useAuth } from '../auth/context/useAuth'

// PLACEHOLDER page. Build each TODO below as its own small component inside this folder
// (for example CandidateFilters.tsx, CandidateCard.tsx, UnlockedList.tsx).
//
// TODO 1 (Candidate search): list candidates from Supabase with these filters:
//   job type (Security / Housekeeping), minimum experience, area, maximum salary, shift,
//   verified only, search by name. Put the filter state in a hook (useCandidateFilters.ts)
//   and the filtering itself in the database query, not in the browser (30,000 candidates is too many).
// TODO 2 (Candidate card): show name, type, experience, area, salary, shift, availability.
//   Show the phone number MASKED (98XXXXX123) until unlocked.
// TODO 3 (Unlock contact): button calls a Supabase database function that, in ONE step:
//   checks the employer is approved, uses a free unlock if left (PRICING.freeUnlocksForNewEmployer),
//   otherwise charges PRICING.pricePerUnlockInr, saves the row in `unlocks`, and returns the phone number.
//   NEVER send the full phone number to the browser before this succeeds.
// TODO 4 (Wallet / payments): buy unlock packs with Razorpay. Add refund-as-credit for wrong numbers.
// TODO 5 (Post jobs): form to create / edit / close jobs, and a list of applicants per job.
// TODO 6 (Company verification): collect company name and GST/CIN. Admin approves before unlocking is allowed.
export function EmployerDashboard() {
  const { user, logout } = useAuth()
  return (
    <DashboardShell title="Employer dashboard" subtitle={`+91 ${user?.phone ?? ''}`} onLogout={logout}>
      <div className="card">
        <h2>Welcome</h2>
        <p className="muted">This page is a placeholder. Open this file and follow the TODO list at the top.</p>
        <ul className="todo">
          <li>Find candidates (with filters)</li>
          <li>Unlocked contacts</li>
          <li>Post a job</li>
        </ul>
      </div>
    </DashboardShell>
  )
}
