import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateTasks,
  markUndealtCardOutcomes,
  missionResultFromTasks,
  missionResultIfFullyDecided,
  resolveTasks,
  STARTER_MISSIONS,
} from "./missions.ts";
import { mustNotWinTask, task, trick, winTask } from "./testHelpers.ts";

describe("missionResult adversarial combinations", () => {
  const combinations: Array<{
    label: string;
    tasks: ReturnType<typeof winTask>[];
    fullyDecided: "success" | "failure" | null;
    fromTasks: "success" | "failure" | null;
  }> = [
    {
      label: "all pending",
      tasks: [winTask("pending", "p1", "blue", 9, "a"), winTask("pending", "p2", "green", 5, "b")],
      fullyDecided: null,
      fromTasks: null,
    },
    {
      label: "all satisfied",
      tasks: [
        winTask("satisfied", "p1", "blue", 9, "a"),
        mustNotWinTask("satisfied", "p2", "red", 1, "b"),
      ],
      fullyDecided: "success",
      fromTasks: "success",
    },
    {
      label: "all failed",
      tasks: [winTask("failed", "p1", "blue", 9, "a"), winTask("failed", "p2", "green", 5, "b")],
      fullyDecided: "failure",
      fromTasks: "failure",
    },
    {
      label: "satisfied + pending",
      tasks: [winTask("satisfied", "p1", "blue", 9, "a"), winTask("pending", "p2", "green", 5, "b")],
      fullyDecided: null,
      fromTasks: null,
    },
    {
      label: "failed + pending",
      tasks: [winTask("failed", "p1", "blue", 9, "a"), winTask("pending", "p2", "green", 5, "b")],
      fullyDecided: null,
      fromTasks: "failure",
    },
    {
      label: "satisfied + failed",
      tasks: [
        winTask("satisfied", "p1", "blue", 9, "a"),
        winTask("failed", "p2", "green", 5, "b"),
      ],
      fullyDecided: "failure",
      fromTasks: "failure",
    },
    {
      label: "satisfied + failed + pending",
      tasks: [
        winTask("satisfied", "p1", "blue", 9, "a"),
        winTask("failed", "p2", "green", 5, "b"),
        winTask("pending", "p1", "yellow", 4, "c"),
      ],
      fullyDecided: null,
      fromTasks: "failure",
    },
  ];

  for (const combo of combinations) {
    it(`missionResultIfFullyDecided: ${combo.label}`, () => {
      assert.equal(missionResultIfFullyDecided(combo.tasks), combo.fullyDecided);
    });
    it(`missionResultFromTasks: ${combo.label}`, () => {
      assert.equal(missionResultFromTasks(combo.tasks), combo.fromTasks);
    });
  }
});

