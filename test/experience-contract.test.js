import assert from "node:assert/strict";
import test from "node:test";
import {
  createBirdSequence,
  ExperienceContractError,
  readRouteObservation,
} from "../public/experience-contract.js";

function observation(overrides = {}) {
  return {
    schemaVersion: 2,
    measurementId: "route-1",
    observedAt: "2026-07-25T12:00:00.000Z",
    destination: { hostname: "example.com" },
    addressFamily: 4,
    method: "icmp",
    termination: { kind: "destination_reached", exitCode: 0 },
    steps: [
      {
        kind: "observed-node",
        hop: 1,
        nodes: [
          {
            nodeId: "node-1",
            addressFamily: 4,
            reachedTarget: false,
          },
        ],
        rttsMs: [1.2],
      },
      {
        kind: "unknown-segment",
        startHop: 2,
        endHop: 4,
        hopCount: 3,
      },
      {
        kind: "observed-node",
        hop: 5,
        nodes: [
          {
            nodeId: "node-5",
            addressFamily: 4,
            reachedTarget: true,
          },
        ],
        rttsMs: [8.4],
      },
    ],
    ...overrides,
  };
}

test("reads an anonymized route observation at the system boundary", () => {
  const input = observation();
  input.steps[0].nodes[0].treeVisitCount = 3;
  const route = readRouteObservation(input);

  assert.equal(route.schemaVersion, 2);
  assert.equal(route.steps[0].nodes[0].nodeId, "node-1");
  assert.equal(route.steps[0].nodes[0].treeVisitCount, 3);
  assert.equal(route.steps[2].nodes[0].reachedTarget, true);
  assert.equal(Object.isFrozen(route), true);
  assert.equal(JSON.stringify(route).includes("rttsMs"), false);
});

test("converts route steps into renderer-safe bird waypoints", () => {
  const sequence = createBirdSequence(observation());

  assert.deepEqual(
    sequence.waypoints.map((waypoint) => waypoint.kind),
    ["tree", "fog", "tree"],
  );
  assert.equal(sequence.kind, "bird-sequence");
  assert.equal(sequence.sequenceId, "route-1");
  assert.equal(sequence.destinationLabel, "example.com");
  assert.equal(sequence.waypoints[1].hopCount, 3);
  assert.equal(sequence.termination, "destination_reached");
});

test("rejects raw addresses and inconsistent unknown segments", () => {
  const withRawAddress = observation();
  withRawAddress.steps[0].nodes[0].address = "8.8.8.8";
  assert.throws(
    () => readRouteObservation(withRawAddress),
    ExperienceContractError,
  );

  const inconsistentFog = observation();
  inconsistentFog.steps[1].hopCount = 2;
  assert.throws(
    () => createBirdSequence(inconsistentFog),
    ExperienceContractError,
  );
});

test("rejects unsupported schema versions and termination kinds", () => {
  assert.throws(
    () => readRouteObservation(observation({ schemaVersion: 1 })),
    /schemaVersion/,
  );
  assert.throws(
    () =>
      readRouteObservation(
        observation({ termination: { kind: "command_error" } }),
      ),
    /termination/,
  );
});
