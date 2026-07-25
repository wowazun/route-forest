import assert from "node:assert/strict";
import test from "node:test";
import {
  combinePlaneForces,
  createCurlNoise,
  integratePlane,
} from "../public/flow-field.js";

test("creates a deterministic, time-varying curl field", () => {
  const first = createCurlNoise({ seed: 411 });
  const second = createCurlNoise({ seed: 411 });

  assert.deepEqual(first.sample(320, 180, 2), second.sample(320, 180, 2));
  assert.notDeepEqual(first.sample(320, 180, 2), first.sample(320, 180, 8));
  assert.ok(Number.isFinite(first.sample(320, 180, 2).x));
  assert.ok(Number.isFinite(first.sample(320, 180, 2).y));
});

test("keeps the sampled field approximately divergence free", () => {
  const field = createCurlNoise({ seed: 92 });
  const epsilon = 0.5;
  const x = 410;
  const y = 260;
  const time = 3;
  const dVxDx =
    (field.sample(x + epsilon, y, time).x -
      field.sample(x - epsilon, y, time).x) /
    (2 * epsilon);
  const dVyDy =
    (field.sample(x, y + epsilon, time).y -
      field.sample(x, y - epsilon, time).y) /
    (2 * epsilon);

  assert.ok(Math.abs(dVxDx + dVyDy) < 0.001);
});

test("makes full visitor input stronger than opposing default wind", () => {
  const forces = combinePlaneForces({
    wind: { x: -1, y: 0 },
    control: { x: 1, y: 0 },
  });

  assert.equal(forces.windForce.x, -26);
  assert.equal(forces.controlForce.x, 80);
  assert.equal(forces.totalForce.x, 54);
});

test("integrates motion without exceeding the configured speed", () => {
  const next = integratePlane(
    { x: 10, y: 20, vx: 500, vy: 0 },
    { x: 100, y: 40 },
    0.5,
    { maxSpeed: 120 },
  );

  assert.ok(Math.hypot(next.vx, next.vy) <= 120.0001);
  assert.ok(next.x > 10);
  assert.ok(next.y > 20);
});
