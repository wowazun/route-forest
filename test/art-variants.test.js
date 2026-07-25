import assert from "node:assert/strict";
import test from "node:test";
import {
  getArtVariant,
  listArtVariants,
  lowPolyBirdSpec,
} from "../public/art-variants.js";

test("offers three directions and one assembled candidate", () => {
  const variants = listArtVariants();
  assert.deepEqual(
    variants.map((variant) => variant.id),
    ["folded-grove", "ink-vein", "signal-canopy", "facet-wing-ink"],
  );
  assert.equal(new Set(variants.map((variant) => variant.thesis)).size, 4);
  assert.equal(Object.isFrozen(variants[0]), true);
  assert.deepEqual(
    {
      birdStyle: variants[3].birdStyle,
      treeStyle: variants[3].treeStyle,
      recommended: variants[3].recommended,
    },
    {
      birdStyle: "soft-wing",
      treeStyle: "ink-vein",
      recommended: true,
    },
  );
});

test("rejects an unknown art direction", () => {
  assert.throws(() => getArtVariant("generic-dashboard"), RangeError);
});

test("keeps the supplied low-poly bird as six non-indexed triangles", () => {
  assert.equal(lowPolyBirdSpec.triangles.length, 6);
  assert.equal(lowPolyBirdSpec.triangles.flat().length, 18);
  assert.ok(
    lowPolyBirdSpec.triangles
      .flat()
      .every((vertex) => vertex.length === 5),
  );
  assert.equal(lowPolyBirdSpec.worldScale, 1.5);
  assert.equal(
    lowPolyBirdSpec.wingFlapRadians,
    (34 * Math.PI) / 180,
  );
  assert.equal(lowPolyBirdSpec.maxRollRadians, (30 * Math.PI) / 180);
  assert.equal(Object.isFrozen(lowPolyBirdSpec.triangles[0][0]), true);
});
