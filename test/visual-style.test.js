import assert from "node:assert/strict";
import test from "node:test";
import {
  assetContract,
  visualStyle,
} from "../public/visual-style.js";

test("defines stable semantic visual roles", () => {
  assert.equal(visualStyle.schemaVersion, 1);
  assert.equal(Object.keys(visualStyle.palette).length, 9);
  assert.equal(
    new Set(Object.values(visualStyle.palette)).size,
    Object.keys(visualStyle.palette).length,
  );
  assert.equal(Object.isFrozen(visualStyle.palette), true);
});

test("keeps causal motions faster than lingering memories", () => {
  assert.ok(
    visualStyle.motion.seedDropMs < visualStyle.motion.letterFoldMs,
  );
  assert.ok(
    visualStyle.motion.letterFoldMs < visualStyle.motion.routeHighlightMs,
  );
  assert.ok(
    visualStyle.motion.routeHighlightMs < visualStyle.motion.planeFlightMs,
  );
});

test("covers every replaceable art asset with an anchor and state", () => {
  assert.deepEqual(Object.keys(assetContract.assets), [
    "bird",
    "tree",
    "seed",
    "feather",
    "letter",
    "plane",
    "fog",
  ]);
  for (const asset of Object.values(assetContract.assets)) {
    assert.ok(asset.anchor.length > 0);
    assert.equal(asset.nominalSize.length, 2);
    assert.ok(asset.requiredStates.length > 0);
    assert.ok(asset.replaceWith.length > 0);
  }
});
