export const WORDS = [
  "Apple",
  "Bicycle",
  "Castle",
  "Dragon",
  "Elephant",
  "Firetruck",
  "Guitar",
  "Helicopter",
  "Igloo",
  "Jungle",
  "Kangaroo",
  "Lighthouse",
  "Mountain",
  "Octopus",
  "Penguin",
  "Rainbow",
  "Sailboat",
  "Telescope",
  "Umbrella",
  "Volcano",
];

export function pickWord(exclude: string[]): string {
  const excluded = new Set(exclude.map((word) => word.trim().toLowerCase()));
  const options = WORDS.filter(
    (word) => !excluded.has(word.trim().toLowerCase()),
  );
  const pool = options.length > 0 ? options : WORDS;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? "Apple";
}
