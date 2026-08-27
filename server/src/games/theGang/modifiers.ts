import type { GangMode } from "../../protocol/messages.ts";

export type GangChallengeId =
  | "quickAccess"
  | "noiseSensors"
  | "motionDetector"
  | "retinaScan"
  | "hastyGetaway"
  | "ventilationShaft"
  | "laserTripwires"
  | "blackout"
  | "fingerprintScan"
  | "securityCameras";

export type GangSpecialistId =
  | "informant"
  | "getawayDriver"
  | "investor"
  | "mastermind"
  | "hacker"
  | "coordinator"
  | "jack"
  | "mathWhiz"
  | "conwoman"
  | "muscle";

export type GangModifierKind = "challenge" | "specialist";

export type GangModifierId = GangChallengeId | GangSpecialistId;

export type GangActiveModifier = {
  kind: GangModifierKind;
  id: GangModifierId;
  permanent?: boolean;
};

export type GangModifierView = {
  kind: GangModifierKind;
  id: GangModifierId;
  name: string;
  description: string;
  permanent?: boolean;
};

type ModifierDefinition = {
  name: string;
  description: string;
  number: number;
};

export const CHALLENGE_ORDER: GangChallengeId[] = [
  "quickAccess",
  "noiseSensors",
  "motionDetector",
  "retinaScan",
  "hastyGetaway",
  "ventilationShaft",
  "laserTripwires",
  "blackout",
  "fingerprintScan",
  "securityCameras",
];

export const SPECIALIST_ORDER: GangSpecialistId[] = [
  "informant",
  "getawayDriver",
  "investor",
  "mastermind",
  "hacker",
  "coordinator",
  "jack",
  "mathWhiz",
  "conwoman",
  "muscle",
];

const CHALLENGE_DEFS: Record<GangChallengeId, ModifierDefinition> = {
  quickAccess: {
    number: 1,
    name: "Quick Access",
    description:
      "Skip the white-chip round. Deal pocket cards, flip the flop, and start on yellow chips.",
  },
  noiseSensors: {
    number: 2,
    name: "Noise Sensors",
    description:
      "1-star chips in rounds 1–3 lock once taken from the center and cannot change owners.",
  },
  motionDetector: {
    number: 3,
    name: "Motion Detector",
    description:
      "If the flop contains a J, Q, or K, the white 1-star holder redraws pocket cards.",
  },
  retinaScan: {
    number: 4,
    name: "Retina Scan",
    description:
      "Before the highest red chip reveals, others must guess a pocket rank they hold.",
  },
  hastyGetaway: {
    number: 5,
    name: "Hasty Getaway",
    description:
      "Skip the orange-chip round. Reveal the fourth community card and go straight to red chips.",
  },
  ventilationShaft: {
    number: 6,
    name: "Ventilation Shaft",
    description:
      "Highest-value chips in rounds 1–3 lock once taken from the center.",
  },
  laserTripwires: {
    number: 7,
    name: "Laser Tripwires",
    description:
      "If the flop has no J, Q, or K, the highest white-chip holder redraws pocket cards.",
  },
  blackout: {
    number: 8,
    name: "Blackout",
    description:
      "Discard prior-round chips at the start of each new street so only memory helps.",
  },
  fingerprintScan: {
    number: 9,
    name: "Fingerprint Scan",
    description:
      "Before the highest red chip reveals, others must guess that player's hand category.",
  },
  securityCameras: {
    number: 10,
    name: "Security Cameras",
    description: "Each player receives a third pocket card for the heist.",
  },
};

const SPECIALIST_DEFS: Record<GangSpecialistId, ModifierDefinition> = {
  informant: {
    number: 1,
    name: "Informant",
    description: "One player secretly shows a pocket card to one other player.",
  },
  getawayDriver: {
    number: 2,
    name: "Getaway Driver",
    description: "One player announces their current hand category to everyone.",
  },
  investor: {
    number: 3,
    name: "Investor",
    description: "Each player states how many face cards (J, Q, K) they hold.",
  },
  mastermind: {
    number: 4,
    name: "Mastermind",
    description:
      "The gang picks a rank; one player states how many pocket cards match it.",
  },
  hacker: {
    number: 5,
    name: "Hacker",
    description: "One player draws an extra pocket card and discards one.",
  },
  coordinator: {
    number: 6,
    name: "Coordinator",
    description: "Each player passes one chosen pocket card to the left.",
  },
  jack: {
    number: 7,
    name: "Jack",
    description:
      "One player adds an unsuited Jack card to their pocket and discards another card.",
  },
  mathWhiz: {
    number: 8,
    name: "Math Whiz",
    description: "Each player states the sum of their pocket-card values.",
  },
  conwoman: {
    number: 9,
    name: "Conwoman",
    description: "Mix all pocket cards face down and redistribute them.",
  },
  muscle: {
    number: 10,
    name: "Muscle",
    description:
      "One player beats every other hand of the same category at showdown.",
  },
};

export function alarmsToLoseForMode(mode: GangMode): number {
  return mode === "masterThief" ? 2 : 3;
}

export function usesModifierCards(mode: GangMode): boolean {
  return mode !== "basic";
}

export function usesSpecialistCards(mode: GangMode): boolean {
  return mode === "advanced" || mode === "professional";
}

export function masterThiefChallengeSlots(): number {
  return 2;
}

export function challengeNumber(id: GangChallengeId): number {
  return CHALLENGE_ORDER.indexOf(id) + 1;
}

export function lowestNumberedChallenge(
  modifiers: GangActiveModifier[],
): GangActiveModifier | null {
  const challenges = modifiers.filter((modifier) => modifier.kind === "challenge");
  if (challenges.length === 0) {
    return null;
  }
  return challenges.reduce((lowest, current) => {
    const currentNumber = challengeNumber(current.id as GangChallengeId);
    const lowestNumber = challengeNumber(lowest.id as GangChallengeId);
    return currentNumber < lowestNumber ? current : lowest;
  });
}

export function challengePoolForMode(mode: GangMode): GangChallengeId[] {
  if (mode === "professional" || mode === "masterThief") {
    return CHALLENGE_ORDER.filter((id) => id !== "quickAccess");
  }
  return CHALLENGE_ORDER;
}

export function specialistPoolForMode(_mode: GangMode): GangSpecialistId[] {
  return SPECIALIST_ORDER;
}

export function toModifierView(modifier: GangActiveModifier): GangModifierView {
  if (modifier.kind === "challenge") {
    const def = CHALLENGE_DEFS[modifier.id as GangChallengeId];
    return {
      kind: modifier.kind,
      id: modifier.id,
      name: def.name,
      description: def.description,
      permanent: modifier.permanent,
    };
  }
  const def = SPECIALIST_DEFS[modifier.id as GangSpecialistId];
  return {
    kind: modifier.kind,
    id: modifier.id,
    name: def.name,
    description: def.description,
    permanent: modifier.permanent,
  };
}

export function drawNextChallenge(
  mode: GangMode,
  index: number,
): { id: GangChallengeId; nextIndex: number } {
  const pool = challengePoolForMode(mode);
  const id = pool[index % pool.length]!;
  return { id, nextIndex: index + 1 };
}

export function drawNextSpecialist(
  mode: GangMode,
  index: number,
): { id: GangSpecialistId; nextIndex: number } {
  const pool = specialistPoolForMode(mode);
  const id = pool[index % pool.length]!;
  return { id, nextIndex: index + 1 };
}
