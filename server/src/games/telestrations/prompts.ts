export const PROMPTS = [
  "Unicorn",
  "Spaceship",
  "Pizza",
  "Lighthouse",
  "Octopus",
  "Skateboard",
  "Volcano",
  "Robot",
  "Cactus",
  "Submarine",
  "Castle",
  "Banana",
  "Helicopter",
  "Penguin",
  "Umbrella",
  "Dragon",
  "Telescope",
  "Taco",
  "Snowman",
  "Guitar",
];

export function pickPrompts(count: number): string[] {
  const shuffled = [...PROMPTS];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = shuffled[i];
    const b = shuffled[j];
    if (a === undefined || b === undefined) {
      continue;
    }
    shuffled[i] = b;
    shuffled[j] = a;
  }
  const picks: string[] = [];
  for (let i = 0; i < count; i += 1) {
    picks.push(shuffled[i % shuffled.length] ?? "Pizza");
  }
  return picks;
}
