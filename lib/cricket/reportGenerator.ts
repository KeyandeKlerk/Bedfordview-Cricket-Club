/**
 * Template-based match report generator.
 * Pure TypeScript — no AI APIs, no external calls, no dependencies.
 */

import type { InningsState, BatterStats, BowlerStats } from './types'

export type InningsSummary = {
  battingSide: 'home' | 'away'
  battingTeamName: string
  total: number
  wickets: number
  overs: string
  topBatters: Array<{ name: string; runs: number; balls: number; fours: number; sixes: number; isOut: boolean }>
  topBowlers: Array<{ name: string; overs: string; wickets: number; runs: number }>
  extras: number
  fifties: number
  hundreds: number
}

export type MatchSummary = {
  matchDate: string        // ISO date string
  ground: string | null
  competition: string | null
  opponentName: string
  ourTeamSide: 'home' | 'away'
  resultText: string | null
  innings: InningsSummary[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function topN<T extends { runs?: number; wickets?: number }>(
  arr: T[],
  key: 'runs' | 'wickets',
  n: number
): T[] {
  return [...arr].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0)).slice(0, n)
}

function plural(n: number, word: string) {
  return `${n} ${word}${n !== 1 ? 's' : ''}`
}

function formatScore(runs: number, wickets: number, overs: string) {
  return wickets >= 10 ? `${runs} all out (${overs} overs)` : `${runs}/${wickets} (${overs} overs)`
}

function batterLine(b: { name: string; runs: number; balls: number; fours: number; sixes: number; isOut: boolean }) {
  const not = b.isOut ? '' : '* '
  let detail = `${b.runs}${not}(${b.balls})`
  const extras: string[] = []
  if (b.fours > 0) extras.push(plural(b.fours, 'four'))
  if (b.sixes > 0) extras.push(plural(b.sixes, 'six'))
  if (extras.length) detail += ` incl. ${extras.join(' and ')}`
  return `${b.name} ${detail}`
}

function bowlerLine(b: { name: string; overs: string; wickets: number; runs: number }) {
  return `${b.name} (${b.wickets}/${b.runs} off ${b.overs})`
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-ZA', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch {
    return iso
  }
}

// ── Extract innings summary from InningsState ─────────────────────────────────

export function buildInningsSummary(
  state: InningsState,
  battingSide: 'home' | 'away',
  battingTeamName: string
): InningsSummary {
  const batters = Object.values(state.batterStats) as BatterStats[]
  const bowlers = Object.values(state.bowlerStats) as BowlerStats[]

  const sortedBatters = [...batters].sort((a, b) => b.runs - a.runs)
  const topBatters = sortedBatters.slice(0, 3).map(b => ({
    name: b.name,
    runs: b.runs,
    balls: b.balls,
    fours: b.fours,
    sixes: b.sixes,
    isOut: b.isOut,
  }))

  const topBowlers = [...bowlers]
    .filter(b => b.legalBalls > 0)
    .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)
    .slice(0, 3)
    .map(b => ({
      name: b.name,
      overs: b.overs,
      wickets: b.wickets,
      runs: b.runs,
    }))

  const fifties = batters.filter(b => b.runs >= 50 && b.runs < 100).length
  const hundreds = batters.filter(b => b.runs >= 100).length

  return {
    battingSide,
    battingTeamName,
    total: state.totalRuns,
    wickets: state.wickets,
    overs: state.oversDisplay,
    topBatters,
    topBowlers,
    extras: state.extras.total,
    fifties,
    hundreds,
  }
}

// ── Narrative templates ───────────────────────────────────────────────────────

function buildBattingParagraph(inn: InningsSummary, teamLabel: string): string {
  const score = formatScore(inn.total, inn.wickets, inn.overs)
  let para = `${teamLabel} posted ${score}`

  if (inn.topBatters.length > 0) {
    const [top, ...rest] = inn.topBatters
    if (top.runs >= 50) {
      para += `, with ${batterLine(top)} leading the way`
    } else {
      para += `, with contributions throughout the order`
    }
    if (rest.length > 0 && rest[0].runs >= 20) {
      const supporters = rest.filter(b => b.runs >= 15).map(b => `${b.name} (${b.runs})`)
      if (supporters.length) {
        para += `. ${supporters.join(' and ')} also chipped in`
      }
    }
  }

  if (inn.hundreds > 0) {
    para += `. ${plural(inn.hundreds, 'century')} were recorded in the innings`
  } else if (inn.fifties > 0) {
    para += `. ${plural(inn.fifties, 'half-century')} were scored`
  }

  return para + '.'
}

