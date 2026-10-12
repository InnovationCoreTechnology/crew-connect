import { useState } from 'react'
import { isProfileComplete } from '../../data/rules'
import type { CandidateProfile } from '../../data/types'
import { ProfileForm } from './ProfileForm'
import { ProfileView } from './ProfileView'

// "My profile" tab: a first-time candidate (no name yet) fills the form; once saved, the finished profile is shown
// and the form opens again only through "Edit profile".
export function ProfileTab({ profile, onSaved }: { profile: CandidateProfile; onSaved: () => void }) {
  const [editing, setEditing] = useState(!isProfileComplete(profile))
  const [justSaved, setJustSaved] = useState(false)

  if (editing) {
    return (
      <ProfileForm
        profile={profile}
        onSaved={() => { onSaved(); setJustSaved(true); setEditing(false) }}
        onCancel={isProfileComplete(profile) ? () => setEditing(false) : undefined}
      />
    )
  }
  return <ProfileView profile={profile} justSaved={justSaved} onEdit={() => { setJustSaved(false); setEditing(true) }} />
}
