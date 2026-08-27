import type { WavelengthGame } from "./WavelengthGame.ts";

type WavelengthGameInternals = {
  phase: string;
  active: Set<string>;
  turnOrder: string[];
  roundIndex: number;
  leftLabel: string;
  rightLabel: string;
  target: number;
  clue: string | null;
  guesses: Map<string, number>;
  history: unknown[];
  totalScore: number;
  lastReveal: unknown;
  usedSpectrumIndices: Set<number>;
};

export function asInternals(game: WavelengthGame): WavelengthGameInternals {
  return game as unknown as WavelengthGameInternals;
}

export function setupFixedOrder(
  game: WavelengthGame,
  playerIds: string[],
): void {
  game.setup(playerIds);
  asInternals(game).turnOrder = [...playerIds];
  asInternals(game).roundIndex = 0;
}

export function setRoundTarget(game: WavelengthGame, target: number): void {
  asInternals(game).target = target;
}

export function setSpectrum(
  game: WavelengthGame,
  leftLabel: string,
  rightLabel: string,
): void {
  asInternals(game).leftLabel = leftLabel;
  asInternals(game).rightLabel = rightLabel;
}
