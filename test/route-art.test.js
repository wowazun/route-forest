import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_ROUTE_LIGHT_STYLE,
  createRouteLightModel,
  createRouteLightPath,
  drawRouteLightFlow,
  sampleRouteLightPath,
} from "../public/route-art.js";

test("keeps the production light swarm bright with a short visible afterimage", () => {
  assert.equal(DEFAULT_ROUTE_LIGHT_STYLE.brightness, 0.86);
  assert.equal(DEFAULT_ROUTE_LIGHT_STYLE.tailLength, 0.11);
  assert.equal(DEFAULT_ROUTE_LIGHT_STYLE.trailPersistence, 0.64);
});

function treePoint(x, y, nodeId, size = 64) {
  return {
    x,
    y,
    source: { kind: "tree", nodeId, size },
  };
}

function recordingContext() {
  const operations = [];
  const context = {
    operations,
    beginPath: () => operations.push(["beginPath"]),
    ellipse: (...args) => operations.push(["ellipse", ...args]),
    fill: () => operations.push(["fill"]),
    lineTo: (...args) => operations.push(["lineTo", ...args]),
    moveTo: (...args) => operations.push(["moveTo", ...args]),
    quadraticCurveTo: (...args) =>
      operations.push(["quadraticCurveTo", ...args]),
    restore: () => operations.push(["restore"]),
    rotate: (...args) => operations.push(["rotate", ...args]),
    save: () => operations.push(["save"]),
    stroke: () => operations.push(["stroke"]),
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

test("creates a deterministic asymmetric route with two to four middle points", () => {
  const segment = {
    from: treePoint(40, 160, "node-a", 72),
    to: treePoint(310, 90, "node-b", 88),
    index: 3,
  };
  const first = createRouteLightPath(segment, "route-411", 1);
  const second = createRouteLightPath(segment, "route-411", 1);
  assert.deepEqual(first, second);
  assert.ok(first.controlPoints.length >= 4);
  assert.ok(first.controlPoints.length <= 6);
  assert.notDeepEqual(first.from, segment.from);
  assert.notDeepEqual(first.to, segment.to);
  assert.ok(first.samples.length > first.controlPoints.length);

  const different = createRouteLightPath(segment, "route-997", 1);
  assert.notDeepEqual(first.controlPoints, different.controlPoints);
});

test("samples the same stable path without frame-time randomness", () => {
  const path = createRouteLightPath(
    {
      from: treePoint(20, 100, "sample-a"),
      to: treePoint(280, 150, "sample-b"),
      index: 0,
    },
    "stable-route",
    1,
  );
  assert.deepEqual(
    sampleRouteLightPath(path, 0.37, 2),
    sampleRouteLightPath(path, 0.37, 2),
  );
});

test("omits unknown segments instead of drawing or inferring through fog", () => {
  const points = [
    treePoint(20, 120, "fog-a"),
    treePoint(110, 80, "fog-b"),
    { x: 180, y: 110, source: { kind: "fog" } },
    treePoint(250, 140, "fog-c"),
    treePoint(340, 90, "fog-d"),
  ];
  const model = createRouteLightModel({
    routeId: "fog-route",
    segments: points.slice(0, -1).map((from, index) => ({
      from,
      to: points[index + 1],
      index,
      unobserved:
        from.source.kind === "fog" || points[index + 1].source.kind === "fog",
    })),
  });
  assert.equal(model.segments.length, 2);
  assert.equal(model.segments[0].dissolvesIntoFog, true);
  assert.equal(model.segments[1].emergesFromFog, true);
  assert.equal(model.segments[0].index, 0);
  assert.equal(model.segments[1].index, 3);
  assert.deepEqual(
    model.events.map((event) => event.kind),
    ["observed", "fog", "observed"],
  );
});

test("draws only the current segment as a group of brush-shaped lights", () => {
  const context = recordingContext();
  const points = [
    treePoint(20, 120, "sequence-a"),
    treePoint(120, 80, "sequence-b"),
    treePoint(240, 150, "sequence-c"),
    treePoint(360, 90, "sequence-d"),
  ];
  drawRouteLightFlow(context, {
    routeId: "sequential-route",
    progress: 0.12,
    segments: points.slice(0, -1).map((from, index) => ({
      from,
      to: points[index + 1],
      index,
      unobserved: false,
    })),
  });
  assert.ok(
    context.operations.filter(([operation]) => operation === "ellipse").length >=
      3,
  );
  const xCoordinates = context.operations
    .filter(([operation]) => operation === "lineTo")
    .map(([, x]) => x);
  assert.ok(xCoordinates.length > 0);
  assert.ok(Math.max(...xCoordinates) < 190);
});

test("keeps the shared renderer independent from DOM and transport state", async () => {
  const source = await readFile(
    new URL("../public/route-art.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /\bdocument\b|\bwindow\b|EventSource|state\./);
  assert.match(source, /drawRouteLightFlow/);
});
