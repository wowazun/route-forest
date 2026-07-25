import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  BIRD_SILHOUETTES,
  birdWorldAnchor,
  drawBirdArt,
  smoothBirdHeading,
  uprightBirdPose,
} from "../public/bird-art.js";

function recordingContext() {
  const operations = [];
  const method = (name) => (...args) => operations.push([name, ...args]);
  return {
    operations,
    globalAlpha: 1,
    save: method("save"),
    restore: method("restore"),
    translate: method("translate"),
    rotate: method("rotate"),
    scale: method("scale"),
    beginPath: method("beginPath"),
    closePath: method("closePath"),
    moveTo: method("moveTo"),
    lineTo: method("lineTo"),
    bezierCurveTo: method("bezierCurveTo"),
    ellipse: method("ellipse"),
    arc: method("arc"),
    fill: method("fill"),
    stroke: method("stroke"),
  };
}

test("draws a filled bird with body, wings, head, and tail surfaces", () => {
  const context = recordingContext();
  const result = drawBirdArt(context, {
    x: 100,
    y: 80,
    angle: 0.3,
    flap: 0.5,
  });
  assert.equal(result.flap, 0.5);
  assert.ok(context.operations.filter(([name]) => name === "fill").length >= 6);
  assert.ok(context.operations.some(([name]) => name === "arc"));
  assert.ok(context.operations.some(([name]) => name === "bezierCurveTo"));
});

test("keeps release anchors below or behind the body", () => {
  const seed = birdWorldAnchor({ x: 10, y: 20, angle: 0, name: "seed" });
  const letter = birdWorldAnchor({
    x: 10,
    y: 20,
    angle: 0,
    name: "letter",
  });
  assert.ok(seed.y > 20);
  assert.ok(letter.y > 20);
  assert.ok(letter.x < 10);
});

test("keeps left-facing birds upright instead of rotating them upside down", () => {
  const pose = uprightBirdPose(Math.PI);
  assert.equal(pose.facing, -1);
  assert.ok(Math.abs(pose.angle) < 0.0001);

  const context = recordingContext();
  const result = drawBirdArt(context, {
    angle: Math.PI,
    flap: 0,
  });
  assert.equal(result.facing, -1);
  assert.ok(
    context.operations.some(
      ([name, xScale, yScale]) =>
        name === "scale" && xScale < 0 && yScale > 0,
    ),
  );

  const letter = birdWorldAnchor({
    x: 10,
    y: 20,
    angle: Math.PI,
    name: "letter",
  });
  assert.ok(letter.y > 20);
  assert.ok(letter.x > 10);
});

test("smooths heading across the shortest angular distance", () => {
  const next = smoothBirdHeading(3.1, -3.1, 1 / 60);
  assert.ok(next > 3.1);
  assert.ok(next - 3.1 < 0.1);
});

test("shares the bird renderer between production and Art Lab", async () => {
  const [displayArt, variants, artLab, html] = await Promise.all([
    readFile(new URL("../public/display-art.js", import.meta.url), "utf8"),
    readFile(new URL("../public/art-variants.js", import.meta.url), "utf8"),
    readFile(new URL("../public/art-lab.js", import.meta.url), "utf8"),
    readFile(new URL("../public/art-lab.html", import.meta.url), "utf8"),
  ]);
  assert.match(displayArt, /drawBirdArt/);
  assert.match(variants, /drawBirdArt/);
  assert.match(artLab, /drawBirdArt/);
  const presetOptions = html.match(
    /<select id="bird-preset">([\s\S]*?)<\/select>/,
  );
  const silhouetteOptions = html.match(
    /<select id="bird-silhouette">([\s\S]*?)<\/select>/,
  );
  assert.equal([...presetOptions[1].matchAll(/<option value="/g)].length, 15);
  assert.equal(
    [...silhouetteOptions[1].matchAll(/<option value="/g)].length,
    BIRD_SILHOUETTES.length,
  );
});
