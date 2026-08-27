export type SpectrumPair = {
  leftLabel: string;
  rightLabel: string;
};

export const SPECTRUM_PAIRS: SpectrumPair[] = [
  { leftLabel: "Hot", rightLabel: "Cold" },
  { leftLabel: "Easy", rightLabel: "Difficult" },
  { leftLabel: "Cheap", rightLabel: "Expensive" },
  { leftLabel: "Boring", rightLabel: "Exciting" },
  { leftLabel: "Bad gift", rightLabel: "Great gift" },
  { leftLabel: "Unhealthy", rightLabel: "Healthy" },
  { leftLabel: "Not scary", rightLabel: "Terrifying" },
  { leftLabel: "Useless", rightLabel: "Useful" },
  { leftLabel: "Unromantic", rightLabel: "Romantic" },
  { leftLabel: "Quiet", rightLabel: "Loud" },
  { leftLabel: "Ordinary", rightLabel: "Extraordinary" },
  { leftLabel: "Childish", rightLabel: "Mature" },
  { leftLabel: "Uncool", rightLabel: "Cool" },
  { leftLabel: "Simple", rightLabel: "Complicated" },
  { leftLabel: "Safe", rightLabel: "Dangerous" },
  { leftLabel: "Underrated", rightLabel: "Overrated" },
  { leftLabel: "Casual", rightLabel: "Formal" },
  { leftLabel: "Forgivable", rightLabel: "Unforgivable" },
  { leftLabel: "Low effort", rightLabel: "High effort" },
  { leftLabel: "Underrated movie", rightLabel: "Overhyped movie" },
  { leftLabel: "Needs explanation", rightLabel: "Self-explanatory" },
  { leftLabel: "Relaxing", rightLabel: "Stressful" },
  { leftLabel: "Underpaid job", rightLabel: "Overpaid job" },
  { leftLabel: "Bad idea", rightLabel: "Good idea" },
];

export function pickSpectrum(usedIndices: Set<number>): {
  pair: SpectrumPair;
  index: number;
} {
  const available = SPECTRUM_PAIRS.map((pair, index) => ({ pair, index })).filter(
    (entry) => !usedIndices.has(entry.index),
  );
  const pool =
    available.length > 0
      ? available
      : SPECTRUM_PAIRS.map((pair, index) => ({ pair, index }));
  const choice = pool[Math.floor(Math.random() * pool.length)];
  if (!choice) {
    return { pair: SPECTRUM_PAIRS[0]!, index: 0 };
  }
  return choice;
}

export function randomTarget(): number {
  return Math.floor(Math.random() * 101);
}
