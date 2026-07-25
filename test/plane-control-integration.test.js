import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("connects the mobile controller and display through owned server events", async () => {
  const [app, page, display, server] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/display.js", import.meta.url), "utf8"),
    readFile(new URL("../src/http/server.js", import.meta.url), "utf8"),
  ]);

  assert.match(page, /id="controller-pad"/);
  assert.match(page, /id="route-highlight-button"/);
  assert.match(app, /authorization: `Bearer/);
  assert.match(app, /setInterval\(\(\) => \{\s*sendControllerInput/);
  assert.match(display, /source\.addEventListener\("plane-control"/);
  assert.match(display, /source\.addEventListener\("route-highlight"/);
  assert.match(server, /controllerService\.input/);
  assert.match(server, /controllerService\.highlight/);
});

test("shares wind and plane physics between production and Art Lab", async () => {
  const [display, artLab, html] = await Promise.all([
    readFile(new URL("../public/display.js", import.meta.url), "utf8"),
    readFile(new URL("../public/art-lab.js", import.meta.url), "utf8"),
    readFile(new URL("../public/art-lab.html", import.meta.url), "utf8"),
  ]);
  for (const source of [display, artLab]) {
    assert.match(source, /createWindField/);
    assert.match(source, /createTreeWindIndex/);
    assert.match(source, /combinePlaneForces/);
    assert.match(source, /integratePlane/);
  }
  for (const preset of [
    "control-only",
    "wind-only",
    "combined",
    "inertia",
    "no-trees",
    "small-tree",
    "large-tree",
    "multiple-trees",
    "strong-vortex",
    "weak-wind",
    "joystick",
    "release-to-wind",
  ]) {
    assert.match(html, new RegExp(`value="${preset}"`));
  }
});
