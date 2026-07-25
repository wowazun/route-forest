import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("connects the mobile controller and display through owned server events", async () => {
  const [app, page, styles, display, displayPage, server] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../public/display.js", import.meta.url), "utf8"),
    readFile(new URL("../public/display.html", import.meta.url), "utf8"),
    readFile(new URL("../src/http/server.js", import.meta.url), "utf8"),
  ]);

  assert.match(page, /id="controller-pad"/);
  assert.match(page, /class="controller-pad-face"/);
  assert.match(page, /styles\.css\?v=4/);
  assert.match(page, /app\.js\?v=4/);
  assert.match(page, /id="controller-color-swatch"/);
  assert.match(page, /id="route-highlight-button"/);
  assert.match(app, /authorization: `Bearer/);
  assert.match(app, /--participant-color/);
  assert.match(app, /ensureControllerPadGeometry/);
  assert.match(app, /setInterval\(\(\) => \{\s*sendControllerInput/);
  assert.match(app, /"touchstart"/);
  assert.match(app, /"touchmove"/);
  assert.match(app, /controller-input-status is-sending/);
  assert.match(app, /beginControllerPointer\("tap"/);
  assert.match(styles, /\.controller-pad\s*\{[^}]*height:\s*248px/s);
  assert.match(
    styles,
    /@media \(max-width: 560px\)[\s\S]*?\.controller-pad\s*\{[^}]*height:\s*calc\(100vw - 76px\)/,
  );
  assert.match(display, /source\.addEventListener\("plane-control"/);
  assert.match(display, /source\.addEventListener\("route-highlight"/);
  assert.match(display, /source\.addEventListener\("controller-ended"/);
  assert.match(display, /Number\.POSITIVE_INFINITY/);
  assert.match(display, /paper: letter\.controller\.color/);
  assert.match(
    display,
    /state\.planes\.push\(\{\s*flightId: letter\.flightId,/,
  );
  assert.match(display, /function restoreControllerPlane/);
  assert.match(
    display,
    /controllerByMeasurement\.get\(measurementId\)/,
  );
  assert.match(display, /restoreControllerPlane\(route, now\)/);
  assert.match(displayPage, /display\.js\?v=14/);
  assert.match(
    display,
    /else if \(isDemo\) \{\s*startDemo\(\);\s*connectLiveEvents\(\);/,
  );
  assert.match(server, /controllerService\.input/);
  assert.match(server, /controllerService\.highlight/);
  assert.match(server, /appearanceForMeasurement/);
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
