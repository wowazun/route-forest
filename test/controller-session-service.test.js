import assert from "node:assert/strict";
import test from "node:test";
import {
  ControllerSessionError,
  ControllerSessionService,
} from "../src/application/controller-session-service.js";

function completedRecord(observedAt) {
  return {
    measurementId: "measurement-a",
    status: "completed",
    updatedAt: observedAt,
    observation: {
      observedAt,
      steps: [{ kind: "observed-node" }, { kind: "observed-node" }],
    },
  };
}

test("binds an opaque controller token to exactly one measurement", () => {
  let now = new Date("2026-07-26T00:00:00.000Z");
  let record = {
    measurementId: "measurement-a",
    status: "running",
    updatedAt: now.toISOString(),
  };
  const events = [];
  const service = new ControllerSessionService({
    recordProvider: () => record,
    clock: () => now,
    tokenFactory: () => "a".repeat(43),
    uuidFactory: () => "11111111-1111-4111-8111-111111111111",
  });
  service.subscribe((event) => events.push(event));
  const controller = service.create("measurement-a");
  assert.match(controller.color, /^#[0-9a-f]{6}$/);
  assert.deepEqual(service.activeAppearances()[0], {
    measurementId: "measurement-a",
    sessionId: controller.sessionId,
    color: controller.color,
    expiresAt: controller.expiresAt,
  });

  assert.equal(
    service.status(controller.sessionId, controller.token).phase,
    "measuring",
  );
  assert.throws(
    () => service.status(controller.sessionId, "b".repeat(43)),
    (error) =>
      error instanceof ControllerSessionError &&
      error.code === "controller_unauthorized",
  );
  assert.throws(
    () =>
      service.input(controller.sessionId, controller.token, {
        x: 1,
        y: 0,
        sequence: 0,
      }),
    (error) => error.code === "plane_not_ready",
  );

  record = completedRecord(now.toISOString());
  now = new Date(now.getTime() + 10_000);
  assert.equal(
    service.status(controller.sessionId, controller.token).phase,
    "controllable",
  );
  const accepted = service.input(controller.sessionId, controller.token, {
    x: 4,
    y: -3,
    sequence: 1,
  });
  assert.deepEqual(accepted, {
    accepted: true,
    sequence: 1,
    x: 1,
    y: -1,
  });
  assert.equal(events[0].measurementId, "measurement-a");
  assert.equal("planeId" in events[0], false);
});

test("rate-limits input, cools down highlights, and neutralizes on end", () => {
  let now = new Date("2026-07-26T00:00:20.000Z");
  const record = completedRecord("2026-07-26T00:00:00.000Z");
  const events = [];
  const service = new ControllerSessionService({
    recordProvider: () => record,
    clock: () => now,
    tokenFactory: () => "c".repeat(43),
    uuidFactory: () => "22222222-2222-4222-8222-222222222222",
  });
  service.subscribe((event) => events.push(event));
  const controller = service.create("measurement-a");

  service.input(controller.sessionId, controller.token, {
    x: 0.4,
    y: 0,
    sequence: 1,
  });
  assert.throws(
    () =>
      service.input(controller.sessionId, controller.token, {
        x: 0.5,
        y: 0,
        sequence: 2,
      }),
    (error) => error.code === "controller_rate_limited",
  );
  service.input(controller.sessionId, controller.token, {
    x: 0,
    y: 0,
    sequence: 3,
  });

  service.highlight(controller.sessionId, controller.token);
  assert.throws(
    () => service.highlight(controller.sessionId, controller.token),
    (error) => error.code === "highlight_rate_limited",
  );
  now = new Date(now.getTime() + 5_100);
  service.highlight(controller.sessionId, controller.token);
  service.end(controller.sessionId, controller.token);
  assert.equal(
    service.status(controller.sessionId, controller.token).phase,
    "ended",
  );
  const neutral = events.findLast((event) => event.type === "plane-control");
  assert.deepEqual(neutral.x, 0);
  assert.deepEqual(neutral.y, 0);
  assert.equal(events.at(-1).type, "controller-ended");
});

test("ends the plane when the phone-to-server session disappears", () => {
  let now = new Date("2026-07-26T00:00:00.000Z");
  const record = completedRecord(now.toISOString());
  const events = [];
  const service = new ControllerSessionService({
    recordProvider: () => record,
    clock: () => now,
    tokenFactory: () => "d".repeat(43),
    uuidFactory: () => "33333333-3333-4333-8333-333333333333",
  });
  service.subscribe((event) => events.push(event));
  const controller = service.create("measurement-a");

  now = new Date("2026-07-26T00:00:10.000Z");
  assert.equal(
    service.status(controller.sessionId, controller.token).phase,
    "controllable",
  );
  now = new Date("2026-07-26T00:01:40.000Z");
  assert.equal(
    service.status(controller.sessionId, controller.token).phase,
    "ended",
  );
  assert.equal(events.at(-1).type, "controller-ended");
  assert.equal(events.at(-1).reason, "disconnected");
});

test("assigns distinct colors to concurrent phone sessions", () => {
  const now = new Date("2026-07-26T00:00:00.000Z");
  const sessionIds = [
    "44444444-4444-4444-8444-444444444444",
    "55555555-5555-4555-8555-555555555555",
  ];
  const service = new ControllerSessionService({
    recordProvider: () => ({
      measurementId: "active",
      status: "running",
      updatedAt: now.toISOString(),
    }),
    clock: () => now,
    tokenFactory: () => "e".repeat(43),
    uuidFactory: () => sessionIds.shift(),
  });

  const first = service.create("measurement-first");
  const second = service.create("measurement-second");
  assert.notEqual(first.color, second.color);
});

test("ends and removes every controller session during an exhibition reset", () => {
  const now = new Date("2026-07-26T00:00:00.000Z");
  const sessionIds = [
    "66666666-6666-4666-8666-666666666666",
    "77777777-7777-4777-8777-777777777777",
  ];
  const events = [];
  const service = new ControllerSessionService({
    recordProvider: () => completedRecord(now.toISOString()),
    clock: () => now,
    tokenFactory: () => "f".repeat(43),
    uuidFactory: () => sessionIds.shift(),
  });
  service.subscribe((event) => events.push(event));
  const first = service.create("measurement-first");
  service.create("measurement-second");

  assert.deepEqual(service.getResetSummary(), {
    activeSessions: 2,
    retainedSessions: 2,
  });
  const cleared = service.resetAll();
  assert.equal(cleared.activeSessions, 2);
  assert.deepEqual(service.activeAppearances(), []);
  assert.throws(
    () => service.status(first.sessionId, first.token),
    (error) => error.code === "controller_unauthorized",
  );
  assert.equal(
    events.filter(
      (event) =>
        event.type === "controller-ended" &&
        event.reason === "exhibition-reset",
    ).length,
    2,
  );
});
