import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  createConnectionGeneration,
  invokeLifecycleCallback,
  nextReconnectDelayMs,
  resetConnectionGenerationsForTests,
  shouldAttemptImmediateReconnect,
  shouldScheduleReconnect,
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

describe("socket reconnect policy", () => {
  it("backs off then caps the replace-on-close delay", () => {
    assert.equal(nextReconnectDelayMs(0), 500);
    assert.equal(nextReconnectDelayMs(1), 1_000);
    assert.equal(nextReconnectDelayMs(2), 2_000);
    assert.equal(nextReconnectDelayMs(3), 5_000);
    assert.equal(nextReconnectDelayMs(8), 5_000);
  });

  it("schedules reconnect only for unexpected closes", () => {
    assert.equal(shouldScheduleReconnect(false), true);
    assert.equal(shouldScheduleReconnect(true), false);
  });

  it("resumes immediately only when the socket is not already opening", () => {
    assert.equal(
      shouldAttemptImmediateReconnect({
        closedByClient: false,
        readyState: 3,
        connecting: 0,
        open: 1,
      }),
      true,
    );
    assert.equal(
      shouldAttemptImmediateReconnect({
        closedByClient: false,
        readyState: 0,
        connecting: 0,
        open: 1,
      }),
      false,
    );
    assert.equal(
      shouldAttemptImmediateReconnect({
        closedByClient: false,
        readyState: 1,
        connecting: 0,
        open: 1,
      }),
      false,
    );
    assert.equal(
      shouldAttemptImmediateReconnect({
        closedByClient: true,
        readyState: 3,
        connecting: 0,
        open: 1,
      }),
      false,
    );
  });
});
