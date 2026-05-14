// DLS Standard Edition parameters (w = wickets already lost, 0–9)
const DLS_Z0 = [100.0, 93.4, 85.1, 74.9, 62.7, 49.0, 34.9, 22.0, 11.9, 4.7]
const DLS_B  = [0.0395, 0.0521, 0.0615, 0.0766, 0.0976, 0.1370, 0.1975, 0.2927, 0.4310, 0.7006]

// Precomputed 51×10 resource table. TABLE[oversRemaining][wicketsLost].
// Values are computed once at module load from the Standard Edition formula:
//   Z(u, w) = Z0[w] × (1 − e^(−b[w] × u))
// All target calculations use ratios R2/R1, so the overall scale cancels.
const DLS_TABLE: readonly (readonly number[])[] = (() => {
  const t: number[][] = []
  for (let u = 0; u <= 50; u++) {
    t.push(DLS_Z0.map((z0, w) => Math.round(z0 * (1 - Math.exp(-DLS_B[w] * u)) * 100) / 100))
  }
  return t
})()

function resourcesAt(overs: number, wicketsLost: number): number {
  const w = Math.min(Math.floor(wicketsLost), 9)
  const u = Math.max(0, Math.min(overs, 50))
  const lo = Math.floor(u)
  const hi = Math.min(lo + 1, 50)
  const frac = u - lo
  return DLS_TABLE[lo][w] + (DLS_TABLE[hi][w] - DLS_TABLE[lo][w]) * frac
}

export function dlsResources(overs: number, wicketsLost = 0): number {
  return resourcesAt(overs, wicketsLost)
}

// G50: average runs available in a full-resource innings (used when team 2 has more resources)
const G50 = 245

export function dlsTarget(
  team1Score: number,
  team1Overs: number,
  team2Overs: number,
): number {
  const R1 = resourcesAt(team1Overs, 0)
  const R2 = resourcesAt(team2Overs, 0)
  if (R1 === 0) return team1Score + 1
  if (R2 <= R1) {
    // Add a tiny epsilon before floor to avoid floating-point truncation when R2 ≈ R1.
    // Example: 120 × 79.4/79.4 can evaluate to 119.999…, giving a target 1 too low.
    return Math.floor(team1Score * R2 / R1 + 1e-9) + 1
  }
  // Team 2 has more resources: award extra runs proportional to the difference
  return team1Score + Math.floor((R2 - R1) * G50 / DLS_Z0[0]) + 1
}
