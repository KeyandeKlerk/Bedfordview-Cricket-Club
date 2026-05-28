// lib/onboarding.ts
export interface SetupCheckData {
  clubName: string
  playerCount: number
  seasonCount: number
  matchCount: number
  windowCount: number
}

export interface SetupStep {
  key: string
  label: string
  desc: string
  href: string
  done: boolean
}

export function getSetupSteps(data: SetupCheckData): SetupStep[] {
  return [
    {
      key: 'branding',
      label: 'Configure club branding',
      desc: 'Set your club name, short name, colours, and logo.',
      href: '/admin/settings',
      done: data.clubName !== 'Cricket Club' && data.clubName.trim().length > 0,
    },
    {
      key: 'players',
      label: 'Add players',
      desc: 'You need at least 11 players before you can select an XI.',
      href: '/admin/players',
      done: data.playerCount >= 11,
    },
    {
      key: 'season',
      label: 'Create a season',
      desc: 'Seasons group matches and power career statistics.',
      href: '/admin/seasons',
      done: data.seasonCount > 0,
    },
    {
      key: 'fixture',
      label: 'Create your first fixture',
      desc: 'Schedule a match to start using scoring and availability.',
      href: '/admin/matches/new',
      done: data.matchCount > 0,
    },
    {
      key: 'availability',
      label: 'Set up an availability window',
      desc: 'Collect player availability before selecting your XI.',
      href: '/admin/availability',
      done: data.windowCount > 0,
    },
  ]
}

export function isOnboarded(steps: SetupStep[]): boolean {
  return steps.every(s => s.done)
}
