import assert from "node:assert/strict";
import test from "node:test";
import {
  combinePlaneForces,
  createCurlNoise,
  createTreeWindIndex,
  createWindField,
  integratePlane,
  smoothPlaneHeading,
} from "../public/flow-field.js";
import { visualStyle } from "../public/visual-style.js";

test("creates a deterministic, time-varying curl field", () => {
  const first = createCurlNoise({ seed: 411 });
  const second = createCurlNoise({ seed: 411 });

  assert.deepEqual(first.sample(320, 180, 2), second.sample(320, 180, 2));
  assert.notDeepEqual(first.sample(320, 180, 2), first.sample(320, 180, 8));
  assert.ok(Number.isFinite(first.sample(320, 180, 2).x));
  assert.ok(Number.isFinite(first.sample(320, 180, 2).y));
});

test("adds a bounded deterministic turn around nearby growing trees", () => {
  const field = createWindField({
    seed: 411,
    treeInfluence: 0.8,
    treeRadius: 120,
  });
  const empty = createTreeWindIndex();
  const trees = createTreeWindIndex({
    trees: [{ x: 300, y: 200, size: 58, seed: "tree-a" }],
  });
  const withoutTree = field.sample(340, 200, 4, empty);
  const withTree = field.sample(340, 200, 4, trees);

  assert.notDeepEqual(withTree, withoutTree);
  assert.deepEqual(withTree, field.sample(340, 200, 4, trees));
  assert.ok(Math.hypot(withTree.x, withTree.y) <= 1.0001);
});

test("keeps the shared wind calm away from tree-centered vortices", () => {
  const field = createWindField({
    seed: 411,
    treeInfluence: 0.8,
    treeRadius: 120,
  });
  const empty = createTreeWindIndex();
  const trees = createTreeWindIndex({
    trees: [{ x: 300, y: 200, size: 58, seed: "tree-a" }],
  });

  assert.deepEqual(field.sample(20, 20, 4, empty), { x: 0, y: 0 });
  assert.deepEqual(field.sample(20, 20, 4, trees), { x: 0, y: 0 });
  assert.ok(Math.hypot(...Object.values(field.sample(340, 200, 4, trees))) > 0);
});

test("allows ambient curl only when explicitly requested", () => {
  const field = createWindField({ baseInfluence: 1 });
  assert.ok(
    Math.hypot(...Object.values(field.sample(320, 180, 2))) > 0,
  );
});

test("limits tree lookup and keeps heading stable near zero speed", () => {
  const index = createTreeWindIndex({
    trees: Array.from({ length: 40 }, (_, item) => ({
      x: 100 + (item % 8) * 3,
      y: 100 + Math.floor(item / 8) * 3,
      size: 20,
      seed: item,
    })),
    maximumNearby: 8,
  });
  assert.equal(index.query(110, 110).length, 8);
  assert.equal(
    smoothPlaneHeading(0.7, { x: 0.1, y: 0.1 }, 0.016),
    0.7,
  );
  assert.notEqual(
    smoothPlaneHeading(0, { x: 0, y: 20 }, 0.1),
    0,
  );
});

test("keeps production paper-plane heading highly responsive", () => {
  assert.ok(visualStyle.physics.plane.headingResponse >= 30);
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
