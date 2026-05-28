import { describe, it, expect } from 'vitest'
import { getSetupSteps, isOnboarded } from '../onboarding'

const base = { clubName: 'Cricket Club', playerCount: 0, seasonCount: 0, matchCount: 0, windowCount: 0 }

describe('getSetupSteps', () => {
  it('returns 5 steps', () => {
    expect(getSetupSteps(base)).toHaveLength(5)
  })

  it('branding step is incomplete when club_name is default', () => {
    const steps = getSetupSteps({ ...base, clubName: 'Cricket Club' })
    expect(steps.find(s => s.key === 'branding')!.done).toBe(false)
  })

  it('branding step is complete when club_name is changed', () => {
    const steps = getSetupSteps({ ...base, clubName: 'Riverside CC' })
    expect(steps.find(s => s.key === 'branding')!.done).toBe(true)
  })

  it('players step requires 11+ players', () => {
    expect(getSetupSteps({ ...base, playerCount: 10 }).find(s => s.key === 'players')!.done).toBe(false)
    expect(getSetupSteps({ ...base, playerCount: 11 }).find(s => s.key === 'players')!.done).toBe(true)
  })
})

describe('isOnboarded', () => {
  it('returns false when any step incomplete', () => {
    expect(isOnboarded(getSetupSteps(base))).toBe(false)
  })

  it('returns true when all steps done', () => {
    const full = { clubName: 'Riverside CC', playerCount: 11, seasonCount: 1, matchCount: 1, windowCount: 1 }
    expect(isOnboarded(getSetupSteps(full))).toBe(true)
  })
})
