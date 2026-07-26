import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createSmoothRouteChains,
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
  assert.equal(texture.width, 416);
  assert.equal(texture.height, 304);
  assert.equal(operationCount(context, "createRadialGradient"), 7);
  assert.equal(operationCount(context, "addColorStop"), 21);
  assert.equal(operationCount(context, "fillRect"), 7);
  for (const [, x, y, width, height] of context.operations.filter(
    ([operation]) => operation === "fillRect",
  )) {
    assert.ok(x >= 0);
    assert.ok(y >= 0);
    assert.ok(x + width <= texture.width);
    assert.ok(y + height <= texture.height);
  }
});

test("keeps the route hidden during flight and draws moving highlight marks", () => {
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
  assert.equal(operationCount(context, "setLineDash"), 0);
  assert.ok(operationCount(context, "bezierCurveTo") >= 7);
  assert.ok(operationCount(context, "fill") >= 6);

  const highlightContext = createRecordingContext();
  drawRouteHighlight(highlightContext, {
    segments,
    routeId: "route-a",
    progress: 0.25,
  });
  assert.ok(operationCount(highlightContext, "lineTo") > 4);
  assert.ok(operationCount(highlightContext, "ellipse") >= 3);
  assert.ok(operationCount(highlightContext, "stroke") > 4);
});

test("does not draw a normal route beneath fog", () => {
  const context = createRecordingContext();
  drawRoutePath(context, {
    segments: [
      {
        from: { x: 10, y: 20 },
        to: { x: 80, y: 50 },
        index: 0,
        unobserved: false,
      },
      {
        from: { x: 80, y: 50 },
        to: { x: 140, y: 46 },
        index: 1,
        unobserved: true,
      },
    ],
    routeId: "route-with-fog",
    bird: { x: 92, y: 48, angle: 0.1 },
    now: 1_500,
  });

  const routeStrokeStyles = context.operations
    .filter(([operation, property]) => operation === "set" && property === "strokeStyle")
    .map(([, , value]) => value)
    .filter((value) => String(value).includes("184, 222, 213"));
  assert.deepEqual(routeStrokeStyles, []);
  assert.equal(operationCount(context, "setLineDash"), 0);
});

test("never draws a highlighted line through an unobserved interval", () => {
  const context = createRecordingContext();
  drawRouteHighlight(context, {
    segments: [
      {
        from: { x: 10, y: 20 },
        to: { x: 80, y: 50 },
        index: 0,
        unobserved: false,
      },
      {
        from: { x: 80, y: 50 },
        to: { x: 140, y: 46 },
        index: 1,
        unobserved: true,
      },
    ],
    routeId: "highlight-with-fog",
    progress: 0.25,
  });

  assert.equal(operationCount(context, "setLineDash"), 0);
  const routeCoordinates = context.operations
    .filter(([operation]) => operation === "lineTo")
    .flatMap(([, x, y]) => [x, y]);
  assert.ok(routeCoordinates.every((value) => Number.isFinite(value)));
  assert.ok(
    context.operations
      .filter(([operation]) => operation === "set")
      .every(([, property, value]) =>
        property !== "strokeStyle" ||
        !String(value).includes("184, 222, 213"),
      ),
  );
});

test("keeps tree anchors exact while sharing a smooth tangent at joins", () => {
  const first = { x: 20, y: 90 };
  const middle = { x: 110, y: 42 };
  const last = { x: 210, y: 74 };
  const chains = createSmoothRouteChains(
    [
      { from: first, to: middle, index: 0 },
      { from: middle, to: last, index: 1 },
    ],
    "route-smooth",
  );

  assert.equal(chains.length, 1);
  assert.equal(chains[0].curves.length, 2);
  assert.equal(chains[0].start, first);
  assert.equal(chains[0].curves[0].to, middle);
  assert.equal(chains[0].curves[1].from, middle);
  assert.equal(chains[0].curves[1].to, last);

  const incoming = {
    x: middle.x - chains[0].curves[0].control2.x,
    y: middle.y - chains[0].curves[0].control2.y,
  };
  const outgoing = {
    x: chains[0].curves[1].control1.x - middle.x,
    y: chains[0].curves[1].control1.y - middle.y,
  };
  const cross = incoming.x * outgoing.y - incoming.y * outgoing.x;
  const dot = incoming.x * outgoing.x + incoming.y * outgoing.y;
  assert.ok(Math.abs(cross) < 1e-8);
  assert.ok(dot > 0);
});

test("does not smooth across a missing fog interval", () => {
  const chains = createSmoothRouteChains(
    [
      {
        from: { x: 10, y: 20 },
        to: { x: 70, y: 35 },
        index: 0,
      },
      {
        from: { x: 150, y: 48 },
        to: { x: 220, y: 62 },
        index: 3,
      },
    ],
    "route-with-fog",
  );
  assert.equal(chains.length, 2);
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
