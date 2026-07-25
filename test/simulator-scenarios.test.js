import assert from "node:assert/strict";
import test from "node:test";
import { createBirdSequence } from "../public/experience-contract.js";
import {
  createSimulation,
  listSimulationScenarios,
} from "../public/simulator-scenarios.js";

test("covers every required simulator scenario", () => {
  const scenarios = listSimulationScenarios();
  assert.equal(scenarios.length, 16);
  assert.deepEqual(
    new Set(scenarios.map((scenario) => scenario.group)),
    new Set(["route", "load", "transport"]),
  );
});

test("produces contract-valid observations for every visual scenario", () => {
  for (const scenario of listSimulationScenarios()) {
    const simulation = createSimulation(scenario.id, {
      runId: `test-${scenario.id}`,
      startedAt: Date.parse("2026-07-25T00:00:00.000Z"),
    });
    for (const event of simulation.events) {
      if (event.type !== "observation") continue;
      const sequence = createBirdSequence(event.observation);
      assert.equal(sequence.kind, "bird-sequence", scenario.id);
    }
  }
});

test("keeps unknown hops consolidated into explicit fog segments", () => {
  const simulation = createSimulation("unknown-three", {
    runId: "unknown-three",
    startedAt: 0,
  });
  const sequence = createBirdSequence(simulation.events[0].observation);
  const fog = sequence.waypoints.find((waypoint) => waypoint.kind === "fog");

  assert.deepEqual(fog, {
    kind: "fog",
    startHop: 2,
    endHop: 4,
    hopCount: 3,
  });
});

test("creates load and reconnect timelines without raw addresses", () => {
  const planes = createSimulation("many-planes", {
    runId: "planes",
    startedAt: 0,
  });
  const reconnect = createSimulation("client-reconnect", {
    runId: "reconnect",
    startedAt: 0,
  });

  assert.equal(planes.events.length, 36);
  assert.deepEqual(
    reconnect.events.map((event) => event.type),
    ["connection", "connection", "connection", "observation"],
  );
  assert.equal(JSON.stringify([planes, reconnect]).includes('"address"'), false);
});
