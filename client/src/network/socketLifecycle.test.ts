import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  createConnectionGeneration,
  invokeLifecycleCallback,
  resetConnectionGenerationsForTests,
} from "./socketLifecycle.ts";

describe("socket connection generation", () => {
  beforeEach(() => {
    resetConnectionGenerationsForTests();
  });

  it("ignores a stale close after a newer socket supersedes it", () => {
    const openCalls: string[] = [];
    const closeCalls: string[] = [];

    const socketA = createConnectionGeneration();
    invokeLifecycleCallback(socketA, () => openCalls.push("A"));

    const socketB = createConnectionGeneration();
    invokeLifecycleCallback(socketB, () => openCalls.push("B"));
    assert.deepEqual(openCalls, ["A", "B"]);

    assert.equal(
      invokeLifecycleCallback(socketA, () => closeCalls.push("A")),
      false,
    );
    assert.deepEqual(closeCalls, []);
  });

  it("honors close on the current socket generation", () => {
    const closeCalls: string[] = [];

    const socketB = createConnectionGeneration();

    invokeLifecycleCallback(socketB, () => closeCalls.push("B-open"));
    assert.equal(
      invokeLifecycleCallback(socketB, () => closeCalls.push("B-close")),
      true,
    );
    assert.deepEqual(closeCalls, ["B-open", "B-close"]);
  });

  it("ignores a stale open after a newer socket supersedes it", () => {
    const openCalls: string[] = [];

    const socketA = createConnectionGeneration();
    createConnectionGeneration();

    assert.equal(
      invokeLifecycleCallback(socketA, () => openCalls.push("A")),
      false,
    );
    assert.deepEqual(openCalls, []);
  });

  it("allows the current generation to open and close normally", () => {
    const events: string[] = [];
    const socket = createConnectionGeneration();

    assert.equal(
      invokeLifecycleCallback(socket, () => events.push("open")),
      true,
    );
    assert.equal(
      invokeLifecycleCallback(socket, () => events.push("close")),
      true,
    );
    assert.deepEqual(events, ["open", "close"]);
  });
});
