import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createFeatherGeometry,
  drawFeatherArt,
  featherPoseAt,
} from "../public/feather-art.js";

test("builds a curved shaft with many root-tapered barbs", () => {
  const geometry = createFeatherGeometry({
    barbsPerSide: 15,
    rootTaper: 0.74,
    seed: "route-feather",
  });
  const right = geometry.barbs.filter((barb) => barb.side === 1);

  assert.equal(geometry.shaft.length, 4);
  assert.equal(geometry.barbs.length, 30);
  assert.ok(right[0].length < right[Math.floor(right.length / 2)].length);
  assert.notEqual(geometry.shaft[0].x, geometry.shaft[3].x);
});

test("moves a falling feather down while swaying to both sides", () => {
  const first = featherPoseAt(0.125, 0);
  const second = featherPoseAt(0.375, 0);
  const later = featherPoseAt(0.75, 0);

  assert.ok(first.x > 0);
  assert.ok(second.x < 0);
  assert.ok(first.y < second.y);
  assert.ok(second.y < later.y);
});

test("draws barbs as curved strokes without an enclosing ellipse", () => {
  const commands = [];
  const context = {
    globalAlpha: 1,
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    scale() {},
    beginPath() {},
    moveTo() {},
    quadraticCurveTo() {
      commands.push("barb");
    },
    bezierCurveTo() {
      commands.push("shaft");
    },
    stroke() {},
  };

  drawFeatherArt(context, { barbsPerSide: 12, alpha: 1 });
  assert.equal(commands.filter((command) => command === "barb").length, 24);
  assert.equal(commands.filter((command) => command === "shaft").length, 1);
});

test("shares the feather renderer between production and Art Lab", async () => {
  const [display, artLab, html] = await Promise.all([
    readFile(new URL("../public/display.js", import.meta.url), "utf8"),
    readFile(new URL("../public/art-lab.js", import.meta.url), "utf8"),
    readFile(new URL("../public/art-lab.html", import.meta.url), "utf8"),
  ]);

  assert.match(display, /from "\.\/feather-art\.js"/);
  assert.match(display, /drawFeatherArt\(context/);
  assert.match(artLab, /from "\.\/feather-art\.js"/);
  assert.match(artLab, /drawFeatherWorkbench/);
  assert.match(html, /data-mode="feather-lab"/);
  for (const id of [
    "feather-progress",
    "feather-barbs",
    "feather-curve",
    "feather-taper",
    "feather-sway",
    "feather-fall",
    "feather-size",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});
