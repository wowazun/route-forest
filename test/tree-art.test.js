import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  clearTreeModelCache,
  createTreeModel,
  drawTreeArt,
  getTreeArtCacheKey,
  getTreeMetrics,
  TREE_ART_VERSION,
  treeModelCacheSize,
} from "../public/tree-art.js";

function createRecordingContext() {
  const operations = [];
  const context = {
    operations,
    globalAlpha: 1,
    beginPath: (...args) => operations.push(["beginPath", ...args]),
    bezierCurveTo: (...args) =>
      operations.push(["bezierCurveTo", ...args]),
    ellipse: (...args) => operations.push(["ellipse", ...args]),
    fill: (...args) => operations.push(["fill", ...args]),
    moveTo: (...args) => operations.push(["moveTo", ...args]),
    restore: (...args) => operations.push(["restore", ...args]),
    save: (...args) => operations.push(["save", ...args]),
    stroke: (...args) => operations.push(["stroke", ...args]),
    translate: (...args) => operations.push(["translate", ...args]),
  };
  return new Proxy(context, {
    set(target, property, value) {
      operations.push(["set", property, value]);
      target[property] = value;
      return true;
    },
  });
}

function modelSignature(model) {
  return JSON.stringify({
    templateIndex: model.templateIndex,
    widthFactor: model.widthFactor,
    lean: model.lean,
    curve: model.curve,
    leafBias: model.leafBias,
    branchEnds: model.branches.map((branch) => branch.end),
    leaves: model.leaves.map((leaf) => [leaf.x, leaf.y, leaf.radiusX]),
  });
}

test("creates a frozen deterministic tree model from the node seed", () => {
  clearTreeModelCache();
  const first = createTreeModel("node-alpha");
  const second = createTreeModel("node-alpha");

  assert.equal(first, second);
  assert.equal(modelSignature(first), modelSignature(second));
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.branches[0]), true);
  assert.equal(treeModelCacheSize(), 1);
});

test("produces substantial but bounded variation across twelve seeds", () => {
  const models = Array.from({ length: 12 }, (_, index) =>
    createTreeModel(`variation-${index}`),
  );
  const signatures = new Set(models.map(modelSignature));
  const templates = new Set(models.map((model) => model.templateIndex));

  assert.ok(signatures.size >= 10);
  assert.ok(templates.size >= 5);
  assert.ok(
    models.every(
      (model) =>
        model.branches.length === 4 &&
        model.twigs.length === 5 &&
        model.leaves.length <= 14,
    ),
  );
});

test("adds dimensions, branches, twigs, and leaf clusters monotonically", () => {
  const model = createTreeModel("growth-reference");
  const metrics = Array.from({ length: 6 }, (_, index) => {
    const growth = index / 5;
    return getTreeMetrics(model, {
      size: 2 + growth * 56,
      growth,
    });
  });

  assert.deepEqual(
    metrics.map((metric) => metric.stage),
    [1, 2, 3, 4, 5, 6],
  );
  for (let index = 1; index < metrics.length; index += 1) {
    const previous = metrics[index - 1];
    const current = metrics[index];
    assert.ok(current.height >= previous.height);
    assert.ok(current.width >= previous.width);
    assert.ok(current.trunkWidth >= previous.trunkWidth);
    assert.ok(current.visibleMajorBranches >= previous.visibleMajorBranches);
    assert.ok(current.visibleTwigs >= previous.visibleTwigs);
    assert.ok(current.visibleLeafClusters >= previous.visibleLeafClusters);
  }
  assert.equal(metrics[0].visibleMajorBranches, 0);
  assert.equal(metrics.at(-1).visibleMajorBranches, 4);
  assert.equal(metrics.at(-1).visibleTwigs, 5);
  assert.ok(metrics.at(-1).visibleLeafClusters >= 12);
  assert.ok(metrics.at(-1).commandBudget <= 24);
});

test("draws deterministically without mutating the model", () => {
  const model = createTreeModel("draw-reference");
  const before = modelSignature(model);
  const first = createRecordingContext();
  const second = createRecordingContext();

  drawTreeArt(first, { model, size: 48, growth: 0.82, x: 20, y: 90 });
  drawTreeArt(second, { model, size: 48, growth: 0.82, x: 20, y: 90 });

  assert.deepEqual(first.operations, second.operations);
  assert.equal(modelSignature(model), before);
  assert.ok(
    first.operations.some(([operation]) => operation === "bezierCurveTo"),
  );
  assert.ok(first.operations.some(([operation]) => operation === "ellipse"));
});

test("includes every full-layer invalidation input in the cache key", () => {
  const base = {
    width: 1920,
    height: 1080,
    pixelRatio: 1,
    variant: "ink-vein",
    revision: 3,
  };
  const key = getTreeArtCacheKey(base);
  assert.match(key, new RegExp(TREE_ART_VERSION));
  assert.notEqual(getTreeArtCacheKey({ ...base, width: 1919 }), key);
  assert.notEqual(getTreeArtCacheKey({ ...base, height: 1079 }), key);
  assert.notEqual(getTreeArtCacheKey({ ...base, pixelRatio: 2 }), key);
  assert.notEqual(
    getTreeArtCacheKey({ ...base, variant: "future-tree" }),
    key,
  );
  assert.notEqual(getTreeArtCacheKey({ ...base, revision: 4 }), key);
  assert.notEqual(
    getTreeArtCacheKey({
      ...base,
      palette: {
        leaf: "#000000",
        mist: "#9dbbc0",
      },
    }),
    key,
  );
});

test("keeps the renderer independent from DOM, time, and ambient randomness", async () => {
  const source = await readFile(
    new URL("../public/tree-art.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /\bdocument\b|\bwindow\b|performance\.now|Date\.now|Math\.random/,
  );
});

test("connects production and Art Lab ink trees to the same renderer", async () => {
  const [display, displayArt, variants, artLab] = await Promise.all([
    readFile(new URL("../public/display.js", import.meta.url), "utf8"),
    readFile(new URL("../public/display-art.js", import.meta.url), "utf8"),
    readFile(new URL("../public/art-variants.js", import.meta.url), "utf8"),
    readFile(new URL("../public/art-lab.js", import.meta.url), "utf8"),
  ]);

  assert.match(display, /getTreeArtCacheKey/);
  assert.match(display, /currentPixelRatio !== state\.pixelRatio/);
  assert.match(display, /state\.treeLayerDirty = true/);
  assert.match(displayArt, /drawTreeArt/);
  assert.match(variants, /import \{ drawTreeArt \} from "\.\/tree-art\.js"/);
  assert.match(variants, /treeStyle === "ink-vein"/);
  assert.match(artLab, /drawTreeVariant/);
  assert.match(artLab, /seed: tree\.seed/);
});
