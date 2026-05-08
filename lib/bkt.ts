/**
 * Bayesian Knowledge Tracing (BKT) — single-skill mastery update.
 *
 * Default per-node parameters (Corbett & Anderson, 1995):
 *   P_L0  prior probability student already knows the skill
 *   P_T   probability of transitioning from unknown → known after a practice
 *   P_G   probability of guessing correctly while not knowing
 *   P_S   probability of slipping (wrong answer) while knowing
 */
export const P_L0 = 0.3
export const P_T  = 0.09
export const P_G  = 0.2
export const P_S  = 0.1

/** Default prior mastery used when no row exists yet in mastery_scores. */
export const PRIOR_MASTERY = P_L0

/**
 * Updates a mastery score given the latest quest attempt outcome.
 *
 * Two-step update:
 *   1. Bayesian posterior given the observed evidence (correct / wrong).
 *   2. Apply the transit probability P_T (learning from the practice itself).
 *
 * Result is clamped to [0, 1].
 */
export function updateMastery(currentScore: number, isCorrect: boolean): number {
  // Clamp input agar formula tidak meledak jika DB sempat berisi nilai aneh.
  const score =
    Number.isFinite(currentScore)
      ? Math.max(0, Math.min(1, currentScore))
      : PRIOR_MASTERY

  let posterior: number

  if (isCorrect) {
    const pCorrect = score * (1 - P_S) + (1 - score) * P_G
    posterior = pCorrect > 0 ? (score * (1 - P_S)) / pCorrect : score
  } else {
    const pWrong = score * P_S + (1 - score) * (1 - P_G)
    posterior = pWrong > 0 ? (score * P_S) / pWrong : score
  }

  const newScore = posterior + (1 - posterior) * P_T

  if (!Number.isFinite(newScore)) return PRIOR_MASTERY
  if (newScore < 0) return 0
  if (newScore > 1) return 1
  return newScore
}
