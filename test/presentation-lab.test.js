import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readPublic = (filename) =>
  readFile(new URL(`../public/${filename}`, import.meta.url), "utf8");

test("presentation lab exposes all proposal capture assets", async () => {
  const html = await readPublic("presentation-lab.html");
  for (const asset of [
    "bird",
    "seed",
    "tree",
    "wind",
    "message",
    "plane",
    "feather",
    "fog",
  ]) {
    assert.match(html, new RegExp(`data-asset="${asset}"`));
  }
  assert.match(html, /id="count"/);
  assert.match(html, /id="size"/);
  assert.match(html, /id="save-png"/);
});

test("presentation lab reuses the production art renderers", async () => {
  const script = await readPublic("presentation-lab.js");
  assert.match(script, /drawBirdArt/);
  assert.match(script, /drawTreeArt/);
  assert.match(script, /drawMessageArt/);
  assert.match(script, /drawPaperPlaneArt/);
  assert.match(script, /drawFeatherArt/);
  assert.match(script, /drawFog/);
  assert.match(script, /createWindField/);
  assert.match(script, /__routeForestPresentationLab/);
});
