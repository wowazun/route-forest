import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createFogTexture,
  drawBird,
  drawFog,
  drawRouteHighlight,
  drawRoutePath,
  drawTree,
} from "../public/display-art.js";

function createRecordingContext() {
  const operations = [];
  const context = {
    operations,
    globalAlpha: 1,
    beginPath: (...args) => operations.push(["beginPath", ...args]),
    arc: (...args) => operations.push(["arc", ...args]),
    bezierCurveTo: (...args) =>
      operations.push(["bezierCurveTo", ...args]),
    closePath: (...args) => operations.push(["closePath", ...args]),
    drawImage: (...args) => operations.push(["drawImage", ...args]),
    ellipse: (...args) => operations.push(["ellipse", ...args]),
    fill: (...args) => operations.push(["fill", ...args]),
    fillRect: (...args) => operations.push(["fillRect", ...args]),
    lineTo: (...args) => operations.push(["lineTo", ...args]),
    moveTo: (...args) => operations.push(["moveTo", ...args]),
    quadraticCurveTo: (...args) =>
      operations.push(["quadraticCurveTo", ...args]),
    restore: (...args) => operations.push(["restore", ...args]),
    rotate: (...args) => operations.push(["rotate", ...args]),
    save: (...args) => operations.push(["save", ...args]),
    scale: (...args) => operations.push(["scale", ...args]),
    setLineDash: (...args) => operations.push(["setLineDash", ...args]),
    stroke: (...args) => operations.push(["stroke", ...args]),
    translate: (...args) => operations.push(["translate", ...args]),
    createRadialGradient: (...args) => {
      operations.push(["createRadialGradient", ...args]);
      return {
        addColorStop: (...stopArgs) =>
          operations.push(["addColorStop", ...stopArgs]),
      };
    },
  };
  return new Proxy(context, {
    set(target, property, value) {
      operations.push(["set", property, value]);
      target[property] = value;
      return true;
    },
  });
}

function operationCount(context, name) {
  return context.operations.filter(([operation]) => operation === name).length;
}

test("keeps the display art module independent from DOM and transport state", async () => {
  const source = await readFile(
    new URL("../public/display-art.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /\bdocument\b|\bwindow\b|EventSource|state\./);
});

test("builds the existing fog texture with seven radial gradients", () => {
  const context = createRecordingContext();
  const texture = {
    width: 0,
    height: 0,
    getContext: () => context,
  };

  assert.equal(createFogTexture(texture, () => 0.5), texture);
  assert.equal(texture.width, 256);
  assert.equal(texture.height, 144);
  assert.equal(operationCount(context, "createRadialGradient"), 7);
  assert.equal(operationCount(context, "addColorStop"), 21);
  assert.equal(operationCount(context, "fillRect"), 7);
});

test("preserves the dashed route, bird, and highlight drawing commands", () => {
  const context = createRecordingContext();
  const segments = [
    {
      from: { x: 10, y: 20 },
      to: { x: 80, y: 50 },
      index: 0,
    },
  ];

  drawRoutePath(context, {
    segments,
    routeId: "route-a",
    bird: { x: 42, y: 31, angle: 0.4 },
    now: 1_200,
  });
  assert.deepEqual(
    context.operations.find(([operation]) => operation === "setLineDash"),
    ["setLineDash", [2, 8]],
  );
  assert.ok(operationCount(context, "quadraticCurveTo") >= 1);
  assert.ok(operationCount(context, "bezierCurveTo") >= 6);
  assert.ok(operationCount(context, "fill") >= 6);

  const highlightContext = createRecordingContext();
  drawRouteHighlight(highlightContext, {
    segments,
    routeId: "route-a",
    progress: 0.25,
  });
  assert.equal(operationCount(highlightContext, "quadraticCurveTo"), 1);
  assert.equal(operationCount(highlightContext, "stroke"), 1);
});

test("draws trees and fog without mutating their logical state", () => {
  const treeContext = createRecordingContext();
  const tree = {
    size: 32,
    sway: 0.25,
    variant: 1,
    count: 4,
  };
  const originalTree = structuredClone(tree);
  drawTree(treeContext, {
    tree,
    position: { x: 120, y: 180 },
    now: 2_000,
  });
  assert.deepEqual(tree, originalTree);
  assert.equal(operationCount(treeContext, "translate"), 1);
  assert.ok(operationCount(treeContext, "stroke") >= 2);

  const fogContext = createRecordingContext();
  const fog = {
    x: 200,
    y: 120,
    radius: 60,
    bornAt: 1_000,
    life: 8_000,
    phase: 0.4,
  };
  const originalFog = structuredClone(fog);
  drawFog(fogContext, {
    fog,
    now: 3_000,
    texture: { id: "fog-texture" },
  });
  assert.deepEqual(fog, originalFog);
  assert.equal(operationCount(fogContext, "drawImage"), 3);
});

test("keeps the bird renderer callable as an isolated public function", () => {
  const context = createRecordingContext();
  drawBird(context, {
    x: 40,
    y: 50,
    angle: 0.2,
    now: 900,
  });
  assert.ok(operationCount(context, "bezierCurveTo") >= 6);
  assert.ok(operationCount(context, "ellipse") >= 4);
  assert.ok(operationCount(context, "arc") >= 1);
});
