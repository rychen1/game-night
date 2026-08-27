/** Points for a single guess based on distance from the hidden target (0–100). */
export function guessScore(distance: number): number {
  if (distance <= 10) {
    return 4;
  }
  if (distance <= 20) {
    return 3;
  }
  if (distance <= 30) {
    return 2;
  }
  if (distance <= 40) {
    return 1;
  }
  return 0;
}

export function scoreGuess(target: number, position: number): number {
  return guessScore(Math.abs(target - position));
}

export function scoreRound(
  target: number,
  guesses: { playerId: string; position: number }[],
): { guessScores: Record<string, number>; roundScore: number } {
  const guessScores: Record<string, number> = {};
  let roundScore = 0;
  for (const guess of guesses) {
    const points = scoreGuess(target, guess.position);
    guessScores[guess.playerId] = points;
    roundScore += points;
  }
  return { guessScores, roundScore };
}
