export interface RiskScoreParams {
  loginCount: number
  avgQuestScore: number
  streakDays: number
}

/**
 * Risk score 0..1 (0 = aman, 1 = sangat berisiko).
 * Bobot: login 30%, skor quest 50%, streak 20%.
 */
export function calculateRiskScore(params: RiskScoreParams): number {
  const loginFactor = Math.min(params.loginCount / 10, 1.0)
  const scoreFactor = params.avgQuestScore
  const streakFactor = Math.min(params.streakDays / 7, 1.0)

  const riskScore =
    1 - (loginFactor * 0.3 + scoreFactor * 0.5 + streakFactor * 0.2)

  return Math.max(0, Math.min(1, riskScore))
}
