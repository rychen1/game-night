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

describe("missionResultIfFullyDecided", () => {
  const win = winTask("pending", "p1", "blue", 9, "a");
  const winB = winTask("pending", "p2", "green", 5, "b");

  it("returns null when any task is pending", () => {
    assert.equal(
      missionResultIfFullyDecided([
        winTask("pending", "p1", "blue", 9, "a"),
        winTask("pending", "p2", "green", 5, "b"),
      ]),
      null,
    );
    assert.equal(
      missionResultIfFullyDecided([
        winTask("failed", "p1", "blue", 9, "a"),
        winTask("pending", "p2", "green", 5, "b"),
      ]),
      null,
    );
    assert.equal(
      missionResultIfFullyDecided([
        winTask("satisfied", "p1", "blue", 9, "a"),
        winTask("pending", "p2", "green", 5, "b"),
      ]),
      null,
    );
  });

  it("returns failure when all tasks are terminal and at least one failed", () => {
    assert.equal(
      missionResultIfFullyDecided([
        winTask("failed", "p1", "blue", 9, "a"),
        winTask("failed", "p2", "green", 5, "b"),
      ]),
      "failure",
    );
    assert.equal(
      missionResultIfFullyDecided([
        winTask("satisfied", "p1", "blue", 9, "a"),
        winTask("failed", "p2", "green", 5, "b"),
      ]),
      "failure",
    );
  });

  it("returns success when all tasks are satisfied", () => {
    assert.equal(
      missionResultIfFullyDecided([
        winTask("satisfied", "p1", "blue", 9, "a"),
        winTask("satisfied", "p2", "green", 5, "b"),
      ]),
      "success",
    );
  });

  it("handles empty task list", () => {
    assert.equal(missionResultIfFullyDecided([]), null);
  });

  it("does not conflate with mid-mission semantics for failed + pending", () => {
    assert.equal(missionResultIfFullyDecided([winTask("failed", "p1", "blue", 9), winB]), null);
    assert.equal(missionResultFromTasks([winTask("failed", "p1", "blue", 9), winB]), "failure");
  });
});

describe("missionResultFromTasks", () => {
  it("returns failure when any task failed", () => {
    assert.equal(missionResultFromTasks([winTask("failed", "p1", "blue", 9)]), "failure");
    assert.equal(
      missionResultFromTasks([
        winTask("failed", "p1", "blue", 9, "a"),
        winTask("pending", "p2", "green", 5, "b"),
      ]),
      "failure",
    );
  });

  it("returns success when all tasks are satisfied", () => {
    assert.equal(
      missionResultFromTasks([
        winTask("satisfied", "p1", "blue", 9, "a"),
        winTask("satisfied", "p2", "green", 5, "b"),
      ]),
      "success",
    );
  });

  it("returns null when pending tasks remain and none failed", () => {
    assert.equal(
      missionResultFromTasks([
        winTask("pending", "p1", "blue", 9, "a"),
        winTask("pending", "p2", "green", 5, "b"),
      ]),
      null,
    );
    assert.equal(
      missionResultFromTasks([winTask("satisfied", "p1", "blue", 9, "a"), winTask("pending", "p2", "green", 5, "b")]),
      null,
    );
  });
});

describe("markUndealtCardOutcomes", () => {
  const mission = STARTER_MISSIONS[0]!;
  const resolved = resolveTasks(mission, ["p1", "p2"]);

  it("marks undealt player_wins_card tasks as failed", () => {
    const [next] = markUndealtCardOutcomes(resolved, []);
    assert.equal(next?.status, "failed");
  });

  it("leaves dealt player_wins_card tasks pending", () => {
    const target = resolved[0]!.def.card;
    const [next] = markUndealtCardOutcomes(resolved, [target]);
    assert.equal(next?.status, "pending");
  });

  it("marks undealt player_must_not_win tasks as satisfied", () => {
    const forbiddenMission = STARTER_MISSIONS[1]!;
    const forbidden = resolveTasks(forbiddenMission, ["p1", "p2"]);
    const [next] = markUndealtCardOutcomes(forbidden, []);
    assert.equal(next?.status, "satisfied");
  });

  it("leaves dealt player_must_not_win tasks pending", () => {
    const forbiddenMission = STARTER_MISSIONS[1]!;
    const forbidden = resolveTasks(forbiddenMission, ["p1", "p2"]);
    const target = forbidden[0]!.def.card;
    const [next] = markUndealtCardOutcomes(forbidden, [target]);
    assert.equal(next?.status, "pending");
  });
});

describe("evaluateTasks", () => {
  it("marks player_wins_card satisfied when the assigned player wins the trick", () => {
    const tasks = [winTask("pending", "p1", "blue", 9)];
    const tricks = [trick("p1", [{ playerId: "p1", color: "blue", rank: 9 }])];
    const { tasks: next, result } = evaluateTasks(tasks, tricks, false);
    assert.equal(next[0]?.status, "satisfied");
    assert.equal(result, "success");
  });

  it("marks player_wins_card failed when another player wins the trick", () => {
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

  it("marks player_must_not_win failed when the forbidden player wins the card", () => {
    const tasks = [mustNotWinTask("pending", "p1", "red", 1)];
    const tricks = [trick("p1", [{ playerId: "p1", color: "red", rank: 1 }])];
    const { tasks: next, result } = evaluateTasks(tasks, tricks, false);
    assert.equal(next[0]?.status, "failed");
    assert.equal(result, "failure");
  });

  it("marks player_must_not_win satisfied when another player wins the card", () => {
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

  it("leaves unresolved tasks pending", () => {
    const tasks = [winTask("pending", "p1", "blue", 9)];
    const { tasks: next, result } = evaluateTasks(tasks, [], false);
    assert.equal(next[0]?.status, "pending");
    assert.equal(result, null);
  });

  it("does not mutate already-terminal tasks", () => {
    const tasks = [
      task("failed", { type: "player_wins_card", playerSlot: 0, card: { color: "blue", rank: 9 } }),
      winTask("pending", "p2", "green", 5, "b"),
    ];
    const { tasks: next, result } = evaluateTasks(tasks, [], false);
    assert.equal(next[0]?.status, "failed");
    assert.equal(next[1]?.status, "pending");
    assert.equal(result, "failure");
  });
});