function buildBowlingParagraph(bowlingInn: InningsSummary, bowlingTeamLabel: string, battingTeamLabel: string): string {
  const score = formatScore(bowlingInn.total, bowlingInn.wickets, bowlingInn.overs)
  let para = `${battingTeamLabel} replied with ${score}`

  const wicketTakers = bowlingInn.topBowlers.filter(b => b.wickets > 0)
  if (wicketTakers.length > 0) {
    const [top, ...rest] = wicketTakers
    para += `. ${bowlingTeamLabel} were well served with the ball by ${bowlerLine(top)}`
    if (rest.length > 0) {
      const others = rest.filter(b => b.wickets > 0).map(b => bowlerLine(b))
      if (others.length) {
        para += `, with support from ${others.join(' and ')}`
      }
    }
  }

  return para + '.'
}

// ── Main generator ─────────────────────────────────────────────────────────────

export function generateMatchReport(summary: MatchSummary): string {
  const {
    matchDate, ground, competition, opponentName,
    ourTeamSide, resultText, innings,
  } = summary

  const bccLabel = 'BCC'
  const oppLabel = opponentName

  // ── Paragraph 1: scene-setting ──
  const dateStr = formatDate(matchDate)
  let p1 = `Bedfordview CC`
  if (resultText) {
    if (resultText.toLowerCase().includes('won')) {
      p1 += ` secured a fine victory`
    } else if (resultText.toLowerCase().includes('lost')) {
      p1 += ` fell to a defeat`
    } else if (resultText.toLowerCase().includes('tied') || resultText.toLowerCase().includes('tie')) {
      p1 += ` played out an exciting tie`
    } else {
      p1 += ` took the field`
    }
  } else {
    p1 += ` took the field`
  }
  p1 += ` against ${oppLabel}`
  if (ground) p1 += ` at ${ground}`
  p1 += ` on ${dateStr}`
  if (competition) p1 += ` in the ${competition}`
  if (resultText) p1 += `. ${resultText}`
  p1 += '.'

  if (innings.length === 0) return p1

  // Determine which innings is BCC's
  const bccInn = innings.find(i => i.battingSide === ourTeamSide)
  const oppInn = innings.find(i => i.battingSide !== ourTeamSide)

  const parts: string[] = [p1]

  // ── Paragraph 2: first batting innings ──
  if (innings[0]) {
    const firstBattingTeam = innings[0].battingSide === ourTeamSide ? bccLabel : oppLabel
    const firstBowlingTeam = firstBattingTeam === bccLabel ? oppLabel : bccLabel
    parts.push(buildBattingParagraph(innings[0], firstBattingTeam))

    // Sub-paragraph: bowling in that innings (from the other innings' bowlers)
    const firstBowlersInn = innings[1] ?? null
    if (firstBowlersInn) {
      const bowlingPara = buildBowlingParagraph(firstBowlersInn, firstBowlingTeam, firstBattingTeam === bccLabel ? oppLabel : bccLabel)
      parts.push(bowlingPara)
    }
  }

  // ── Paragraph 3: second innings (if different from above) ──
  if (innings[1] && innings.length > 1) {
    const secondBattingTeam = innings[1].battingSide === ourTeamSide ? bccLabel : oppLabel
    parts.push(buildBattingParagraph(innings[1], secondBattingTeam))
  }

  // ── Paragraph 4: closing ──
  let closing = ''
  if (resultText) {
    if (resultText.toLowerCase().includes('won')) {
      closing = `A fine team performance all round. ${bccLabel} will look to carry this momentum into their next fixture.`
    } else if (resultText.toLowerCase().includes('lost')) {
      closing = `Despite a competitive effort, the result did not go ${bccLabel}'s way. The team will regroup and look forward to the next fixture.`
    } else if (resultText.toLowerCase().includes('tied') || resultText.toLowerCase().includes('tie')) {
      closing = `An evenly contested match — a point shared between two well-matched sides.`
    }
  }
  if (closing) parts.push(closing)

  return parts.join('\n\n')
}
