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
  assert.deepEqual(events.at(-1).x, 0);
  assert.deepEqual(events.at(-1).y, 0);
});
