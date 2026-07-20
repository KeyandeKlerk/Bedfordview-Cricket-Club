// Guardian/dependent helpers. Age threshold is a soft UX nudge only —
// never enforced by RLS or the DB. A player at or above this age is
// nudged to claim their own login; a guardian can still manage a player
// of any age until that player actually claims their profile.
export const CLAIM_AGE_THRESHOLD = 15

export function age(dob: string, at: Date = new Date()): number {
  const d = new Date(dob)
  let a = at.getFullYear() - d.getFullYear()
  const m = at.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && at.getDate() < d.getDate())) a--
  return a
}

export function isOldEnoughToClaim(dob: string | null): boolean {
  if (!dob) return false
  return age(dob) >= CLAIM_AGE_THRESHOLD
}

export interface DependentFormValues {
  firstName: string
  lastName: string
  dateOfBirth: string
}

export function validateDependentForm(values: DependentFormValues): string | null {
  if (!values.firstName.trim() || !values.lastName.trim()) {
    return "Please enter the child's first and last name."
  }
  if (!values.dateOfBirth) {
    return "Please enter the child's date of birth."
  }
  if (new Date(values.dateOfBirth) > new Date()) {
    return 'Date of birth cannot be in the future.'
  }
  return null
}
