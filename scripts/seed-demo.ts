// scripts/seed-demo.ts
// Run: npx tsx scripts/seed-demo.ts
// Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Helpers ─────────────────────────────────────────────────────────────────

function dateStr(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().split('T')[0]
}

function rng(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function run(label: string, fn: () => Promise<void>) {
  process.stdout.write(`  ${label}... `)
  await fn()
  console.log('done')
}

// ── Wipe ────────────────────────────────────────────────────────────────────

async function wipe() {
  console.log('\nWiping existing data...')
  for (const table of [
    'ball_events', 'innings', 'match_players', 'selections',
    'player_availability', 'availability_windows',
    'matches', 'players', 'seasons', 'competitions',
    'opponents', 'grounds', 'notifications',
  ]) {
    await run(`Delete ${table}`, async () => {
      const { error } = await (supabase as any).from(table).delete().not('id', 'is', null)
      if (error) throw new Error(`${table}: ${error.message}`)
    })
  }
}

// ── Seed ────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\nSeeding demo data...')

  let groundId: string = ''
  let seasonId: string = ''
  let leagueId: string = ''
  let cupId: string = ''
  let playerIds: string[] = []
  let opponentIds: string[] = []
  let liveMatchId: string = ''
  let upcomingMatchIds: string[] = []
  let windowId: string = ''

  // Club config
  await run('club_config', async () => {
    const { error } = await supabase
      .from('club_config')
      .update({
        club_name: 'Riverside Cricket Club',
        club_short_name: 'RCC',
        logo_url: null,
        primary_color: '#2563eb',
        highlight_color: '#38bdf8',
        bg_color: '#050c1a',
        plan: 'pro',
        is_demo: true,
        contact_email: 'demo@riverside.cc',
        default_scoring_mode: 'professional',
      })
      .not('id', 'is', null)
    if (error) throw new Error(error.message)
  })

  // Ground
  await run('ground', async () => {
    const { data, error } = await supabase
      .from('grounds')
      .insert({ name: 'Riverside Oval', location: 'Riverside' })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    groundId = data.id
  })

  // Season
  await run('season', async () => {
    const { data, error } = await supabase
      .from('seasons')
      .insert({ name: '2025/26', start_date: dateStr(-120), end_date: dateStr(100), is_active: true })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    seasonId = data.id
  })

  // Competitions
  await run('competitions', async () => {
    const { data, error } = await supabase
      .from('competitions')
      .insert([
        { name: 'Premier League', match_format: 'limited_overs', overs_per_innings: 40, category: 'senior', season_id: seasonId },
        { name: 'Regional Cup', match_format: 'limited_overs', overs_per_innings: 20, category: 'senior', season_id: seasonId },
      ])
      .select('id, name')
    if (error) throw new Error(error.message)
    leagueId = data!.find((c: any) => c.name === 'Premier League')!.id
    cupId    = data!.find((c: any) => c.name === 'Regional Cup')!.id
  })

  // Players — 18 with realistic names
  const PLAYER_DEFS = [
    { first_name: 'James',   last_name: 'Hartley',   batting_position: 1, is_active: true },
    { first_name: 'Oliver',  last_name: 'Pemberton', batting_position: 2, is_active: true },
    { first_name: 'Marcus',  last_name: 'Alves',     batting_position: 3, is_active: true },
    { first_name: 'Daniel',  last_name: 'Osei',      batting_position: 4, is_active: true },
    { first_name: 'Samuel',  last_name: 'Lindstrom', batting_position: 5, is_active: true },
    { first_name: 'Ethan',   last_name: 'Nair',      batting_position: 6, is_active: true },
    { first_name: 'Noah',    last_name: 'Fraser',    batting_position: 7, is_active: true },
    { first_name: 'Callum',  last_name: 'Dube',      batting_position: 8, is_active: true },
    { first_name: 'Rishi',   last_name: 'Kapoor',    batting_position: 9, is_active: true },
    { first_name: 'Thomas',  last_name: 'Muller',    batting_position: 10, is_active: true },
    { first_name: 'Kieran',  last_name: 'Walsh',     batting_position: 11, is_active: true },
    { first_name: 'Aaron',   last_name: 'Patel',     batting_position: 1, is_active: true },
    { first_name: 'Leon',    last_name: 'Fischer',   batting_position: 2, is_active: true },
    { first_name: 'Zach',    last_name: 'Okoro',     batting_position: 3, is_active: true },
    { first_name: 'Ben',     last_name: 'Sherwood',  batting_position: 4, is_active: true },
    { first_name: 'Finn',    last_name: 'McCarthy',  batting_position: 5, is_active: true },
    { first_name: 'Hugo',    last_name: 'Leclercq',  batting_position: 6, is_active: true },
    { first_name: 'Kai',     last_name: 'Yamamoto',  batting_position: 7, is_active: true },
  ]

  await run('players (18)', async () => {
    const { data, error } = await supabase.from('players').insert(PLAYER_DEFS).select('id')
    if (error) throw new Error(error.message)
    playerIds = data!.map((p: any) => p.id)
  })

  // Opponents (6)
  const OPPONENT_NAMES = ['Westbrook CC', 'Northfield CC', 'Eastgate CC', 'Hillside CC', 'Lakeside CC', 'Parklands CC']
  await run('opponents', async () => {
    const { data, error } = await supabase
      .from('opponents')
      .insert(OPPONENT_NAMES.map(n => ({ canonical_name: n })))
      .select('id')
    if (error) throw new Error(error.message)
    opponentIds = data!.map((o: any) => o.id)
  })

  // Completed matches (12) with full ball-by-ball data
  console.log('\n  Building 12 completed matches with ball data...')
  const shotTypes = ['drive', 'cut', 'pull', 'sweep', 'glance', 'defence', 'flick']
  const bowlingTypes = ['pace', 'off-spin', 'leg-spin', 'swing', 'seam']

  for (let i = 0; i < 12; i++) {
    const matchDate = dateStr(-90 + i * 7)
    const oppId = opponentIds[i % opponentIds.length]
    const compId = i < 8 ? leagueId : cupId
    const oursFirst = i % 2 === 0
    const ourSide: 'home' | 'away' = i % 3 === 0 ? 'away' : 'home'
    const overs = compId === leagueId ? 40 : 20

    const { data: match, error: mErr } = await supabase
      .from('matches')
      .insert({
        match_date: matchDate,
        season_id: seasonId,
        competition_id: compId,
        opponent_id: oppId,
        ground_id: groundId,
        overs_per_innings: overs,
        our_team_side: ourSide,
        status: 'completed',
        scoring_mode: 'professional',
      })
      .select('id')
      .single()
    if (mErr) throw new Error(mErr.message)
    const matchId = match.id

    const ourEleven = playerIds.slice(0, 11)
    const oppSide = ourSide === 'home' ? 'away' : 'home'
    const mpRows = [
      ...ourEleven.map((pid, idx) => ({
        match_id: matchId,
        player_id: pid,
        side: ourSide,
        batting_position: idx + 1,
      })),
      ...Array.from({ length: 11 }, (_, idx) => ({
        match_id: matchId,
        player_id: null as null,
        opposition_name: `Opp Player ${idx + 1}`,
        side: oppSide,
        batting_position: idx + 1,
      })),
    ]

    const { data: mpData, error: mpErr } = await supabase
      .from('match_players')
      .insert(mpRows)
      .select('id, side')
    if (mpErr) throw new Error(mpErr.message)

    const ourMPs = mpData!.filter((mp: any) => mp.side === ourSide).map((mp: any) => mp.id)
    const oppMPs = mpData!.filter((mp: any) => mp.side !== ourSide).map((mp: any) => mp.id)

    for (let innNum = 1; innNum <= 2; innNum++) {
      const battingOurs = innNum === 1 ? oursFirst : !oursFirst
      const battingSide = battingOurs ? ourSide : oppSide
      const batters = battingOurs ? ourMPs : oppMPs
      const bowlers = battingOurs ? oppMPs : ourMPs

      const { data: inn, error: innErr } = await supabase
        .from('innings')
        .insert({
          match_id: matchId,
          innings_number: innNum,
          batting_side: battingSide,
          status: 'completed',
          target: innNum === 2 ? rng(140, 240) : null,
        })
        .select('id')
        .single()
      if (innErr) throw new Error(innErr.message)
      const innId = inn.id

      const ballRows: any[] = []
      let seq = 1
      let batterIdx = 0
      let striker = batters[batterIdx]
      let nonStriker = batters[batterIdx + 1]
      const totalOvers = Math.min(overs, rng(Math.floor(overs * 0.7), overs))

      for (let ov = 0; ov < totalOvers; ov++) {
        const bowlerMpId = bowlers[ov % 5]
        let legalBalls = 0
        let ballInOver = 0

        while (legalBalls < 6) {
          const isWide   = Math.random() < 0.04
          const isNoBall = !isWide && Math.random() < 0.03
          const runsOff  = isWide ? 0 : [0,0,0,0,1,1,1,2,2,3,4,4,6][rng(0,12)]
          const extrasRns = isWide || isNoBall ? 1 : 0
          const isFour   = !isWide && runsOff === 4
          const isSix    = !isWide && runsOff === 6
          const canDismiss = !isWide && !isNoBall && legalBalls > 0
          const dismissed = canDismiss && Math.random() < 0.04
          const dismissalType = dismissed
            ? ['bowled','caught','lbw','run_out','stumped'][rng(0,4)]
            : null

          ballRows.push({
            match_id: matchId,
            innings_id: innId,
            sequence_number: seq++,
            over_number: ov,
            ball_in_over: ballInOver++,
            batter_id: striker,
            non_striker_id: nonStriker,
            bowler_id: bowlerMpId,
            runs_off_bat: runsOff,
            extras_type: isWide ? 'wide' : isNoBall ? 'no_ball' : null,
            extras_runs: extrasRns,
            is_boundary_four: isFour,
            is_boundary_six: isSix,
            dismissal_type: dismissalType,
            dismissed_player_id: dismissed ? striker : null,
            wagon_x: parseFloat((Math.random() * 2 - 1).toFixed(3)),
            wagon_y: parseFloat((Math.random() * 2 - 1).toFixed(3)),
            pitch_length: rng(1, 5),
            pitch_line: rng(1, 3),
            shot_type: shotTypes[rng(0, shotTypes.length - 1)],
            bowling_type: bowlingTypes[rng(0, bowlingTypes.length - 1)],
            execution_quality: rng(1, 5),
            decision_quality: rng(1, 5),
          })

          if (!isWide && !isNoBall) legalBalls++
          if (dismissed) {
            batterIdx++
            striker = batters[Math.min(batterIdx, batters.length - 1)]
          } else if (!isWide && !isNoBall && runsOff % 2 !== 0) {
            ;[striker, nonStriker] = [nonStriker, striker]
          }
        }
        ;[striker, nonStriker] = [nonStriker, striker]
      }

      for (let chunk = 0; chunk < ballRows.length; chunk += 100) {
        const { error: bErr } = await supabase
          .from('ball_events')
          .insert(ballRows.slice(chunk, chunk + 100))
        if (bErr) throw new Error(bErr.message)
      }

      if (innNum === 2) {
        const won = Math.random() > 0.4
        await supabase
          .from('matches')
          .update({ result_text: won ? 'RCC won by 23 runs' : 'Opponents won by 4 wickets' })
          .eq('id', matchId)
      }
    }
    process.stdout.write('.')
  }
  console.log(' done')

  // In-progress match
  await run('in-progress match', async () => {
    const { data: m, error: mErr } = await supabase
      .from('matches')
      .insert({
        match_date: dateStr(0),
        season_id: seasonId,
        competition_id: leagueId,
        opponent_id: opponentIds[0],
        ground_id: groundId,
        overs_per_innings: 40,
        our_team_side: 'home',
        status: 'in_progress',
        scoring_mode: 'professional',
      })
      .select('id')
      .single()
    if (mErr) throw new Error(mErr.message)
    liveMatchId = m.id

    const ourEleven = playerIds.slice(0, 11)
    const mpRows = [
      ...ourEleven.map((pid, idx) => ({
        match_id: liveMatchId,
        player_id: pid,
        side: 'home',
        batting_position: idx + 1,
      })),
      ...Array.from({ length: 11 }, (_, idx) => ({
        match_id: liveMatchId,
        player_id: null as null,
        opposition_name: `Opponent ${idx + 1}`,
        side: 'away',
        batting_position: idx + 1,
      })),
    ]

    const { data: mpData, error: mpErr } = await supabase
      .from('match_players')
      .insert(mpRows)
      .select('id, side')
    if (mpErr) throw new Error(mpErr.message)

    const oppMPs = mpData!.filter((mp: any) => mp.side === 'away').map((mp: any) => mp.id)
    const ourMPs = mpData!.filter((mp: any) => mp.side === 'home').map((mp: any) => mp.id)

    const { data: inn, error: innErr } = await supabase
      .from('innings')
      .insert({
        match_id: liveMatchId,
        innings_number: 1,
        batting_side: 'away',
        status: 'in_progress',
        target: null,
      })
      .select('id')
      .single()
    if (innErr) throw new Error(innErr.message)
    const innId = inn.id

    let striker = oppMPs[0]
    let nonStriker = oppMPs[1]
    let nextBatter = 2
    let seq = 1

    for (let ov = 0; ov < 8; ov++) {
      const bowlerMpId = ourMPs[ov % 4]
      let legalBalls = 0
      let ballInOver = 0

      while (legalBalls < 6) {
        const runsOff = [0,0,0,0,1,1,2,4][rng(0,7)]
        const dismissed = legalBalls > 0 && Math.random() < 0.025 && nextBatter < oppMPs.length
        const { error } = await supabase.from('ball_events').insert({
          match_id: liveMatchId,
          innings_id: innId,
          sequence_number: seq++,
          over_number: ov,
          ball_in_over: ballInOver++,
          batter_id: striker,
          non_striker_id: nonStriker,
          bowler_id: bowlerMpId,
          runs_off_bat: runsOff,
          extras_type: null,
          extras_runs: 0,
          is_boundary_four: runsOff === 4,
          is_boundary_six: false,
          dismissal_type: dismissed ? 'caught' : null,
          dismissed_player_id: dismissed ? striker : null,
          wagon_x: parseFloat((Math.random() * 2 - 1).toFixed(3)),
          wagon_y: parseFloat((Math.random() * 2 - 1).toFixed(3)),
          shot_type: ['drive','cut','pull','defence'][rng(0,3)],
          bowling_type: 'pace',
          execution_quality: rng(1, 5),
          decision_quality: rng(1, 5),
        })
        if (error) throw new Error(error.message)
        legalBalls++
        if (dismissed) { striker = oppMPs[nextBatter++] }
        else if (runsOff % 2 !== 0) { [striker, nonStriker] = [nonStriker, striker] }
      }
      ;[striker, nonStriker] = [nonStriker, striker]
    }
  })

  // Upcoming fixtures (2)
  await run('upcoming fixtures', async () => {
    const { data, error } = await supabase
      .from('matches')
      .insert([
        {
          match_date: dateStr(7),
          season_id: seasonId,
          competition_id: leagueId,
          opponent_id: opponentIds[1],
          ground_id: groundId,
          overs_per_innings: 40,
          our_team_side: 'home',
          status: 'upcoming',
          scoring_mode: 'professional',
        },
        {
          match_date: dateStr(14),
          season_id: seasonId,
          competition_id: cupId,
          opponent_id: opponentIds[2],
          ground_id: groundId,
          overs_per_innings: 20,
          our_team_side: 'away',
          status: 'upcoming',
          scoring_mode: 'professional',
        },
      ])
      .select('id')
    if (error) throw new Error(error.message)
    upcomingMatchIds = data!.map((m: any) => m.id)
  })

  // Availability window + responses
  await run('availability window', async () => {
    const { data, error } = await supabase
      .from('availability_windows')
      .insert({
        title: 'Round 9 — Premier League vs Northfield CC',
        window_start: dateStr(5),
        window_end: dateStr(7),
        deadline: dateStr(4),
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    windowId = data.id

    const responses = playerIds.map((pid, i) => ({
      window_id: windowId,
      player_id: pid,
      status: i < 14 ? 'available' : i < 16 ? 'tentative' : 'unavailable',
    }))
    const { error: rErr } = await supabase.from('player_availability').insert(responses)
    if (rErr) throw new Error(rErr.message)
  })

  // Coach selection
  await run('XI selection', async () => {
    const matchId = upcomingMatchIds[0]
    const selectedPlayers = playerIds.slice(0, 11)
    const selRows = selectedPlayers.map((pid, i) => ({
      match_id: matchId,
      player_id: pid,
      position: i + 1,
      status: 'selected',
      role: 'player',
    }))
    const { error } = await supabase.from('selections').insert(selRows)
    if (error) throw new Error(error.message)
  })

  console.log('\nDemo data seeded successfully.')
  console.log(`Live match ID: ${liveMatchId}`)
}

// ── Main ─────────────────────────────────────────────────────────────────────

wipe()
  .then(() => seed())
  .then(() => process.exit(0))
  .catch(err => { console.error('\nSeed failed:', err); process.exit(1) })
