import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MESSAGE_ART_VERSION,
  MESSAGE_STATES,
  messagePoseAt,
  messageProgressForState,
  messageStateAt,
} from "../public/message-art.js";

test("exposes the complete letter-to-plane visual sequence", () => {
  assert.equal(MESSAGE_ART_VERSION, "readable-fold-v1");
  assert.deepEqual(MESSAGE_STATES, [
    "dropping",
    "closed",
    "opening",
    "readable",
    "folding",
    "plane",
    "controllable",
  ]);
  for (const state of MESSAGE_STATES) {
    assert.equal(
      messageStateAt(messageProgressForState(state, 0.5)).state,
      state,
    );
  }
});

test("keeps the paper endpoint stable for plane release", () => {
  const before = messagePoseAt(0);
  const after = messagePoseAt(1);
  assert.deepEqual(before, {
    xOffset: 0,
    yOffset: 0,
    angle: 0,
  });
  assert.equal(after.yOffset, 26);
  assert.ok(Math.abs(after.xOffset) < 0.001);
  assert.ok(Number.isFinite(after.angle));
});

test("production and Art Lab import the same message renderer", async () => {
  const [displayArt, display, artLab, server] = await Promise.all([
    readFile(new URL("../public/display-art.js", import.meta.url), "utf8"),
    readFile(new URL("../public/display.js", import.meta.url), "utf8"),
    readFile(new URL("../public/art-lab.js", import.meta.url), "utf8"),
    readFile(new URL("../src/http/server.js", import.meta.url), "utf8"),
  ]);

  assert.match(displayArt, /from "\.\/message-art\.js"/);
  assert.match(display, /drawMessage\(context/);
  assert.match(display, /drawPaperPlane\(context/);
  assert.match(display, /messagePoseAt\(1\)/);
  assert.match(artLab, /from "\.\/message-art\.js"/);
  assert.match(artLab, /drawMessageArt\(context/);
  assert.match(server, /"\/message-art\.js"/);
});

test("Art Lab exposes every requested message preset and replay control", async () => {
  const html = await readFile(
    new URL("../public/art-lab.html", import.meta.url),
    "utf8",
  );
  for (const preset of [
    "closed",
    "dropping",
    "opening",
    "open",
    "readable",
    "fold-start",
    "fold-mid",
    "plane-near",
    "plane",
    "controllable",
    "sequence",
    "fog-sequence",
    "compare",
    "sizes",
  ]) {
    assert.match(html, new RegExp(`value="${preset}"`));
  }
  assert.match(html, /id="message-progress"/);
  assert.match(html, /id="message-replay"/);
});
