import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("connects the mobile controller and display through owned server events", async () => {
  const [
    app,
    page,
    styles,
    display,
    displayPage,
    displayArt,
    routeArt,
    artLab,
    artLabPage,
    server,
  ] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../public/display.js", import.meta.url), "utf8"),
    readFile(new URL("../public/display.html", import.meta.url), "utf8"),
    readFile(new URL("../public/display-art.js", import.meta.url), "utf8"),
    readFile(new URL("../public/route-art.js", import.meta.url), "utf8"),
    readFile(new URL("../public/art-lab.js", import.meta.url), "utf8"),
    readFile(new URL("../public/art-lab.html", import.meta.url), "utf8"),
    readFile(new URL("../src/http/server.js", import.meta.url), "utf8"),
  ]);

  assert.match(page, /id="controller-pad"/);
  assert.match(page, /class="controller-pad-face"/);
  assert.match(page, /styles\.css\?v=6/);
  assert.match(page, /app\.js\?v=7/);
  assert.match(page, /id="controller-color-swatch"/);
  assert.match(page, /id="route-highlight-button"/);
  assert.match(page, /id="ui-preview-state"/);
  assert.match(page, /作品について/);
  assert.match(page, /自分の経路を光らせる/);
  assert.match(app, /あなたの紙飛行機/);
  assert.doesNotMatch(page, /ROUTE OBSERVATION|TECHNICAL STUDY|wordmark-mark/);
  for (const previewState of [
    "measuring",
    "carrying",
    "fog",
    "opening",
    "controllable",
    "reconnecting",
    "ended",
    "about",
  ]) {
    assert.match(page, new RegExp(`value="${previewState}"`));
  }
  assert.match(app, /authorization: `Bearer/);
  assert.match(app, /--participant-color/);
  assert.match(app, /ensureControllerPadGeometry/);
  assert.match(app, /UI_PREVIEW_STATES/);
  assert.match(app, /applyUiPreview/);
  assert.match(
    app,
    /あなたが選んだサイトまでの経路を、一羽の鳥がたどっています。\\n観測された中継地点は木として残り/,
  );
  assert.match(app, /setInterval\(\(\) => \{\s*sendControllerInput/);
  assert.match(app, /"touchstart"/);
  assert.match(app, /"touchmove"/);
  assert.match(app, /controller-input-status is-sending/);
  assert.match(app, /beginControllerPointer\("tap"/);
  assert.match(styles, /\.controller-pad\s*\{[^}]*max-width:\s*300px/s);
  assert.match(
    styles,
    /\.route-controller:not\(\[data-phase="controllable"\]\) \.controller-pad\s*\{[^}]*display:\s*none/s,
  );
  assert.match(styles, /\.controller-vector\s*\{[^}]*display:\s*none/s);
  assert.match(display, /source\.addEventListener\("plane-control"/);
  assert.match(display, /source\.addEventListener\("route-highlight"/);
  assert.match(display, /routeHighlightSegments\(points, plane\)/);
  assert.match(display, /source\.addEventListener\("controller-ended"/);
  assert.match(display, /Number\.POSITIVE_INFINITY/);
  assert.match(display, /paper: letter\.controller\.color/);
  assert.match(display, /seed: flight\.controller\.color/);
  assert.match(display, /palette: birdPalette/);
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
  assert.match(display, /dataset\.controllerPlanes/);
  assert.match(display, /heading: Math\.atan2\(initialVy, initialVx\)/);
  assert.match(
    display,
    /plane\.heading = Math\.atan2\(integrated\.vy, integrated\.vx\)/,
  );
  assert.doesNotMatch(display, /plane\.heading = smoothPlaneHeading/);
  assert.match(display, /shouldRevealFog\(pathPosition, index\)/);
  assert.match(display, /motionPath\.totalLength \/ speed/);
  assert.match(display, /pathPosition = bird\.pathPosition/);
  assert.match(display, /function updateWindMotes/);
  assert.match(display, /windField\.sample\(/);
  assert.match(display, /ambientWindMotes/);
  assert.match(display, /size: \(0\.65 \+ random\(\) \* 1\.35\) \* 1\.5/);
  assert.match(display, /windTrees\.length \* 42/);
  assert.match(display, /mote\.history\.length > 7/);
  assert.match(display, /context\.quadraticCurveTo\(/);
  assert.doesNotMatch(display, /mote\.x \* state\.width/);
  assert.match(displayPage, /display\.js\?v=45/);
  assert.match(display, /treeFieldSpread\(existing\.length\)/);
  assert.match(display, /if \(clearance >= 1\) return \{ nx, ny \}/);
  assert.match(display, /context\.scale\(calibration\.artScale/);
  assert.match(display, /--qr-scale/);
  assert.match(display, /route-forest-display-calibration-v1/);
  assert.match(display, /segments: travelRouteSegments\(points\)/);
  assert.match(display, /life:\s*prefersReducedMotion[\s\S]*visualStyle\.motion\.routeHighlightMs/);
  assert.doesNotMatch(
    display,
    /function completeFlight[\s\S]*?state\.highlights\.push[\s\S]*?function updateFlights/,
  );
  assert.match(displayArt, /from "\.\/route-art\.js\?v=2"/);
  assert.match(routeArt, /ROUTE_ART_VERSION/);
  assert.match(routeArt, /drawRouteLightFlow/);
  assert.match(artLab, /from "\.\/route-art\.js\?v=2"/);
  assert.match(artLab, /drawRouteLightFlow/);
  assert.match(artLabPage, /data-mode="route-lab"/);
  for (const preset of [
    "legacy",
    "brush",
    "particles",
    "particles-trail",
    "complete",
    "fog",
    "multi-segment",
    "multi-user",
    "long",
    "short",
  ]) {
    assert.match(artLabPage, new RegExp(`value="${preset}"`));
  }
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
