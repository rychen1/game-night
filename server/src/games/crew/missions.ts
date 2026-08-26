import type {
  CrewColor,
  CrewPublicCard,
  CrewRank,
  CrewTaskStatus,
} from "../../protocol/messages.ts";
import type { CrewCompletedTrick } from "../../protocol/messages.ts";

export type CrewTaskDef =
  | {
      type: "player_wins_card";
      playerSlot: number;
      card: { color: CrewColor; rank: CrewRank };
    }
  | {
      type: "player_must_not_win";
      playerSlot: number;
      card: { color: CrewColor; rank: CrewRank };
    };

export type CrewMissionDef = {
  id: string;
  title: string;
  description: string;
  tasks: CrewTaskDef[];
};

export type ResolvedTask = {
  id: string;
  description: string;
  def: CrewTaskDef;
  playerId: string;
  status: CrewTaskStatus;
};

/** Starter missions for v1 — data-driven, not a campaign. */
export const STARTER_MISSIONS: CrewMissionDef[] = [
  {
    id: "mission-blue-9",
    title: "Signal Flare",
    description: "Secure the blue 9 for the assigned crew member.",
    tasks: [
      {
        type: "player_wins_card",
        playerSlot: 0,
        card: { color: "blue", rank: 9 },
      },
    ],
  },
  {
    id: "mission-red-safe",
    title: "Keep Red Safe",
    description: "The assigned crew member must not take the red 1.",
    tasks: [
      {
        type: "player_must_not_win",
        playerSlot: 0,
        card: { color: "red", rank: 1 },
      },
    ],
  },
  {
    id: "mission-two-targets",
    title: "Twin Targets",
    description: "Two crew members each need a specific card.",
    tasks: [
      {
        type: "player_wins_card",
        playerSlot: 0,
        card: { color: "green", rank: 5 },
      },
      {
        type: "player_wins_card",
        playerSlot: 1,
        card: { color: "yellow", rank: 4 },
      },
    ],
  },
  {
    id: "mission-yellow-guard",
    title: "Yellow Guard",
    description: "Take yellow 9, and keep yellow 1 away from slot 1.",
    tasks: [
      {
        type: "player_wins_card",
        playerSlot: 0,
        card: { color: "yellow", rank: 9 },
      },
      {
        type: "player_must_not_win",
        playerSlot: 1,
        card: { color: "yellow", rank: 1 },
      },
    ],
  },
];

export function pickStarterMission(): CrewMissionDef {
  const index = Math.floor(Math.random() * STARTER_MISSIONS.length);
  const mission = STARTER_MISSIONS[index];
  if (!mission) {
    return STARTER_MISSIONS[0]!;
  }
  return mission;
}

export function resolveTasks(
  mission: CrewMissionDef,
  order: string[],
): ResolvedTask[] {
  return mission.tasks.map((def, index) => {
    const slot = def.playerSlot % order.length;
    const playerId = order[slot] ?? order[0]!;
    return {
      id: `${mission.id}-t${index}`,
      description: describeTask(def, playerId, order),
      def,
      playerId,
      status: "pending" as const,
    };
  });
}

function describeTask(
  def: CrewTaskDef,
  playerId: string,
  order: string[],
): string {
  const card = formatCard(def.card);
  const slot = order.indexOf(playerId);
  const who = `Player ${slot + 1}`;
  if (def.type === "player_wins_card") {
    return `${who} must win ${card}`;
  }
  return `${who} must not win ${card}`;
}

function formatCard(card: { color: CrewColor; rank: CrewRank }): string {
  if (card.color === "submarine") {
    return `submarine ${card.rank}`;
  }
  return `${card.color} ${card.rank}`;
}

function cardsEqual(a: CrewPublicCard, b: { color: CrewColor; rank: CrewRank }): boolean {
  return a.color === b.color && a.rank === b.rank;
}

function whoWonCard(
  tricks: CrewCompletedTrick[],
  target: { color: CrewColor; rank: CrewRank },
): string | null {
  for (const trick of tricks) {
    for (const play of trick.plays) {
      if (cardsEqual(play.card, target)) {
        return trick.winnerId;
      }
    }
  }
  return null;
}

function cardIsDealt(
  dealt: { color: CrewColor; rank: CrewRank }[],
  target: { color: CrewColor; rank: CrewRank },
): boolean {
  return dealt.some((card) => cardsEqual(card, target));
}

/**
 * Undealt cards never appear in play. Mark tasks accordingly as soon as
 * hands are known — do not wait until hands are empty.
 */
export function markUndealtCardOutcomes(
  tasks: ResolvedTask[],
  dealtCards: { color: CrewColor; rank: CrewRank }[],
): ResolvedTask[] {
  return tasks.map((task) => {
    if (task.status !== "pending") {
      return task;
    }
    if (cardIsDealt(dealtCards, task.def.card)) {
      return task;
    }
    if (task.def.type === "player_wins_card") {
      return { ...task, status: "failed" as const };
    }
    return { ...task, status: "satisfied" as const };
  });
}

export function missionResultFromTasks(
  tasks: ResolvedTask[],
): "success" | "failure" | null {
  if (tasks.some((t) => t.status === "failed")) {
    return "failure";
  }
  if (tasks.length > 0 && tasks.every((t) => t.status === "satisfied")) {
    return "success";
  }
  return null;
}

/**
 * Update task statuses after a trick resolves.
 * Returns whether the mission should end, and if so with which result.
 */
export function evaluateTasks(
  tasks: ResolvedTask[],
  tricks: CrewCompletedTrick[],
  handsEmpty: boolean,
): { tasks: ResolvedTask[]; result: "success" | "failure" | null } {
  const next = tasks.map((task) => {
    if (task.status !== "pending") {
      return task;
    }
    const winner = whoWonCard(tricks, task.def.card);
    if (task.def.type === "player_wins_card") {
      if (winner === task.playerId) {
        return { ...task, status: "satisfied" as const };
      }
      if (winner !== null && winner !== task.playerId) {
        return { ...task, status: "failed" as const };
      }
      // Dealt but never won while hands empty — should not happen if all
      // dealt cards are played; treat as failure.
      if (handsEmpty && winner === null) {
        return { ...task, status: "failed" as const };
      }
      return task;
    }
    // player_must_not_win (target was dealt — otherwise already satisfied)
    if (winner === task.playerId) {
      return { ...task, status: "failed" as const };
    }
    if (winner !== null && winner !== task.playerId) {
      return { ...task, status: "satisfied" as const };
    }
    if (handsEmpty) {
      return { ...task, status: "satisfied" as const };
    }
    return task;
  });

  return { tasks: next, result: missionResultFromTasks(next) };
}
