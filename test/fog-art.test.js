import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createFogModel,
  fogDimensions,
  fogLifecycle,
} from "../public/fog-art.js";

test("creates a deterministic irregular fog model without ambient randomness", async () => {
  const options = {
    seed: "route-a:2:4:3",
    hopCount: 3,
    layerCount: 3,
    voidAmount: 0.34,
  };
  const first = createFogModel(options);
  const second = createFogModel(options);
  const different = createFogModel({ ...options, seed: "route-b:2:4:3" });

  assert.deepEqual(first, second);
  assert.notDeepEqual(first.layers[0].contour, different.layers[0].contour);
  assert.equal(first.layers.length, 3);
  assert.ok(first.layers.every((layer) => layer.voids.length >= 2));

  const source = await readFile(
    new URL("../public/fog-art.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /Math\.random|\bdocument\b|\bwindow\b/);
});

test("uses hop count mainly to extend fog horizontally", () => {
  const one = fogDimensions({ radius: 58, hopCount: 1 });
  const three = fogDimensions({ radius: 58, hopCount: 3 });
  const six = fogDimensions({ radius: 58, hopCount: 6 });

  assert.ok(one.width < three.width);
  assert.ok(three.width < six.width);
  assert.ok(six.width / one.width > six.height / one.height);
});

test("separates fog appearance, hold, and fade within the existing life", () => {
  const timing = {
    bornAt: 1_000,
    life: 10_000,
    appearMs: 1_800,
    holdMs: 5_200,
    fadeMs: 3_000,
  };
  const appearing = fogLifecycle(1_800, timing);
  const holding = fogLifecycle(6_000, timing);
  const fading = fogLifecycle(10_000, timing);

  assert.ok(appearing.presence > 0 && appearing.presence < 1);
  assert.ok(holding.presence > 0.95);
  assert.ok(fading.presence > 0 && fading.presence < holding.presence);
});

test("keeps the new fog renderer isolated to Art Lab after production rollback", async () => {
  const [displayArt, artLab, server] = await Promise.all([
    readFile(new URL("../public/display-art.js", import.meta.url), "utf8"),
    readFile(new URL("../public/art-lab.js", import.meta.url), "utf8"),
    readFile(new URL("../src/http/server.js", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(displayArt, /fog-art\.js/);
  assert.match(displayArt, /createFogTexture/);
  assert.match(artLab, /createFogRenderer/);
  assert.match(artLab, /FOG_PRESETS/);
  assert.match(server, /fog-art\.js/);
});
