export type Prompt = {
  category: string;
  word: string;
};

export const PROMPTS: Prompt[] = [
  { category: "Food", word: "Pizza" },
  { category: "Food", word: "Sushi" },
  { category: "Animal", word: "Penguin" },
  { category: "Animal", word: "Giraffe" },
  { category: "Place", word: "Lighthouse" },
  { category: "Place", word: "Subway" },
  { category: "Object", word: "Umbrella" },
  { category: "Object", word: "Telescope" },
  { category: "Activity", word: "Skiing" },
  { category: "Activity", word: "Fishing" },
  { category: "Nature", word: "Volcano" },
  { category: "Nature", word: "Cactus" },
  { category: "Vehicle", word: "Helicopter" },
  { category: "Vehicle", word: "Sailboat" },
  { category: "Job", word: "Astronaut" },
  { category: "Job", word: "Chef" },
];

export function pickPrompt(): Prompt {
  const index = Math.floor(Math.random() * PROMPTS.length);
  return PROMPTS[index] ?? { category: "Food", word: "Pizza" };
}
