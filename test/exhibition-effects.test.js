import assert from "node:assert/strict";
import test from "node:test";
import {
  createArcLengthPath,
  letterTransform,
  lifecycleProgress,
  routeHighlightSegments,
  sampleArcLengthPath,
  shouldReleaseFeather,
  shouldRevealFog,
  visibleRouteSegments,
} from "../public/exhibition-effects.js";

test("clamps visual effect lifecycles", () => {
  assert.equal(lifecycleProgress(50, 0, 100), 0.5);
  assert.equal(lifecycleProgress(-10, 0, 100), 0);
  assert.equal(lifecycleProgress(200, 0, 100), 1);
});

test("samples unequal route segments at a constant path speed", () => {
  const path = createArcLengthPath([
    { x: 0, y: 0 },
    { x: 0, y: 100 },
    { x: 0, y: 500 },
  ]);
  const firstBoundary = sampleArcLengthPath(path, 100);
  const middleOfRoute = sampleArcLengthPath(path, 300);

  assert.equal(path.totalLength, 500);
  assert.ok(Math.abs(firstBoundary.y - 100) < 0.001);
  assert.ok(Math.abs(middleOfRoute.y - 300) < 0.001);
  assert.equal(firstBoundary.pathPosition, 1);
  assert.equal(middleOfRoute.pathPosition, 1.5);
});

test("folds a letter into a narrow paper-plane silhouette", () => {
  const letter = letterTransform(0);
  const plane = letterTransform(1);

  assert.equal(letter.fold, 0);
  assert.ok(plane.fold > 0.999);
  assert.ok(Math.abs(letter.points[1].y) > Math.abs(plane.points[1].y));
  assert.ok(plane.points[1].x > letter.points[1].x);
});

test("does not falsely illuminate unobserved fog intervals", () => {
  const points = [
    { source: { kind: "tree" }, x: 0, y: 0 },
    { source: { kind: "tree" }, x: 1, y: 1 },
    { source: { kind: "fog" }, x: 2, y: 1 },
    { source: { kind: "tree" }, x: 3, y: 0 },
    { source: { kind: "tree" }, x: 4, y: 0 },
  ];

  assert.deepEqual(
    visibleRouteSegments(points).map((segment) => segment.index),
    [0, 3],
  );
});

test("extends a route highlight to the moving owned paper plane", () => {
  const points = [
    { source: { kind: "tree" }, x: 10, y: 20 },
    { source: { kind: "tree" }, x: 50, y: 40 },
  ];
  const first = routeHighlightSegments(points, { x: 90, y: 70 });
  const moved = routeHighlightSegments(points, { x: 130, y: 95 });

  assert.equal(first.length, 2);
  assert.deepEqual(first.at(-1).from, points.at(-1));
  assert.deepEqual(first.at(-1).to, {
    x: 90,
    y: 70,
    source: { kind: "plane" },
  });
  assert.equal(moved.at(-1).to.x, 130);
  assert.equal(moved.at(-1).to.y, 95);
});

test("does not connect a highlight from an unobserved fog endpoint", () => {
  const points = [
    { source: { kind: "tree" }, x: 10, y: 20 },
    { source: { kind: "fog" }, x: 50, y: 40 },
  ];
  assert.deepEqual(routeHighlightSegments(points, { x: 90, y: 70 }), []);
});

test("reveals fog before the bird reaches its unknown waypoint", () => {
  assert.equal(shouldRevealFog(1.7, 3), false);
  assert.equal(shouldRevealFog(1.75, 3), true);
  assert.equal(shouldRevealFog(2.4, 3), true);
  assert.equal(shouldRevealFog(0, 1), true);
});

test("releases feathers for half of normal routes and all forced simulations", () => {
  assert.equal(shouldReleaseFeather(8), true);
  assert.equal(shouldReleaseFeather(9), false);
  assert.equal(shouldReleaseFeather(10), true);
  assert.equal(shouldReleaseFeather(11), false);
  assert.equal(shouldReleaseFeather(9, true), true);
});
