import { PRICING } from '../../app/config'
import type { AuthMode, SignupRole } from './types'

// The words shown on the left side of the login page. Edit text here, not in the component.
export function getAuthCopy(mode: AuthMode, role: SignupRole): { title: string; points: string[] } {
  const free = PRICING.freeUnlocksForNewEmployer
  if (mode !== 'register') {
    return {
      title: 'Security and housekeeping jobs',
      points: ['Free for job seekers', 'Verified candidates for employers', `New employers get ${free} free candidate contacts`],
    }
  }
  if (role === 'employer') {
    return {
      title: 'Hire security and housekeeping staff',
      points: ['Filter by area, shift and experience', 'Find verified candidates', `New employers get ${free} free candidate contacts`],
    }
  }
  return {
    title: 'Find security and housekeeping jobs',
    points: ['Always free for job seekers', 'Create your profile once', 'Apply to jobs in your area'],
  }
}
