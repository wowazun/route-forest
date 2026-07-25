import assert from "node:assert/strict";
import test from "node:test";
import {
  letterTransform,
  lifecycleProgress,
  shouldReleaseFeather,
  visibleRouteSegments,
} from "../public/exhibition-effects.js";

test("clamps visual effect lifecycles", () => {
  assert.equal(lifecycleProgress(50, 0, 100), 0.5);
  assert.equal(lifecycleProgress(-10, 0, 100), 0);
  assert.equal(lifecycleProgress(200, 0, 100), 1);
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

test("keeps feathers rare outside forced simulation playback", () => {
  assert.equal(shouldReleaseFeather(8), true);
  assert.equal(shouldReleaseFeather(9), false);
  assert.equal(shouldReleaseFeather(9, true), true);
});