describe("evaluateTasks adversarial", () => {
  it("player_wins_card: assigned player plays target but another player wins the trick", () => {
    const tasks = [winTask("pending", "p1", "blue", 9)];
    const tricks = [
      trick("p2", [
        { playerId: "p1", color: "blue", rank: 9 },
        { playerId: "p2", color: "blue", rank: 8 },
      ]),
    ];
    const { tasks: next, result } = evaluateTasks(tasks, tricks, false);
    assert.equal(next[0]?.status, "failed");
    assert.equal(result, "failure");
  });

  it("player_wins_card: target in completed trick but assigned player wins", () => {
    const tasks = [winTask("pending", "p1", "red", 3)];
    const tricks = [
      trick("p1", [
        { playerId: "p2", color: "red", rank: 3 },
        { playerId: "p1", color: "red", rank: 9 },
      ]),
    ];
    const { tasks: next, result } = evaluateTasks(tasks, tricks, false);
    assert.equal(next[0]?.status, "satisfied");
    assert.equal(result, "success");
  });

  it("player_must_not_win: forbidden player plays card but another player wins", () => {
    const tasks = [mustNotWinTask("pending", "p1", "red", 1)];
    const tricks = [
      trick("p2", [
        { playerId: "p1", color: "red", rank: 1 },
        { playerId: "p2", color: "red", rank: 9 },
      ]),
    ];
    const { tasks: next, result } = evaluateTasks(tasks, tricks, false);
    assert.equal(next[0]?.status, "satisfied");
    assert.equal(result, "success");
  });

  it("player_must_not_win: target never played before hands empty becomes satisfied", () => {
    const tasks = [mustNotWinTask("pending", "p1", "green", 7)];
    const { tasks: next, result } = evaluateTasks(tasks, [], true);
    assert.equal(next[0]?.status, "satisfied");
    assert.equal(result, "success");
  });

  it("player_wins_card: target never played before hands empty becomes failed", () => {
    const tasks = [winTask("pending", "p1", "green", 7)];
    const { tasks: next, result } = evaluateTasks(tasks, [], true);
    assert.equal(next[0]?.status, "failed");
    assert.equal(result, "failure");
  });

  it("one trick satisfies one task and fails another", () => {
    const tasks = [
      winTask("pending", "p1", "blue", 9, "win"),
      mustNotWinTask("pending", "p1", "blue", 9, "forbid"),
    ];
    const tricks = [trick("p1", [{ playerId: "p1", color: "blue", rank: 9 }])];
    const { tasks: next, result } = evaluateTasks(tasks, tricks, false);
    assert.equal(next.find((t) => t.id === "win")?.status, "satisfied");
    assert.equal(next.find((t) => t.id === "forbid")?.status, "failed");
    assert.equal(result, "failure");
  });

  it("multiple target cards in the same trick resolve independently", () => {
    const tasks = [
      winTask("pending", "p1", "blue", 9, "a"),
      winTask("pending", "p2", "red", 1, "b"),
    ];
    const tricks = [
      trick("p1", [
        { playerId: "p1", color: "blue", rank: 9 },
        { playerId: "p2", color: "red", rank: 1 },
      ]),
    ];
    const { tasks: next, result } = evaluateTasks(tasks, tricks, false);
    assert.equal(next.find((t) => t.id === "a")?.status, "satisfied");
    assert.equal(next.find((t) => t.id === "b")?.status, "failed");
    assert.equal(result, "failure");
  });

  it("terminal tasks remain unchanged when re-evaluated", () => {
    const tasks = [
      winTask("satisfied", "p1", "blue", 9, "a"),
      winTask("failed", "p2", "green", 5, "b"),
      winTask("pending", "p1", "yellow", 4, "c"),
    ];
    const { tasks: next } = evaluateTasks(tasks, [], false);
    assert.deepEqual(
      next.map((entry) => [entry.id, entry.status]),
      [
        ["a", "satisfied"],
        ["b", "failed"],
        ["c", "pending"],
      ],
    );
  });
});

describe("markUndealtCardOutcomes adversarial", () => {
  it("marks multiple undealt win tasks failed simultaneously", () => {
    const mission = STARTER_MISSIONS[2]!;
    const resolved = resolveTasks(mission, ["p1", "p2"]);
    const next = markUndealtCardOutcomes(resolved, []);
    assert.equal(next.every((task) => task.status === "failed"), true);
  });

  it("leaves mixed dealt/undealt tasks at the correct statuses", () => {
    const tasks = [
      winTask("pending", "p1", "blue", 9, "dealt"),
      winTask("pending", "p2", "green", 5, "undealt"),
    ];
    const next = markUndealtCardOutcomes(tasks, [{ color: "blue", rank: 9 }]);
    assert.equal(next.find((t) => t.id === "dealt")?.status, "pending");
    assert.equal(next.find((t) => t.id === "undealt")?.status, "failed");
  });

  it("marks all undealt must-not-win tasks satisfied", () => {
    const tasks = [
      mustNotWinTask("pending", "p1", "red", 1, "a"),
      mustNotWinTask("pending", "p2", "yellow", 1, "b"),
    ];
    const next = markUndealtCardOutcomes(tasks, []);
    assert.equal(next.every((task) => task.status === "satisfied"), true);
    assert.equal(missionResultIfFullyDecided(next), "success");
  });
});
