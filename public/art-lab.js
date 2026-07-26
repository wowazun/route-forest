import {
  drawBirdVariant,
  drawTreeVariant,
  listArtVariants,
} from "./art-variants.js";
import {
  BIRD_SILHOUETTES,
  birdFlapAt,
  birdWorldAnchor,
  drawBirdArt,
  smoothBirdHeading,
} from "./bird-art.js";
import {
  createFogRenderer,
  drawLegacyFogArt,
  fogDimensions,
} from "./fog-art.js";
import { strokeSmoothRoute } from "./display-art.js";
import {
  drawLegacyMessageArt,
  drawMessageArt,
  drawPaperPlaneArt,
  messageProgressForState,
  messageStateAt,
} from "./message-art.js";
import {
  combinePlaneForces,
  createTreeWindIndex,
  createWindField,
  integratePlane,
  smoothPlaneHeading,
} from "./flow-field.js";
import {
  DEFAULT_FEATHER_ART,
  drawFeatherArt,
  featherPoseAt,
} from "./feather-art.js?v=2";
import { visualStyle } from "./visual-style.js";

const proofs = document.querySelector("#proofs");
const treeAge = document.querySelector("#tree-age");
const treeAgeOutput = document.querySelector("#tree-age-output");
const density = document.querySelector("#density");
const densityOutput = document.querySelector("#density-output");
const toggleMotion = document.querySelector("#toggle-motion");
const selectedLink = document.querySelector("#selected-link");
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const birdPreset = document.querySelector("#bird-preset");
const birdSilhouette = document.querySelector("#bird-silhouette");
const birdFlap = document.querySelector("#bird-flap");
const birdAngle = document.querySelector("#bird-angle");
const birdSize = document.querySelector("#bird-size");
const birdSpeed = document.querySelector("#bird-speed");
const birdGlow = document.querySelector("#bird-glow");
const birdFog = document.querySelector("#bird-fog");
const birdCount = document.querySelector("#bird-count");
const birdOutputs = {
  flap: document.querySelector("#bird-flap-output"),
  angle: document.querySelector("#bird-angle-output"),
  size: document.querySelector("#bird-size-output"),
  speed: document.querySelector("#bird-speed-output"),
  glow: document.querySelector("#bird-glow-output"),
  fog: document.querySelector("#bird-fog-output"),
  count: document.querySelector("#bird-count-output"),
};
const featherPreset = document.querySelector("#feather-preset");
const featherProgress = document.querySelector("#feather-progress");
const featherBarbs = document.querySelector("#feather-barbs");
const featherCurve = document.querySelector("#feather-curve");
const featherTaper = document.querySelector("#feather-taper");
const featherSway = document.querySelector("#feather-sway");
const featherFall = document.querySelector("#feather-fall");
const featherSize = document.querySelector("#feather-size");
const featherReplay = document.querySelector("#feather-replay");
const featherOutputs = {
  progress: document.querySelector("#feather-progress-output"),
  barbs: document.querySelector("#feather-barbs-output"),
  curve: document.querySelector("#feather-curve-output"),
  taper: document.querySelector("#feather-taper-output"),
  sway: document.querySelector("#feather-sway-output"),
  fall: document.querySelector("#feather-fall-output"),
  size: document.querySelector("#feather-size-output"),
};
const fogPreset = document.querySelector("#fog-preset");
const fogHops = document.querySelector("#fog-hops");
const fogLength = document.querySelector("#fog-length");
const fogHeight = document.querySelector("#fog-height");
const fogOpacity = document.querySelector("#fog-opacity");
const fogLayers = document.querySelector("#fog-layers");
const fogVoid = document.querySelector("#fog-void");
const fogSpeed = document.querySelector("#fog-speed");
const fogAppear = document.querySelector("#fog-appear");
const fogHold = document.querySelector("#fog-hold");
const fogFade = document.querySelector("#fog-fade");
const fogBird = document.querySelector("#fog-bird");
const fogOutputs = {
  hops: document.querySelector("#fog-hops-output"),
  length: document.querySelector("#fog-length-output"),
  height: document.querySelector("#fog-height-output"),
  opacity: document.querySelector("#fog-opacity-output"),
  layers: document.querySelector("#fog-layers-output"),
  void: document.querySelector("#fog-void-output"),
  speed: document.querySelector("#fog-speed-output"),
  appear: document.querySelector("#fog-appear-output"),
  hold: document.querySelector("#fog-hold-output"),
  fade: document.querySelector("#fog-fade-output"),
  bird: document.querySelector("#fog-bird-output"),
};
const messagePreset = document.querySelector("#message-preset");
const messageProgress = document.querySelector("#message-progress");
const messageDrop = document.querySelector("#message-drop");
const messageOpening = document.querySelector("#message-opening");
const messageReadable = document.querySelector("#message-readable");
const messageFolding = document.querySelector("#message-folding");
const messageGlow = document.querySelector("#message-glow");
const messageSize = document.querySelector("#message-size");
const messageContrast = document.querySelector("#message-contrast");
const messageReplay = document.querySelector("#message-replay");
const messageOutputs = {
  progress: document.querySelector("#message-progress-output"),
  drop: document.querySelector("#message-drop-output"),
  opening: document.querySelector("#message-opening-output"),
  readable: document.querySelector("#message-readable-output"),
  folding: document.querySelector("#message-folding-output"),
  glow: document.querySelector("#message-glow-output"),
  size: document.querySelector("#message-size-output"),
  contrast: document.querySelector("#message-contrast-output"),
};
const windPreset = document.querySelector("#wind-preset");
const windControlPad = document.querySelector("#wind-control-pad");
const windControlKnob = document.querySelector("#wind-control-knob");
const windInputX = document.querySelector("#wind-input-x");
const windInputY = document.querySelector("#wind-input-y");
const windStrengthControl = document.querySelector("#wind-strength");
const windControlStrength = document.querySelector("#wind-control");
const windDrag = document.querySelector("#wind-drag");
const windMaxSpeed = document.querySelector("#wind-max-speed");
const windScale = document.querySelector("#wind-scale");
const windTime = document.querySelector("#wind-time");
const windTree = document.querySelector("#wind-tree");
const windRadius = document.querySelector("#wind-radius");
const windSeed = document.querySelector("#wind-seed");
const windEnabled = document.querySelector("#wind-enabled");
const windTrail = document.querySelector("#wind-trail");
const windVectors = document.querySelector("#wind-vectors");
const windReset = document.querySelector("#wind-reset");
const windOutputs = {
  x: document.querySelector("#wind-input-x-output"),
  y: document.querySelector("#wind-input-y-output"),
  strength: document.querySelector("#wind-strength-output"),
  control: document.querySelector("#wind-control-output"),
  drag: document.querySelector("#wind-drag-output"),
  maxSpeed: document.querySelector("#wind-max-speed-output"),
  scale: document.querySelector("#wind-scale-output"),
  time: document.querySelector("#wind-time-output"),
  tree: document.querySelector("#wind-tree-output"),
  radius: document.querySelector("#wind-radius-output"),
  seed: document.querySelector("#wind-seed-output"),
};
const fogRenderer = createFogRenderer({
  createCanvas: () => document.createElement("canvas"),
});
const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
const searchParameters = new URLSearchParams(window.location.search);
const variants = listArtVariants();
const proofStates = [];
const modes = new Set([
  "ensemble",
  "flight",
  "growth",
  "fog",
  "tree-variations",
  "tree-growth",
  "bird-lab",
  "bird-silhouettes",
  "adopted-wing",
  "feather-lab",
  "fog-lab",
  "message-lab",
  "plane-wind-lab",
]);
let mode = modes.has(searchParameters.get("mode"))
  ? searchParameters.get("mode")
  : "ensemble";
let paused = reducedMotion;
let selectedVariant = variants.some(
  (variant) => variant.id === searchParameters.get("variant"),
)
  ? searchParameters.get("variant")
  : null;
let lastFrame = performance.now();
let sceneTime = 2_400;
let flapAutomatic = true;
let featherAutomatic = true;
let messageAutomatic = false;
let windPadPointer = null;
let windFieldCache = null;
let windFieldCacheKey = "";

function clamp(value, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

const BIRD_PRESETS = Object.freeze({
  "normal-flight": Object.freeze({ flap: null, angle: 0, size: 100, speed: 100, glow: 35, fog: 0, count: 1 }),
  "wing-up": Object.freeze({ flap: 100, angle: 0, size: 125, speed: 0, glow: 28, fog: 0, count: 1 }),
  "wing-mid": Object.freeze({ flap: 0, angle: 0, size: 125, speed: 0, glow: 28, fog: 0, count: 1 }),
  "wing-down": Object.freeze({ flap: -100, angle: 0, size: 125, speed: 0, glow: 28, fog: 0, count: 1 }),
  "straight-flight": Object.freeze({ flap: null, angle: 0, size: 100, speed: 115, glow: 35, fog: 0, count: 1 }),
  "curve-flight": Object.freeze({ flap: null, angle: 0, size: 100, speed: 90, glow: 38, fog: 0, count: 1 }),
  "direction-turn": Object.freeze({ flap: null, angle: 0, size: 110, speed: 75, glow: 42, fog: 0, count: 1 }),
  "seed-drop": Object.freeze({ flap: null, angle: 0, size: 110, speed: 55, glow: 42, fog: 0, count: 1 }),
  "letter-drop": Object.freeze({ flap: 5, angle: 0, size: 110, speed: 45, glow: 48, fog: 0, count: 1 }),
  "fog-enter": Object.freeze({ flap: null, angle: 0, size: 110, speed: 55, glow: 48, fog: 100, count: 1 }),
  "fog-inside": Object.freeze({ flap: 0, angle: 0, size: 115, speed: 18, glow: 38, fog: 100, count: 1 }),
  "fog-exit": Object.freeze({ flap: null, angle: 0, size: 110, speed: 55, glow: 48, fog: 100, count: 1 }),
  "normal-glow": Object.freeze({ flap: null, angle: 0, size: 120, speed: 45, glow: 35, fog: 0, count: 1 }),
  "strong-glow": Object.freeze({ flap: null, angle: 0, size: 120, speed: 45, glow: 100, fog: 0, count: 1 }),
  flock: Object.freeze({ flap: null, angle: 0, size: 82, speed: 80, glow: 24, fog: 0, count: 8 }),
});

const FEATHER_PRESETS = Object.freeze({
  falling: Object.freeze({ automatic: true, progress: 0.38, scene: "single" }),
  closeup: Object.freeze({ automatic: false, progress: 0.5, scene: "closeup" }),
  trio: Object.freeze({ automatic: true, progress: 0.2, scene: "trio" }),
  compare: Object.freeze({ automatic: false, progress: 0.5, scene: "compare" }),
});

const FOG_PRESETS = Object.freeze({
  "hop-one": Object.freeze({ hops: 1, length: 88, height: 92, opacity: 42, layers: 3, void: 38, speed: 100, bird: 12, scene: "single", progress: 0.46 }),
  "hop-three": Object.freeze({ hops: 3, length: 108, height: 100, opacity: 46, layers: 3, void: 34, speed: 100, bird: 12, scene: "single", progress: 0.46 }),
  "hop-six": Object.freeze({ hops: 6, length: 124, height: 106, opacity: 49, layers: 3, void: 31, speed: 115, bird: 12, scene: "single", progress: 0.46 }),
  short: Object.freeze({ hops: 2, length: 72, height: 88, opacity: 44, layers: 3, void: 38, speed: 105, bird: 18, scene: "single", progress: 0.48 }),
  long: Object.freeze({ hops: 5, length: 152, height: 104, opacity: 48, layers: 3, void: 34, speed: 112, bird: 18, scene: "single", progress: 0.48 }),
  approach: Object.freeze({ hops: 3, length: 110, height: 100, opacity: 46, layers: 3, void: 35, speed: 100, bird: 24, scene: "bird", progress: 0.42 }),
  enter: Object.freeze({ hops: 3, length: 110, height: 100, opacity: 46, layers: 3, void: 35, speed: 100, bird: 43, scene: "bird", progress: 0.46 }),
  inside: Object.freeze({ hops: 3, length: 112, height: 100, opacity: 48, layers: 3, void: 34, speed: 82, bird: 55, scene: "bird", progress: 0.5 }),
  exit: Object.freeze({ hops: 3, length: 112, height: 100, opacity: 46, layers: 3, void: 35, speed: 108, bird: 76, scene: "bird", progress: 0.54 }),
  after: Object.freeze({ hops: 3, length: 112, height: 100, opacity: 44, layers: 3, void: 38, speed: 116, bird: 92, scene: "bird", progress: 0.64 }),
  fading: Object.freeze({ hops: 3, length: 112, height: 100, opacity: 44, layers: 3, void: 52, speed: 126, bird: 100, scene: "bird", progress: 0.86 }),
  double: Object.freeze({ hops: 3, length: 92, height: 92, opacity: 40, layers: 3, void: 38, speed: 92, bird: 52, scene: "double", progress: 0.5 }),
  flock: Object.freeze({ hops: 4, length: 118, height: 108, opacity: 38, layers: 3, void: 38, speed: 96, bird: 56, scene: "flock", progress: 0.5 }),
  compare: Object.freeze({ hops: 3, length: 100, height: 100, opacity: 46, layers: 3, void: 34, speed: 100, bird: 55, scene: "compare", progress: 0.5 }),
});

const MESSAGE_PRESETS = Object.freeze({
  closed: Object.freeze({ progress: messageProgressForState("closed", 0.5) }),
  dropping: Object.freeze({ progress: messageProgressForState("dropping", 0.58) }),
  opening: Object.freeze({ progress: messageProgressForState("opening", 0.38) }),
  open: Object.freeze({ progress: messageProgressForState("readable", 0.05) }),
  readable: Object.freeze({ progress: messageProgressForState("readable", 0.72) }),
  "fold-start": Object.freeze({ progress: messageProgressForState("folding", 0.12) }),
  "fold-mid": Object.freeze({ progress: messageProgressForState("folding", 0.52) }),
  "plane-near": Object.freeze({ progress: messageProgressForState("folding", 0.88) }),
  plane: Object.freeze({ progress: messageProgressForState("plane", 0.55) }),
  controllable: Object.freeze({ progress: messageProgressForState("controllable", 0.56) }),
  sequence: Object.freeze({ automatic: true }),
  "fog-sequence": Object.freeze({ automatic: true, fromFog: true }),
  compare: Object.freeze({ compare: true, progress: messageProgressForState("folding", 0.52) }),
  sizes: Object.freeze({ sizes: true, progress: messageProgressForState("readable", 0.72) }),
});

const WIND_PRESETS = Object.freeze({
  "control-only": Object.freeze({ wind: 0, control: 86, trees: "none", x: 72, y: -18, enabled: false, tree: 0 }),
  "wind-only": Object.freeze({ wind: 32, control: 0, trees: "small", x: 0, y: 0, enabled: true, tree: 34 }),
  combined: Object.freeze({ wind: 26, control: 80, trees: "multiple", x: 48, y: -18, enabled: true, tree: 34 }),
  inertia: Object.freeze({ wind: 0, control: 0, trees: "none", x: 0, y: 0, enabled: false, tree: 0 }),
  "no-trees": Object.freeze({ wind: 28, control: 0, trees: "none", x: 0, y: 0, enabled: true, tree: 0 }),
  "small-tree": Object.freeze({ wind: 28, control: 0, trees: "small", x: 0, y: 0, enabled: true, tree: 28 }),
  "large-tree": Object.freeze({ wind: 28, control: 0, trees: "large", x: 0, y: 0, enabled: true, tree: 46 }),
  "multiple-trees": Object.freeze({ wind: 28, control: 0, trees: "multiple", x: 0, y: 0, enabled: true, tree: 38 }),
  "strong-vortex": Object.freeze({ wind: 48, control: 68, trees: "large", x: 38, y: -12, enabled: true, tree: 92 }),
  "weak-wind": Object.freeze({ wind: 10, control: 80, trees: "small", x: 42, y: -8, enabled: true, tree: 22 }),
  joystick: Object.freeze({ wind: 26, control: 80, trees: "multiple", x: 0, y: 0, enabled: true, tree: 34 }),
  "release-to-wind": Object.freeze({ wind: 30, control: 80, trees: "large", x: 65, y: -18, enabled: true, tree: 52, release: true }),
});

function updateBirdControlOutputs() {
  birdOutputs.flap.textContent = flapAutomatic
    ? "AUTO"
    : `${birdFlap.value}%`;
  birdOutputs.angle.textContent = `${birdAngle.value}°`;
  birdOutputs.size.textContent = `${birdSize.value}%`;
  birdOutputs.speed.textContent = `${birdSpeed.value}%`;
  birdOutputs.glow.textContent = `${birdGlow.value}%`;
  birdOutputs.fog.textContent = `${birdFog.value}%`;
  birdOutputs.count.textContent = birdCount.value;
}

function updateFeatherControlOutputs(
  progressValue = Number(featherProgress.value) / 1000,
) {
  featherOutputs.progress.textContent = `${Math.round(progressValue * 100)}%`;
  featherOutputs.barbs.textContent = featherBarbs.value;
  featherOutputs.curve.textContent = `${featherCurve.value}%`;
  featherOutputs.taper.textContent = `${featherTaper.value}%`;
  featherOutputs.sway.textContent = `${featherSway.value}px`;
  featherOutputs.fall.textContent = `${featherFall.value}px`;
  featherOutputs.size.textContent = `${featherSize.value}%`;
}

function applyFeatherPreset(name) {
  const selected = FEATHER_PRESETS[name] || FEATHER_PRESETS.falling;
  featherPreset.value = name in FEATHER_PRESETS ? name : "falling";
  featherAutomatic = Boolean(selected.automatic);
  featherProgress.value = String(Math.round(selected.progress * 1000));
  if (featherAutomatic) {
    sceneTime = 0;
    paused = false;
    toggleMotion.classList.remove("is-selected");
  }
  updateFeatherControlOutputs(selected.progress);
  const url = new URL(window.location.href);
  url.searchParams.set("featherPreset", featherPreset.value);
  window.history.replaceState({}, "", url);
  selectedLink.href = url.pathname + url.search;
}

function updateFogControlOutputs() {
  fogOutputs.hops.textContent = fogHops.value;
  fogOutputs.length.textContent = `${fogLength.value}%`;
  fogOutputs.height.textContent = `${fogHeight.value}%`;
  fogOutputs.opacity.textContent = `${fogOpacity.value}%`;
  fogOutputs.layers.textContent = fogLayers.value;
  fogOutputs.void.textContent = `${fogVoid.value}%`;
  fogOutputs.speed.textContent = `${fogSpeed.value}%`;
  fogOutputs.appear.textContent = `${fogAppear.value}ms`;
  fogOutputs.hold.textContent = `${fogHold.value}ms`;
  fogOutputs.fade.textContent = `${fogFade.value}ms`;
  fogOutputs.bird.textContent = `${fogBird.value}%`;
}

function updateMessageControlOutputs(progressValue = Number(messageProgress.value) / 1000) {
  messageOutputs.progress.textContent = `${Math.round(progressValue * 100)}%`;
  messageOutputs.drop.textContent = `${messageDrop.value}%`;
  messageOutputs.opening.textContent = `${messageOpening.value}ms`;
  messageOutputs.readable.textContent = `${messageReadable.value}ms`;
  messageOutputs.folding.textContent = `${messageFolding.value}ms`;
  messageOutputs.glow.textContent = `${messageGlow.value}%`;
  messageOutputs.size.textContent = `${messageSize.value}%`;
  messageOutputs.contrast.textContent = `${messageContrast.value}%`;
}

function updateWindControlOutputs() {
  windOutputs.x.textContent = `${windInputX.value}%`;
  windOutputs.y.textContent = `${windInputY.value}%`;
  windOutputs.strength.textContent = windStrengthControl.value;
  windOutputs.control.textContent = windControlStrength.value;
  windOutputs.drag.textContent = (Number(windDrag.value) / 100).toFixed(2);
  windOutputs.maxSpeed.textContent = windMaxSpeed.value;
  windOutputs.scale.textContent = (Number(windScale.value) / 10_000).toFixed(4);
  windOutputs.time.textContent = (Number(windTime.value) / 100).toFixed(2);
  windOutputs.tree.textContent = (Number(windTree.value) / 100).toFixed(2);
  windOutputs.radius.textContent = windRadius.value;
  windOutputs.seed.textContent = windSeed.value;
}

function resetWindProofs() {
  for (const proof of proofStates) {
    proof.planeWind = null;
    proof.windTreeIndex = null;
    proof.windTreeKey = "";
    proof.lastWindTime = sceneTime;
  }
}

function applyWindPreset(name) {
  const selected = WIND_PRESETS[name] || WIND_PRESETS.combined;
  windPreset.value = name in WIND_PRESETS ? name : "combined";
  windStrengthControl.value = String(selected.wind);
  windControlStrength.value = String(selected.control);
  windInputX.value = String(selected.x);
  windInputY.value = String(selected.y);
  windEnabled.checked = selected.enabled;
  windTree.value = String(selected.tree);
  windFieldCache = null;
  windFieldCacheKey = "";
  updateWindControlOutputs();
  resetWindProofs();
  const url = new URL(window.location.href);
  url.searchParams.set("windPreset", windPreset.value);
  window.history.replaceState({}, "", url);
  selectedLink.href = url.pathname + url.search;
}

function messageSequenceProgress(time) {
  const segments = [
    { state: "dropping", duration: 700 / (Number(messageDrop.value) / 100) },
    { state: "closed", duration: 260 },
    { state: "opening", duration: Number(messageOpening.value) },
    { state: "readable", duration: Number(messageReadable.value) },
    { state: "folding", duration: Number(messageFolding.value) },
    { state: "plane", duration: 360 },
    { state: "controllable", duration: 620 },
  ];
  const total = segments.reduce((sum, segment) => sum + segment.duration, 0);
  let elapsed = ((time % total) + total) % total;
  for (const segment of segments) {
    if (elapsed <= segment.duration) {
      return messageProgressForState(
        segment.state,
        elapsed / segment.duration,
      );
    }
    elapsed -= segment.duration;
  }
  return 1;
}

function applyMessagePreset(name) {
  const selected = MESSAGE_PRESETS[name] || MESSAGE_PRESETS.closed;
  messagePreset.value = name in MESSAGE_PRESETS ? name : "closed";
  messageAutomatic = Boolean(selected.automatic);
  if (Number.isFinite(selected.progress)) {
    messageProgress.value = String(Math.round(selected.progress * 1000));
  }
  if (messageAutomatic) {
    sceneTime = 0;
    paused = false;
    toggleMotion.classList.remove("is-selected");
  }
  updateMessageControlOutputs();
  const url = new URL(window.location.href);
  url.searchParams.set("messagePreset", messagePreset.value);
  window.history.replaceState({}, "", url);
  selectedLink.href = url.pathname + url.search;
}

function applyFogPreset(name) {
  const selected = FOG_PRESETS[name] || FOG_PRESETS["hop-three"];
  fogPreset.value = name in FOG_PRESETS ? name : "hop-three";
  fogHops.value = String(selected.hops);
  fogLength.value = String(selected.length);
  fogHeight.value = String(selected.height);
  fogOpacity.value = String(selected.opacity);
  fogLayers.value = String(selected.layers);
  fogVoid.value = String(selected.void);
  fogSpeed.value = String(selected.speed);
  fogBird.value = String(selected.bird);
  updateFogControlOutputs();
  fogRenderer.clear();
  const url = new URL(window.location.href);
  url.searchParams.set("fogPreset", fogPreset.value);
  window.history.replaceState({}, "", url);
  selectedLink.href = url.pathname + url.search;
}

function applyBirdPreset(name) {
  const preset = BIRD_PRESETS[name] || BIRD_PRESETS["normal-flight"];
  birdPreset.value = name in BIRD_PRESETS ? name : "normal-flight";
  flapAutomatic = preset.flap === null;
  birdFlap.value = String(preset.flap ?? 0);
  birdAngle.value = String(preset.angle);
  birdSize.value = String(preset.size);
  birdSpeed.value = String(preset.speed);
  birdGlow.value = String(preset.glow);
  birdFog.value = String(preset.fog);
  birdCount.value = String(preset.count);
  updateBirdControlOutputs();
  const url = new URL(window.location.href);
  url.searchParams.set("birdPreset", birdPreset.value);
  window.history.replaceState({}, "", url);
  selectedLink.href = url.pathname + url.search;
}

function selectBirdSilhouette(name) {
  birdSilhouette.value = BIRD_SILHOUETTES.includes(name)
    ? name
    : "swallow";
  const url = new URL(window.location.href);
  url.searchParams.set("birdShape", birdSilhouette.value);
  window.history.replaceState({}, "", url);
  selectedLink.href = url.pathname + url.search;
}

function selectVariant(id) {
  selectedVariant = id;
  const url = new URL(window.location.href);
  url.searchParams.set("variant", id);
  window.history.replaceState({}, "", url);
  selectedLink.href = url.pathname + url.search;
  for (const proof of proofStates) {
    const selected = proof.variant.id === id;
    proof.article.classList.toggle("is-selected", selected);
    proof.button.setAttribute("aria-pressed", String(selected));
  }
}

function createProof(variant, index) {
  const article = document.createElement("article");
  article.className = "proof";
  article.classList.toggle("is-candidate", Boolean(variant.recommended));
  article.dataset.variant = variant.id;
  const canvas = document.createElement("canvas");
  canvas.className = "proof-canvas";
  canvas.setAttribute("aria-label", `${variant.label}の鳥と木の動く標本`);

  const copy = document.createElement("div");
  copy.className = "proof-copy";
  const heading = document.createElement("div");
  heading.className = "proof-heading";
  const number = document.createElement("span");
  number.className = "proof-index";
  number.textContent = String(index + 1).padStart(2, "0");
  const english = document.createElement("span");
  english.className = "proof-english";
  english.textContent = variant.englishLabel;
  heading.append(number, english);
  const title = document.createElement("h2");
  title.textContent = variant.label;
  const thesis = document.createElement("p");
  thesis.className = "proof-thesis";
  thesis.textContent = variant.thesis;
  const character = document.createElement("p");
  character.className = "proof-character";
  character.textContent = variant.character;
  const button = document.createElement("button");
  button.className = "proof-select";
  button.type = "button";
  button.textContent = "この方向を採用候補にする";
  button.addEventListener("click", () => selectVariant(variant.id));
  copy.append(heading, title, thesis, character, button);
  article.append(canvas, copy);
  proofs.append(article);
  proofStates.push({
    variant,
    article,
    canvas,
    context: canvas.getContext("2d", { alpha: true }),
    button,
    pixelRatio: 1,
    width: 0,
    height: 0,
    frameCount: 0,
    birdHeading: 0,
    lastBirdTime: sceneTime,
  });
}

function resizeProof(proof) {
  const rect = proof.canvas.getBoundingClientRect();
  proof.pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  proof.width = rect.width;
  proof.height = rect.height;
  proof.canvas.width = Math.round(rect.width * proof.pixelRatio);
  proof.canvas.height = Math.round(rect.height * proof.pixelRatio);
  proof.context.setTransform(
    proof.pixelRatio,
    0,
    0,
    proof.pixelRatio,
    0,
    0,
  );
}

function treePosition(index, count, width, height) {
  const random = ((index * 47 + count * 19) % 97) / 97;
  return {
    x: width * (0.12 + ((index + 0.5) / count) * 0.76),
    y: height * (0.78 + (random - 0.5) * 0.08),
    variant: index % 3,
    seed: `art-lab-tree-${index}`,
  };
}

function drawWind(context, width, height, time) {
  context.strokeStyle = "rgba(157, 187, 192, 0.075)";
  context.lineWidth = 1;
  for (let y = 54; y < height; y += 72) {
    context.beginPath();
    for (let x = -10; x < width + 10; x += 24) {
      const wave = Math.sin(x * 0.012 + y * 0.008 + time * 0.00035) * 9;
      if (x === -10) context.moveTo(x, y + wave);
      else context.lineTo(x, y + wave);
    }
    context.stroke();
  }
}

function drawRoute(context, points, alpha = 0.6) {
  context.save();
  context.strokeStyle = `rgba(184, 222, 213, ${alpha})`;
  context.lineWidth = 1.1;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.setLineDash([2, 8]);
  strokeSmoothRoute(context, {
    routeId: "art-lab-route",
    segments: points.slice(0, -1).map((from, index) => ({
      from,
      to: points[index + 1],
      index,
    })),
  });
  context.restore();
}

function drawSeed(context, x, y, time) {
  context.save();
  context.translate(x + Math.sin(time * 0.004) * 4, y);
  context.rotate(time * 0.002);
  context.fillStyle = visualStyle.palette.seed;
  context.shadowColor = visualStyle.palette.seed;
  context.shadowBlur = 11;
  context.beginPath();
  context.ellipse(0, 0, 3, 5, -0.45, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawSharedFog(context, x, y, radius, time, options = {}) {
  const life = options.life ?? 100_000;
  return fogRenderer.draw(context, {
    fog: {
      x,
      y,
      radius,
      hopCount: options.hopCount ?? 2,
      bornAt: options.bornAt ?? time - life * 0.45,
      life,
      phase: options.phase ?? 0.6,
      seed: options.seed ?? `art-lab-fog-${Math.round(x)}-${Math.round(y)}`,
    },
    now: time,
    pass: options.pass ?? "all",
    pixelRatio: options.pixelRatio ?? 1,
    widthScale: options.widthScale ?? 1,
    heightScale: options.heightScale ?? 1,
    opacity: options.opacity ?? 0.46,
    layerCount: options.layerCount ?? 3,
    voidAmount: options.voidAmount ?? 0.34,
    speed: options.speed ?? 1,
    warmPoint: options.warmPoint ?? null,
    timing: options.timing,
  });
}

function drawBirdWorkbench(proof, time) {
  const { context, width, height } = proof;
  const preset = birdPreset.value;
  const speed = Number(birdSpeed.value) / 100;
  const motionTime = time * speed;
  const cycle = (motionTime * 0.00012) % 1;
  const angleOffset = (Number(birdAngle.value) * Math.PI) / 180;
  const scale = Number(birdSize.value) / 100;
  const glow = Number(birdGlow.value) / 100;
  const fogControl = Number(birdFog.value) / 100;
  const count = Number(birdCount.value);
  const center = { x: width * 0.5, y: height * 0.46 };
  let x = center.x;
  let y = center.y;
  let targetAngle = 0;
  let fogAmount = fogControl;

  const staticPreset =
    preset === "wing-up" ||
    preset === "wing-mid" ||
    preset === "wing-down" ||
    preset === "normal-glow" ||
    preset === "strong-glow";

  if (!staticPreset) {
    x = width * (0.17 + cycle * 0.66);
    y = center.y + Math.sin(cycle * Math.PI * 2) * 9;
  }

  if (preset === "curve-flight") {
    const theta = cycle * Math.PI * 2;
    x = center.x + Math.cos(theta) * width * 0.23;
    y = center.y + Math.sin(theta) * height * 0.16;
    targetAngle = Math.atan2(
      Math.cos(theta) * height * 0.16,
      -Math.sin(theta) * width * 0.23,
    );
  } else if (preset === "direction-turn") {
    x = center.x;
    y = center.y;
    targetAngle = Math.sin(motionTime * 0.0016) * 1.18;
  } else if (
    preset === "fog-enter" ||
    preset === "fog-inside" ||
    preset === "fog-exit"
  ) {
    const fogX = width * 0.56;
    x =
      preset === "fog-inside"
        ? fogX
        : preset === "fog-enter"
          ? width * (0.28 + cycle * 0.34)
          : width * (0.5 + cycle * 0.28);
    y = center.y;
    const eased = cycle * cycle * (3 - 2 * cycle);
    fogAmount =
      preset === "fog-inside"
        ? fogControl
        : preset === "fog-enter"
          ? fogControl * eased
          : fogControl * (1 - eased);
    drawSharedFog(context, fogX, center.y, 88, time, {
      seed: `bird-workbench-${preset}`,
      hopCount: 3,
      pixelRatio: proof.pixelRatio,
    });
  }

  const deltaSeconds = Math.min(
    0.05,
    Math.max(0, (time - proof.lastBirdTime) / 1_000),
  );
  proof.lastBirdTime = time;
  proof.birdHeading = smoothBirdHeading(
    proof.birdHeading,
    targetAngle + angleOffset,
    deltaSeconds,
  );

  context.save();
  context.strokeStyle = "rgba(184, 222, 213, 0.18)";
  context.lineWidth = 1;
  context.setLineDash([2, 10]);
  context.beginPath();
  context.moveTo(width * 0.12, center.y);
  if (preset === "curve-flight") {
    context.bezierCurveTo(
      width * 0.32,
      center.y - height * 0.2,
      width * 0.68,
      center.y + height * 0.2,
      width * 0.88,
      center.y,
    );
  } else {
    context.lineTo(width * 0.88, center.y);
  }
  context.stroke();
  context.restore();

  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / 4);
    const column = index % 4;
    const flockX =
      count > 1 ? (column - 1.5) * 48 - row * 13 : 0;
    const flockY =
      count > 1 ? (row - 1) * 34 + Math.sin(index * 2.1) * 9 : 0;
    const phase = index * 0.83;
    const resolvedFlap = flapAutomatic
      ? birdFlapAt(motionTime, phase)
      : Number(birdFlap.value) / 100;
    drawBirdArt(context, {
      x: x + flockX,
      y: y + flockY,
      angle: proof.birdHeading + (count > 1 ? Math.sin(index) * 0.08 : 0),
      scale: scale * (count > 1 ? 0.82 + (index % 3) * 0.06 : 1),
      flap: resolvedFlap,
      glow,
      fogAmount,
      phase,
      silhouette: birdSilhouette.value,
    });
  }

  const anchorOptions = {
    x,
    y,
    angle: proof.birdHeading,
    scale,
  };
  if (preset === "seed-drop") {
    const anchor = birdWorldAnchor({ ...anchorOptions, name: "seed" });
    drawSeed(
      context,
      anchor.x,
      anchor.y + ((motionTime * 0.00042) % 1) * 42,
      time,
    );
  } else if (preset === "letter-drop") {
    const anchor = birdWorldAnchor({ ...anchorOptions, name: "letter" });
    drawMessageArt(context, {
      x: anchor.x,
      y: anchor.y,
      progress: (motionTime * 0.00018) % 0.22,
      time: motionTime,
      glow: 0.4,
    });
  }

  context.fillStyle = "rgba(231, 238, 240, 0.42)";
  context.font = '10px "SFMono-Regular", Consolas, monospace';
  context.fillText(
    `SOFT WING / ${preset.toUpperCase().replaceAll("-", " ")}`,
    20,
    30,
  );
  proof.frameCount += 1;
  proof.article.dataset.frames = String(proof.frameCount);
  proof.article.dataset.birds = String(count);
  proof.article.dataset.mode = mode;
}

function drawBirdSilhouetteComparison(proof, time) {
  const { context, width, height } = proof;
  const shapes = [
    { id: "current", label: "CURRENT", note: "比較用・現行" },
    { id: "swallow", label: "A / SWALLOW", note: "ツバメ型・推奨" },
    { id: "songbird", label: "B / SONGBIRD", note: "小鳥型" },
    { id: "mythic", label: "C / MYTHIC", note: "神話鳥型" },
  ];
  const speed = Number(birdSpeed.value) / 100;
  const motionTime = time * speed;
  const cycle = (motionTime * 0.00012) % 1;
  const angle = (Number(birdAngle.value) * Math.PI) / 180;
  const scale = Math.min(1.5, Number(birdSize.value) / 100);
  const glow = Number(birdGlow.value) / 100;
  const fogControl = Number(birdFog.value) / 100;
  const eased = cycle * cycle * (3 - 2 * cycle);
  const fogAmount =
    birdPreset.value === "fog-enter"
      ? fogControl * eased
      : birdPreset.value === "fog-exit"
        ? fogControl * (1 - eased)
        : fogControl;
  const flap = flapAutomatic
    ? birdFlapAt(motionTime, 0)
    : Number(birdFlap.value) / 100;
  const y = height * 0.46;

  for (let index = 0; index < shapes.length; index += 1) {
    const shape = shapes[index];
    const x = width * ((index + 0.5) / shapes.length);
    if (index > 0) {
      context.strokeStyle = "rgba(231, 238, 240, 0.1)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(width * (index / shapes.length), height * 0.16);
      context.lineTo(width * (index / shapes.length), height * 0.78);
      context.stroke();
    }
    if (fogControl > 0) {
      drawSharedFog(context, x, y, Math.min(66, width * 0.075), time, {
        seed: `silhouette-fog-${shape.id}`,
        hopCount: 2,
        pixelRatio: proof.pixelRatio,
      });
    }
    drawBirdArt(context, {
      x,
      y,
      angle,
      scale,
      flap,
      glow,
      fogAmount,
      silhouette: shape.id,
    });
    context.textAlign = "center";
    context.fillStyle =
      shape.id === "swallow"
        ? visualStyle.palette.seed
        : "rgba(231, 238, 240, 0.58)";
    context.font = '10px "SFMono-Regular", Consolas, monospace';
    context.fillText(shape.label, x, height * 0.7);
    context.fillStyle = "rgba(231, 238, 240, 0.34)";
    context.font = '11px "BIZ UDPGothic", "Yu Gothic", sans-serif';
    context.fillText(shape.note, x, height * 0.74);
  }
  context.textAlign = "start";
  context.fillStyle = "rgba(231, 238, 240, 0.42)";
  context.font = '10px "SFMono-Regular", Consolas, monospace';
  context.fillText(
    `SILHOUETTE PROOF / ${birdPreset.value.toUpperCase().replaceAll("-", " ")}`,
    20,
    30,
  );
  proof.frameCount += 1;
  proof.article.dataset.frames = String(proof.frameCount);
  proof.article.dataset.birds = String(shapes.length);
  proof.article.dataset.mode = mode;
}

function drawAdoptedWingComparison(proof, time) {
  const { context, width, height } = proof;
  const states = [
    { flap: 1, label: "WING UP", note: "翼を上げる" },
    { flap: 0, label: "WING MID", note: "中間" },
    { flap: -1, label: "WING DOWN", note: "翼を下げる" },
  ];
  const angle = (Number(birdAngle.value) * Math.PI) / 180;
  const scale = Math.min(1.6, Number(birdSize.value) / 100);
  const glow = Number(birdGlow.value) / 100;
  const fogAmount = Number(birdFog.value) / 100;
  const y = height * 0.46;

  for (let index = 0; index < states.length; index += 1) {
    const state = states[index];
    const x = width * ((index + 0.5) / states.length);
    if (index > 0) {
      context.strokeStyle = "rgba(231, 238, 240, 0.1)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(width * (index / states.length), height * 0.16);
      context.lineTo(width * (index / states.length), height * 0.78);
      context.stroke();
    }
    if (fogAmount > 0) {
      drawSharedFog(context, x, y, Math.min(70, width * 0.085), time, {
        seed: `adopted-wing-fog-${index}`,
        hopCount: 2,
        pixelRatio: proof.pixelRatio,
      });
    }
    drawBirdArt(context, {
      x,
      y,
      angle,
      scale,
      flap: state.flap,
      glow,
      fogAmount,
      silhouette: "swallow",
    });
    context.textAlign = "center";
    context.fillStyle = visualStyle.palette.seed;
    context.font = '10px "SFMono-Regular", Consolas, monospace';
    context.fillText(state.label, x, height * 0.7);
    context.fillStyle = "rgba(231, 238, 240, 0.38)";
    context.font = '11px "BIZ UDPGothic", "Yu Gothic", sans-serif';
    context.fillText(state.note, x, height * 0.74);
  }
  context.textAlign = "start";
  context.fillStyle = "rgba(231, 238, 240, 0.42)";
  context.font = '10px "SFMono-Regular", Consolas, monospace';
  context.fillText("ADOPTED SWALLOW / FLAP PROOF", 20, 30);
  proof.frameCount += 1;
  proof.article.dataset.frames = String(proof.frameCount);
  proof.article.dataset.birds = String(states.length);
  proof.article.dataset.mode = mode;
}

function fogControlState() {
  const appearMs = Number(fogAppear.value);
  const holdMs = Number(fogHold.value);
  const fadeMs = Number(fogFade.value);
  return Object.freeze({
    hops: Number(fogHops.value),
    widthScale: Number(fogLength.value) / 100,
    heightScale: Number(fogHeight.value) / 100,
    opacity: Number(fogOpacity.value) / 100,
    layerCount: Number(fogLayers.value),
    voidAmount: Number(fogVoid.value) / 100,
    speed: Number(fogSpeed.value) / 100,
    birdPosition: Number(fogBird.value) / 100,
    appearMs,
    holdMs,
    fadeMs,
    life: appearMs + holdMs + fadeMs,
  });
}

function drawFogWorkbench(proof, time) {
  const { context, width, height, pixelRatio } = proof;
  const preset = FOG_PRESETS[fogPreset.value] || FOG_PRESETS["hop-three"];
  const controls = fogControlState();
  const fogY = height * 0.46;
  const progress = preset.progress;
  const fogs =
    preset.scene === "double"
      ? [
          { x: width * 0.36, y: fogY - 16, seed: "fog-lab-double-a", hops: 2 },
          { x: width * 0.68, y: fogY + 20, seed: "fog-lab-double-b", hops: 4 },
        ]
      : [
          {
            x: preset.scene === "compare" ? width * 0.72 : width * 0.56,
            y: fogY,
            seed: `fog-lab-${fogPreset.value}`,
            hops: controls.hops,
          },
        ];
  const birdX = width * (0.12 + controls.birdPosition * 0.76);
  const birdY = fogY - 2;
  const primary = fogs.reduce((closest, fog) =>
    Math.abs(fog.x - birdX) < Math.abs(closest.x - birdX) ? fog : closest,
  );
  const primaryDimensions = fogDimensions({
    radius: 58 + primary.hops * 7,
    hopCount: primary.hops,
    widthScale: controls.widthScale,
    heightScale: controls.heightScale,
  });
  const birdFogAmount = clamp(
    1 - Math.abs(birdX - primary.x) / (primaryDimensions.width * 0.58),
    0,
    1,
  );
  const timing = {
    appearMs: controls.appearMs,
    holdMs: controls.holdMs,
    fadeMs: controls.fadeMs,
  };

  context.save();
  context.strokeStyle = "rgba(184, 222, 213, 0.2)";
  context.lineWidth = 1;
  context.setLineDash([2, 9]);
  context.beginPath();
  context.moveTo(width * 0.1, fogY);
  context.lineTo(Math.max(width * 0.12, primary.x - primaryDimensions.width * 0.56), fogY);
  context.moveTo(Math.min(width * 0.88, primary.x + primaryDimensions.width * 0.56), fogY);
  context.lineTo(width * 0.9, fogY);
  context.stroke();
  context.restore();

  if (preset.scene === "compare") {
    drawLegacyFogArt(context, {
      x: width * 0.28,
      y: fogY,
      radius: Math.min(94, width * 0.095),
      time,
      opacity: controls.opacity * 0.72,
    });
  }

  const renderFog = (fog, pass, warmPoint = null) =>
    fogRenderer.draw(context, {
      fog: {
        x: fog.x,
        y: fog.y,
        radius: 58 + fog.hops * 7,
        hopCount: fog.hops,
        bornAt: time - controls.life * progress,
        life: controls.life,
        phase: fog.x * 0.001,
        seed: fog.seed,
      },
      now: time,
      pass,
      pixelRatio,
      widthScale: controls.widthScale,
      heightScale: controls.heightScale,
      opacity: controls.opacity,
      layerCount: controls.layerCount,
      voidAmount: controls.voidAmount,
      speed: controls.speed,
      crowdAlpha: fogs.length > 1 ? 0.88 : 1,
      warmPoint,
      timing,
    });

  for (const fog of fogs) renderFog(fog, "back");

  const birds = preset.scene === "flock" ? 7 : preset.scene === "single" ? 0 : 1;
  for (let index = 0; index < birds; index += 1) {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const offsetX = birds > 1 ? (column - 1.5) * 34 : 0;
    const offsetY = birds > 1 ? (row - 0.5) * 28 + Math.sin(index * 1.9) * 6 : 0;
    const localX = birdX + offsetX;
    const localFog = clamp(
      birdFogAmount - Math.abs(offsetX) / Math.max(80, primaryDimensions.width),
      0,
      1,
    );
    drawBirdArt(context, {
      x: localX,
      y: birdY + offsetY,
      angle: 0,
      time,
      flap: birdFlapAt(time, index * 0.68),
      scale: birds > 1 ? 0.68 : 0.94,
      glow: localFog > 0.15 ? 0.52 : 0.32,
      fogAmount: localFog,
      phase: index * 0.68,
      silhouette: "swallow",
    });
  }

  for (const fog of fogs) {
    const distance = Math.abs(birdX - fog.x);
    const amount =
      birds > 0
        ? birdFogAmount * clamp(1 - distance / Math.max(1, primaryDimensions.width), 0, 1)
        : 0;
    renderFog(
      fog,
      "front",
      amount > 0
        ? { x: birdX, y: birdY, amount }
        : null,
    );
  }

  context.textAlign = "center";
  context.font = '10px "SFMono-Regular", Consolas, monospace';
  if (preset.scene === "compare") {
    context.fillStyle = "rgba(231, 238, 240, 0.4)";
    context.fillText("BEFORE / RECTANGULAR", width * 0.28, height * 0.72);
    context.fillStyle = visualStyle.palette.seed;
    context.fillText("AFTER / LOCAL LAYERS", width * 0.72, height * 0.72);
  } else {
    context.fillStyle = "rgba(231, 238, 240, 0.42)";
    context.fillText(
      `${controls.hops} UNKNOWN HOP${controls.hops === 1 ? "" : "S"} / ${controls.layerCount} LAYERS`,
      width * 0.5,
      height * 0.72,
    );
  }
  context.textAlign = "start";
  context.fillStyle = "rgba(231, 238, 240, 0.42)";
  context.fillText(
    `QUIET LOCAL FOG / ${fogPreset.value.toUpperCase().replaceAll("-", " ")}`,
    20,
    30,
  );
  proof.frameCount += 1;
  proof.article.dataset.frames = String(proof.frameCount);
  proof.article.dataset.fogs = String(
    preset.scene === "compare" ? fogs.length + 1 : fogs.length,
  );
  proof.article.dataset.birds = String(birds);
  proof.article.dataset.fogPreset = fogPreset.value;
  proof.article.dataset.mode = mode;
}

function drawTreeValidation(proof) {
  const { context, width, height, variant } = proof;
  const growthMode = mode === "tree-growth";
  const total = growthMode ? 6 : 12;
  const columns = growthMode ? 6 : 6;
  const rows = Math.ceil(total / columns);
  const baselineTop = height * (growthMode ? 0.66 : 0.43);
  const rowGap = height * 0.37;

  for (let index = 0; index < total; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = width * ((column + 0.5) / columns);
    const y = baselineTop + row * rowGap;
    const growth = growthMode ? index / (total - 1) : 0.82;
    const size = growthMode ? 2 + growth * 56 : 48;
    drawTreeVariant(context, variant.id, {
      x,
      y,
      size,
      growth,
      seed: growthMode
        ? "art-lab-growth-reference"
        : `art-lab-variation-${index}`,
      variant: index % 3,
      count: growthMode ? 1 + index * 8 : 24,
    });
    context.fillStyle = "rgba(231, 238, 240, 0.38)";
    context.font = '9px "SFMono-Regular", Consolas, monospace';
    context.textAlign = "center";
    context.fillText(
      growthMode ? `STAGE ${index + 1}` : String(index + 1).padStart(2, "0"),
      x,
      Math.min(height - 16, y + 22),
    );
  }
  context.textAlign = "start";
  proof.frameCount += 1;
  proof.article.dataset.frames = String(proof.frameCount);
  proof.article.dataset.trees = String(total);
  proof.article.dataset.mode = mode;
}

function drawMessageWorkbench(proof, time) {
  const { context, width, height } = proof;
  const presetName = messagePreset.value;
  const preset = MESSAGE_PRESETS[presetName] || MESSAGE_PRESETS.closed;
  const progress = messageAutomatic
    ? messageSequenceProgress(time)
    : Number(messageProgress.value) / 1000;
  const scale = Number(messageSize.value) / 100;
  const glow = Number(messageGlow.value) / 100;
  const contrast = Number(messageContrast.value) / 100;
  const center = { x: width * 0.5, y: height * 0.45 };
  const visual = messageStateAt(progress);

  context.save();
  context.strokeStyle = "rgba(184, 222, 213, 0.12)";
  context.lineWidth = 1;
  context.setLineDash([2, 10]);
  context.beginPath();
  context.moveTo(width * 0.16, center.y + 44);
  context.bezierCurveTo(
    width * 0.34,
    center.y + 51,
    width * 0.68,
    center.y + 34,
    width * 0.84,
    center.y + 42,
  );
  context.stroke();
  context.restore();

  let rendered = visual;
  if (preset.compare) {
    const showLegacyPlane = progress >= messageProgressForState("plane", 0);
    drawLegacyMessageArt(context, {
      x: width * 0.28,
      y: center.y + 20,
      plane: showLegacyPlane,
      scale: scale * 1.25,
    });
    rendered = drawMessageArt(context, {
      x: width * 0.69,
      y: center.y,
      progress,
      scale: scale * 1.25,
      glow,
      contrast,
      time,
    });
    context.fillStyle = "rgba(231, 238, 240, 0.42)";
    context.font = '10px "SFMono-Regular", Consolas, monospace';
    context.textAlign = "center";
    context.fillText("BEFORE / OBJECT SWITCH", width * 0.28, center.y + 86);
    context.fillText("AFTER / ONE SHEET", width * 0.69, center.y + 86);
    context.textAlign = "start";
  } else if (preset.sizes) {
    const sizes = [0.7, 1, 1.35, 1.7];
    for (let index = 0; index < sizes.length; index += 1) {
      const itemScale = sizes[index] * scale;
      rendered = drawMessageArt(context, {
        x: width * ((index + 0.5) / sizes.length),
        y: center.y + (index % 2) * 14,
        progress,
        scale: itemScale,
        glow,
        contrast,
        time,
      });
    }
  } else {
    if (preset.fromFog) {
      drawLegacyFogArt(context, {
        x: center.x - 18,
        y: center.y + 18,
        radius: Math.min(110, width * 0.18),
        time,
        opacity: 0.25,
      });
    }
    if (visual.state === "dropping") {
      drawBirdArt(context, {
        x: center.x,
        y: center.y - 42,
        angle: 0,
        time,
        flap: birdFlapAt(time, 0),
        scale: 0.9,
        glow: 0.32,
        silhouette: "swallow",
      });
    }
    rendered = drawMessageArt(context, {
      x: center.x,
      y: center.y,
      progress,
      scale: scale * 1.35,
      glow,
      contrast,
      dropDistance: 34,
      fromFog: Boolean(preset.fromFog),
      time,
    });
  }

  if (messageAutomatic) {
    messageProgress.value = String(Math.round(progress * 1000));
  }
  updateMessageControlOutputs(progress);
  context.fillStyle = "rgba(231, 238, 240, 0.42)";
  context.font = '10px "SFMono-Regular", Consolas, monospace';
  context.fillText(
    `ONE SHEET / ${rendered.state.toUpperCase()} / ${Math.round(progress * 100)}%`,
    20,
    30,
  );
  proof.frameCount += 1;
  proof.article.dataset.frames = String(proof.frameCount);
  proof.article.dataset.mode = mode;
  proof.article.dataset.messagePreset = presetName;
  proof.article.dataset.messageState = rendered.state;
  proof.article.dataset.messageProgress = progress.toFixed(3);
  proof.article.dataset.controllable = String(rendered.state === "controllable");
}

function windTreesForScene(proof, scene) {
  const { width, height } = proof;
  if (scene === "none") return [];
  if (scene === "small") {
    return [
      { x: width * 0.58, y: height * 0.68, size: 18, seed: "wind-small" },
    ];
  }
  if (scene === "large") {
    return [
      { x: width * 0.56, y: height * 0.7, size: 56, seed: "wind-large" },
    ];
  }
  return [
    { x: width * 0.34, y: height * 0.7, size: 28, seed: "wind-a" },
    { x: width * 0.57, y: height * 0.68, size: 52, seed: "wind-b" },
    { x: width * 0.76, y: height * 0.73, size: 35, seed: "wind-c" },
  ];
}

function currentWindField() {
  const key = [
    windSeed.value,
    windScale.value,
    windTime.value,
    windTree.value,
    windRadius.value,
  ].join("|");
  if (!windFieldCache || windFieldCacheKey !== key) {
    windFieldCache = createWindField({
      seed: Number(windSeed.value),
      scale: Number(windScale.value) / 10_000,
      timeScale: Number(windTime.value) / 100,
      maximum: 1,
      treeInfluence: Number(windTree.value) / 100,
      treeRadius: Number(windRadius.value),
    });
    windFieldCacheKey = key;
  }
  return windFieldCache;
}

function drawPlaneWindWorkbench(proof, time) {
  const { context, width, height, variant } = proof;
  const presetName = windPreset.value;
  const preset = WIND_PRESETS[presetName] || WIND_PRESETS.combined;
  const trees = windTreesForScene(proof, preset.trees);
  const treeKey = `${preset.trees}|${Math.round(width)}|${Math.round(height)}`;
  if (!proof.windTreeIndex || proof.windTreeKey !== treeKey) {
    proof.windTreeIndex = createTreeWindIndex({ trees });
    proof.windTreeKey = treeKey;
  }
  if (!proof.planeWind) {
    proof.planeWind = {
      x: width * 0.22,
      y: height * 0.42,
      vx: 44,
      vy: -3,
      heading: 0,
      wind: { x: 0, y: 0 },
      trail: [],
    };
    proof.lastWindTime = time;
  }

  const deltaSeconds = Math.min(
    0.05,
    Math.max(0, (time - proof.lastWindTime) / 1_000),
  );
  proof.lastWindTime = time;
  const field = currentWindField();
  const releaseCycle = (time % 5_000) / 5_000;
  const inputReleased = Boolean(preset.release && releaseCycle > 0.32);
  const control = inputReleased
    ? { x: 0, y: 0 }
    : {
        x: Number(windInputX.value) / 100,
        y: Number(windInputY.value) / 100,
      };
  proof.planeWind.wind = windEnabled.checked
    ? field.sample(
        proof.planeWind.x,
        proof.planeWind.y,
        time / 1_000,
        proof.windTreeIndex,
      )
    : { x: 0, y: 0 };
  const forces = combinePlaneForces({
    wind: proof.planeWind.wind,
    control,
    windStrength: Number(windStrengthControl.value),
    controlStrength: Number(windControlStrength.value),
  });
  const integrated = integratePlane(
    proof.planeWind,
    forces.totalForce,
    deltaSeconds,
    {
      drag: Number(windDrag.value) / 100,
      maxSpeed: Number(windMaxSpeed.value),
    },
  );
  proof.planeWind.x = integrated.x;
  proof.planeWind.y = integrated.y;
  proof.planeWind.vx = integrated.vx;
  proof.planeWind.vy = integrated.vy;
  proof.planeWind.heading = smoothPlaneHeading(
    proof.planeWind.heading,
    integrated,
    deltaSeconds,
    { response: 5 },
  );

  const margin = 34;
  if (proof.planeWind.x < -margin) proof.planeWind.x = width + margin;
  if (proof.planeWind.x > width + margin) proof.planeWind.x = -margin;
  if (proof.planeWind.y < -margin) proof.planeWind.y = height + margin;
  if (proof.planeWind.y > height + margin) proof.planeWind.y = -margin;
  proof.planeWind.trail.push({
    x: proof.planeWind.x,
    y: proof.planeWind.y,
  });
  if (proof.planeWind.trail.length > 72) proof.planeWind.trail.shift();

  for (const tree of trees) {
    drawTreeVariant(context, variant.id, {
      x: tree.x,
      y: tree.y,
      size: tree.size,
      growth: Math.min(1, tree.size / 56),
      count: Math.round(tree.size * 0.7),
      seed: tree.seed,
    });
  }

  if (windVectors.checked && windEnabled.checked) {
    context.save();
    context.lineCap = "round";
    const spacing = Math.max(72, width / 12);
    for (let y = spacing * 0.7; y < height; y += spacing) {
      for (let x = spacing * 0.55; x < width; x += spacing) {
        const wind = field.sample(x, y, time / 1_000, proof.windTreeIndex);
        context.strokeStyle = "rgba(116, 169, 165, 0.16)";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x - wind.x * 10, y - wind.y * 10);
        context.lineTo(x + wind.x * 17, y + wind.y * 17);
        context.stroke();
      }
    }
    context.restore();
  }

  if (windTrail.checked && proof.planeWind.trail.length > 1) {
    context.save();
    context.lineCap = "round";
    for (
      let index = 1;
      index < proof.planeWind.trail.length;
      index += 1
    ) {
      const from = proof.planeWind.trail[index - 1];
      const to = proof.planeWind.trail[index];
      context.strokeStyle = `rgba(213, 162, 75, ${
        (index / proof.planeWind.trail.length) * 0.3
      })`;
      context.lineWidth = 1.1;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
    }
    context.restore();
  }

  drawPaperPlaneArt(context, {
    x: proof.planeWind.x,
    y: proof.planeWind.y,
    angle: proof.planeWind.heading,
    scale: 1.25,
    glow: 0.25,
    contrast: 0.3,
    controllable: 1,
    time,
  });

  context.fillStyle = "rgba(231, 238, 240, 0.42)";
  context.font = '10px "SFMono-Regular", Consolas, monospace';
  context.fillText(
    `PLANE + CURL / ${presetName.toUpperCase().replaceAll("-", " ")}`,
    20,
    30,
  );
  context.fillText(
    `INPUT ${control.x.toFixed(2)}, ${control.y.toFixed(2)} / WIND ${proof.planeWind.wind.x.toFixed(2)}, ${proof.planeWind.wind.y.toFixed(2)}`,
    20,
    48,
  );
  proof.frameCount += 1;
  proof.article.dataset.frames = String(proof.frameCount);
  proof.article.dataset.mode = mode;
  proof.article.dataset.windPreset = presetName;
  proof.article.dataset.windTrees = String(trees.length);
  proof.article.dataset.windEnabled = String(windEnabled.checked);
  proof.article.dataset.controlEnabled = String(
    Number(windControlStrength.value) > 0 && !inputReleased,
  );
  proof.article.dataset.windX = proof.planeWind.wind.x.toFixed(3);
  proof.article.dataset.windY = proof.planeWind.wind.y.toFixed(3);
}

function drawLegacyFeather(context, x, y, scale = 1) {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.rotate(-0.18);
  context.strokeStyle = visualStyle.palette.paper;
  context.globalAlpha = 0.66;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, -8);
  context.quadraticCurveTo(6, -2, 0, 10);
  context.quadraticCurveTo(-5, -1, 0, -8);
  context.moveTo(0, -6);
  context.lineTo(0, 11);
  context.stroke();
  context.restore();
}

function featherArtOptions(proof, progress, phase = 0, scale = 1) {
  const pose = featherPoseAt(progress, phase, {
    sway: Number(featherSway.value),
    fallDistance: Number(featherFall.value),
    swayCycles: DEFAULT_FEATHER_ART.swayCycles,
    rotation: DEFAULT_FEATHER_ART.rotation,
  });
  return {
    pose,
    art: {
      angle: pose.angle,
      scale,
      alpha: pose.alpha * 0.88,
      color: visualStyle.palette.paper,
      glowColor: visualStyle.palette.seed,
      glow: 0.1,
      seed: `feather-lab-${proof.variant.id}-${phase}`,
      curve: Number(featherCurve.value) / 100,
      barbsPerSide: Number(featherBarbs.value),
      rootTaper: Number(featherTaper.value) / 100,
    },
  };
}

function drawFeatherWorkbench(proof, time) {
  const { context, width, height } = proof;
  const presetName = featherPreset.value;
  const selected = FEATHER_PRESETS[presetName] || FEATHER_PRESETS.falling;
  const automaticProgress = ((time % 4_200) + 4_200) % 4_200 / 4_200;
  const progress = featherAutomatic
    ? automaticProgress
    : Number(featherProgress.value) / 1000;
  const size = Number(featherSize.value) / 100;

  if (featherAutomatic) {
    featherProgress.value = String(Math.round(progress * 1000));
    updateFeatherControlOutputs(progress);
  }

  context.fillStyle = "rgba(231, 238, 240, 0.38)";
  context.font = '10px "SFMono-Regular", Consolas, monospace';
  context.fillText(
    `FEATHER / ${presetName.toUpperCase()} / ${Math.round(progress * 100)}%`,
    20,
    30,
  );

  if (selected.scene === "compare") {
    const comparisonScale = 4.2 * size;
    drawLegacyFeather(context, width * 0.29, height * 0.5, comparisonScale);
    drawFeatherArt(context, {
      x: width * 0.7,
      y: height * 0.5,
      angle: -0.2,
      scale: comparisonScale,
      alpha: 0.88,
      color: visualStyle.palette.paper,
      glowColor: visualStyle.palette.seed,
      glow: 0.1,
      seed: `feather-compare-${proof.variant.id}`,
      curve: Number(featherCurve.value) / 100,
      barbsPerSide: Number(featherBarbs.value),
      rootTaper: Number(featherTaper.value) / 100,
    });
    context.globalAlpha = 0.5;
    context.fillText("BEFORE", width * 0.29 - 22, height * 0.76);
    context.fillText("CURVED SHAFT + BARBS", width * 0.7 - 64, height * 0.76);
    context.globalAlpha = 1;
  } else if (selected.scene === "closeup") {
    drawFeatherArt(context, {
      x: width * 0.5,
      y: height * 0.52,
      angle: -0.22,
      scale: 4.6 * size,
      alpha: 0.92,
      color: visualStyle.palette.paper,
      glowColor: visualStyle.palette.seed,
      glow: 0.1,
      seed: `feather-closeup-${proof.variant.id}`,
      curve: Number(featherCurve.value) / 100,
      barbsPerSide: Number(featherBarbs.value),
      rootTaper: Number(featherTaper.value) / 100,
    });
  } else if (selected.scene === "trio") {
    for (let index = 0; index < 3; index += 1) {
      const localProgress = (progress + index * 0.22) % 1;
      const { pose, art } = featherArtOptions(
        proof,
        localProgress,
        index * 2.07,
        2.2 * size,
      );
      drawFeatherArt(context, {
        ...art,
        x: width * (0.28 + index * 0.22) + pose.x,
        y: height * 0.16 + pose.y * 1.85,
      });
    }
  } else {
    const { pose, art } = featherArtOptions(
      proof,
      progress,
      0.4,
      2.5 * size,
    );
    drawFeatherArt(context, {
      ...art,
      x: width * 0.5 + pose.x,
      y: height * 0.17 + pose.y * 2.1,
    });
  }

  proof.frameCount += 1;
  proof.article.dataset.frames = String(proof.frameCount);
  proof.article.dataset.mode = mode;
  proof.article.dataset.featherPreset = presetName;
  proof.article.dataset.featherProgress = progress.toFixed(3);
  proof.article.dataset.featherBarbs = featherBarbs.value;
}

function drawProof(proof, time) {
  const { context, width, height, variant } = proof;
  if (width <= 0 || height <= 0) return;
  context.clearRect(0, 0, width, height);
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, visualStyle.palette.nightLift);
  gradient.addColorStop(1, visualStyle.palette.night);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  drawWind(context, width, height, time);

  if (mode === "feather-lab") {
    drawFeatherWorkbench(proof, time);
    return;
  }

  if (mode === "plane-wind-lab") {
    drawPlaneWindWorkbench(proof, time);
    return;
  }

  if (mode === "message-lab") {
    drawMessageWorkbench(proof, time);
    return;
  }

  if (mode === "fog-lab") {
    drawFogWorkbench(proof, time);
    return;
  }

  if (mode === "adopted-wing") {
    drawAdoptedWingComparison(proof, time);
    return;
  }

  if (mode === "bird-silhouettes") {
    drawBirdSilhouetteComparison(proof, time);
    return;
  }

  if (mode === "bird-lab") {
    drawBirdWorkbench(proof, time);
    return;
  }

  if (mode === "tree-variations" || mode === "tree-growth") {
    drawTreeValidation(proof);
    return;
  }

  const count = Number(density.value);
  const age = Number(treeAge.value) / 100;
  const positions = Array.from({ length: count }, (_, index) =>
    treePosition(index, count, width, height),
  );
  const routePoints = positions.map((tree) => ({
    x: tree.x,
    y: tree.y - 34 - age * 20,
  }));

  if (mode !== "growth") drawRoute(context, routePoints, 0.48);
  for (const [index, tree] of positions.entries()) {
    const individualAge = Math.max(
      0.12,
      Math.min(1, age * (0.72 + ((index * 23) % 31) / 100)),
    );
    drawTreeVariant(context, variant.id, {
      x: tree.x,
      y: tree.y,
      size: 22 + individualAge * 62,
      variant: tree.variant,
      count: 1 + Math.round(individualAge * 36),
      time,
      seed: tree.seed,
    });
  }

  const cycle = (time * 0.00012) % 1;
  const path = cycle * Math.max(1, routePoints.length - 1);
  const segment = Math.min(Math.floor(path), routePoints.length - 1);
  const local = path - Math.floor(path);
  const from = routePoints[segment] || {
    x: width * 0.2,
    y: height * 0.4,
  };
  const to = routePoints[Math.min(segment + 1, routePoints.length - 1)] || from;
  const bird = {
    x: from.x + (to.x - from.x) * local,
    y: from.y + (to.y - from.y) * local - Math.sin(local * Math.PI) * 28,
    angle: Math.atan2(to.y - from.y, to.x - from.x),
  };

  if (mode === "growth") {
    const center = positions[Math.floor(positions.length / 2)];
    const drop = (time * 0.0005) % 1;
    drawSeed(
      context,
      center.x,
      center.y - 82 + drop * 76,
      time,
    );
    drawBirdVariant(context, variant.id, {
      x: center.x + 66,
      y: center.y - 110,
      angle: Math.PI,
      time,
      scale: 0.9,
      phase: positions.length * 0.17,
      roll: Math.sin(time * 0.0012) * 0.12,
    });
  } else {
    drawBirdVariant(context, variant.id, {
      ...bird,
      time,
      scale: 0.9,
      phase: segment * 0.73,
      roll:
        Math.sin(time * 0.00072 + segment * 0.8) *
        ((30 * Math.PI) / 180),
    });
    if (mode === "ensemble" && local > 0.35 && local < 0.68) {
      drawSeed(context, bird.x - 8, bird.y + 26, time);
    }
  }

  if (mode === "fog" || mode === "ensemble") {
    drawSharedFog(context, width * 0.55, height * 0.43, 70, time, {
      seed: `ensemble-fog-${variant.id}`,
      hopCount: 3,
      pixelRatio: proof.pixelRatio,
    });
  }

  context.fillStyle = "rgba(231, 238, 240, 0.34)";
  context.font = '10px "SFMono-Regular", Consolas, monospace';
  context.fillText(
    `${variant.englishLabel} / ${mode.toUpperCase()}`,
    20,
    30,
  );
  proof.frameCount += 1;
  proof.article.dataset.frames = String(proof.frameCount);
  proof.article.dataset.trees = String(count);
  proof.article.dataset.mode = mode;
}

function frame(now) {
  const delta = Math.min(50, now - lastFrame);
  lastFrame = now;
  if (!paused) sceneTime += delta;
  for (const proof of proofStates) drawProof(proof, sceneTime);
  requestAnimationFrame(frame);
}

function resizeAll() {
  fogRenderer.clear();
  for (const proof of proofStates) resizeProof(proof);
}

function updateModePresentation() {
  document.body.classList.toggle(
    "is-bird-lab",
    mode === "bird-lab" ||
      mode === "bird-silhouettes" ||
      mode === "adopted-wing",
  );
  document.body.classList.toggle("is-feather-lab", mode === "feather-lab");
  document.body.classList.toggle("is-fog-lab", mode === "fog-lab");
  document.body.classList.toggle("is-message-lab", mode === "message-lab");
  document.body.classList.toggle(
    "is-plane-wind-lab",
    mode === "plane-wind-lab",
  );
  for (const candidate of modeButtons) {
    candidate.classList.toggle("is-selected", candidate.dataset.mode === mode);
  }
  requestAnimationFrame(resizeAll);
}

for (const [index, variant] of variants.entries()) createProof(variant, index);
for (const button of modeButtons) {
  button.addEventListener("click", () => {
    mode = button.dataset.mode;
    const url = new URL(window.location.href);
    url.searchParams.set("mode", mode);
    window.history.replaceState({}, "", url);
    updateModePresentation();
  });
}
treeAge.addEventListener("input", () => {
  treeAgeOutput.textContent = treeAge.value;
});
density.addEventListener("input", () => {
  densityOutput.textContent = density.value;
});
birdPreset.addEventListener("change", () => {
  applyBirdPreset(birdPreset.value);
});
birdSilhouette.addEventListener("change", () => {
  selectBirdSilhouette(birdSilhouette.value);
});
featherPreset.addEventListener("change", () => {
  applyFeatherPreset(featherPreset.value);
});
featherProgress.addEventListener("input", () => {
  featherAutomatic = false;
  updateFeatherControlOutputs();
});
for (const control of [
  featherBarbs,
  featherCurve,
  featherTaper,
  featherSway,
  featherFall,
  featherSize,
]) {
  control.addEventListener("input", () => {
    updateFeatherControlOutputs();
  });
}
featherReplay.addEventListener("click", () => {
  featherPreset.value = "falling";
  featherAutomatic = true;
  featherProgress.value = "0";
  sceneTime = 0;
  paused = false;
  toggleMotion.classList.remove("is-selected");
  updateFeatherControlOutputs(0);
});
fogPreset.addEventListener("change", () => {
  applyFogPreset(fogPreset.value);
});
messagePreset.addEventListener("change", () => {
  applyMessagePreset(messagePreset.value);
});
windPreset.addEventListener("change", () => {
  applyWindPreset(windPreset.value);
});
birdFlap.addEventListener("input", () => {
  flapAutomatic = false;
  updateBirdControlOutputs();
});
for (const control of [
  birdAngle,
  birdSize,
  birdSpeed,
  birdGlow,
  birdFog,
  birdCount,
]) {
  control.addEventListener("input", updateBirdControlOutputs);
}
for (const control of [
  fogHops,
  fogLength,
  fogHeight,
  fogOpacity,
  fogLayers,
  fogVoid,
  fogSpeed,
  fogAppear,
  fogHold,
  fogFade,
  fogBird,
]) {
  control.addEventListener("input", () => {
    updateFogControlOutputs();
    fogRenderer.clear();
  });
}
messageProgress.addEventListener("input", () => {
  messageAutomatic = false;
  updateMessageControlOutputs();
});
for (const control of [
  messageDrop,
  messageOpening,
  messageReadable,
  messageFolding,
  messageGlow,
  messageSize,
  messageContrast,
]) {
  control.addEventListener("input", () => {
    updateMessageControlOutputs();
  });
}
for (const control of [windInputX, windInputY]) {
  control.addEventListener("input", updateWindControlOutputs);
}
for (const control of [
  windStrengthControl,
  windControlStrength,
  windDrag,
  windMaxSpeed,
  windScale,
  windTime,
  windTree,
  windRadius,
  windSeed,
  windEnabled,
]) {
  control.addEventListener("input", () => {
    windFieldCache = null;
    windFieldCacheKey = "";
    updateWindControlOutputs();
  });
}
for (const control of [windTrail, windVectors]) {
  control.addEventListener("input", updateWindControlOutputs);
}
function setWindPad(clientX, clientY) {
  const rect = windControlPad.getBoundingClientRect();
  const radius = rect.width * 0.36;
  let x = (clientX - (rect.left + rect.width / 2)) / radius;
  let y = (clientY - (rect.top + rect.height / 2)) / radius;
  const magnitude = Math.hypot(x, y);
  if (magnitude > 1) {
    x /= magnitude;
    y /= magnitude;
  }
  windInputX.value = String(Math.round(x * 100));
  windInputY.value = String(Math.round(y * 100));
  const travel = rect.width * 0.3;
  windControlKnob.style.transform = `translate(calc(-50% + ${
    x * travel
  }px), calc(-50% + ${y * travel}px))`;
  updateWindControlOutputs();
}
function releaseWindPad(pointerId) {
  if (windPadPointer !== pointerId) return;
  windPadPointer = null;
  windControlPad.classList.remove("is-active");
  windInputX.value = "0";
  windInputY.value = "0";
  windControlKnob.style.transform = "translate(-50%, -50%)";
  updateWindControlOutputs();
}
windControlPad.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  windPadPointer = event.pointerId;
  windControlPad.setPointerCapture(event.pointerId);
  windControlPad.classList.add("is-active");
  windPreset.value = "joystick";
  setWindPad(event.clientX, event.clientY);
});
windControlPad.addEventListener("pointermove", (event) => {
  if (windPadPointer !== event.pointerId) return;
  event.preventDefault();
  setWindPad(event.clientX, event.clientY);
});
windControlPad.addEventListener("pointerup", (event) => {
  releaseWindPad(event.pointerId);
});
windControlPad.addEventListener("pointercancel", (event) => {
  releaseWindPad(event.pointerId);
});
windReset.addEventListener("click", resetWindProofs);
messageReplay.addEventListener("click", () => {
  if (
    messagePreset.value !== "sequence" &&
    messagePreset.value !== "fog-sequence"
  ) {
    messagePreset.value = "sequence";
  }
  messageAutomatic = true;
  sceneTime = 0;
  paused = false;
  toggleMotion.classList.remove("is-selected");
  updateMessageControlOutputs(0);
});
toggleMotion.addEventListener("click", () => {
  paused = !paused;
  toggleMotion.textContent = paused ? "動かす" : "動きを止める";
  toggleMotion.classList.toggle("is-selected", paused);
});
window.addEventListener("resize", resizeAll);
resizeAll();
applyBirdPreset(
  BIRD_PRESETS[searchParameters.get("birdPreset")]
    ? searchParameters.get("birdPreset")
    : "normal-flight",
);
selectBirdSilhouette(searchParameters.get("birdShape") || "swallow");
applyFeatherPreset(
  FEATHER_PRESETS[searchParameters.get("featherPreset")]
    ? searchParameters.get("featherPreset")
    : "falling",
);
applyFogPreset(
  FOG_PRESETS[searchParameters.get("fogPreset")]
    ? searchParameters.get("fogPreset")
    : "hop-three",
);
applyMessagePreset(
  MESSAGE_PRESETS[searchParameters.get("messagePreset")]
    ? searchParameters.get("messagePreset")
    : "closed",
);
applyWindPreset(
  WIND_PRESETS[searchParameters.get("windPreset")]
    ? searchParameters.get("windPreset")
    : "combined",
);
updateModePresentation();
if (selectedVariant) selectVariant(selectedVariant);
else selectedLink.textContent = "まだ案を選んでいません";
requestAnimationFrame(frame);

window.__routeForestArtLab = Object.freeze({
  snapshot: () => ({
    variantCount: variants.length,
    selectedVariant,
    mode,
    paused,
    treeAge: Number(treeAge.value),
    density: Number(density.value),
    bird: {
      preset: birdPreset.value,
      silhouette: birdSilhouette.value,
      flap: flapAutomatic ? "auto" : Number(birdFlap.value) / 100,
      angle: Number(birdAngle.value),
      size: Number(birdSize.value),
      speed: Number(birdSpeed.value),
      glow: Number(birdGlow.value),
      fog: Number(birdFog.value),
      count: Number(birdCount.value),
    },
    feather: {
      preset: featherPreset.value,
      progress: Number(featherProgress.value) / 1000,
      automatic: featherAutomatic,
      barbsPerSide: Number(featherBarbs.value),
      curve: Number(featherCurve.value) / 100,
      rootTaper: Number(featherTaper.value) / 100,
      sway: Number(featherSway.value),
      fallDistance: Number(featherFall.value),
      size: Number(featherSize.value),
    },
    fog: {
      preset: fogPreset.value,
      hops: Number(fogHops.value),
      length: Number(fogLength.value),
      height: Number(fogHeight.value),
      opacity: Number(fogOpacity.value),
      layers: Number(fogLayers.value),
      voidAmount: Number(fogVoid.value),
      speed: Number(fogSpeed.value),
      appearMs: Number(fogAppear.value),
      holdMs: Number(fogHold.value),
      fadeMs: Number(fogFade.value),
      birdPosition: Number(fogBird.value),
      cacheEntries: fogRenderer.cacheSize(),
    },
    message: {
      preset: messagePreset.value,
      progress: Number(messageProgress.value) / 1000,
      state: messageStateAt(Number(messageProgress.value) / 1000).state,
      automatic: messageAutomatic,
      dropSpeed: Number(messageDrop.value),
      openingMs: Number(messageOpening.value),
      readableMs: Number(messageReadable.value),
      foldingMs: Number(messageFolding.value),
      glow: Number(messageGlow.value),
      size: Number(messageSize.value),
      contrast: Number(messageContrast.value),
    },
    wind: {
      preset: windPreset.value,
      inputX: Number(windInputX.value) / 100,
      inputY: Number(windInputY.value) / 100,
      enabled: windEnabled.checked,
      strength: Number(windStrengthControl.value),
      controlStrength: Number(windControlStrength.value),
      drag: Number(windDrag.value) / 100,
      maxSpeed: Number(windMaxSpeed.value),
      scale: Number(windScale.value) / 10_000,
      timeScale: Number(windTime.value) / 100,
      treeInfluence: Number(windTree.value) / 100,
      treeRadius: Number(windRadius.value),
      seed: Number(windSeed.value),
      trail: windTrail.checked,
      vectors: windVectors.checked,
    },
    proofs: proofStates.map((proof) => ({
      id: proof.variant.id,
      frames: proof.frameCount,
      trees: Number(proof.article.dataset.trees || 0),
      fogs: Number(proof.article.dataset.fogs || 0),
      fogPreset: proof.article.dataset.fogPreset || null,
      messagePreset: proof.article.dataset.messagePreset || null,
      messageState: proof.article.dataset.messageState || null,
      featherPreset: proof.article.dataset.featherPreset || null,
      featherProgress: Number(proof.article.dataset.featherProgress || 0),
      featherBarbs: Number(proof.article.dataset.featherBarbs || 0),
      windPreset: proof.article.dataset.windPreset || null,
      windTrees: Number(proof.article.dataset.windTrees || 0),
      windEnabled: proof.article.dataset.windEnabled || null,
      controlEnabled: proof.article.dataset.controlEnabled || null,
    })),
  }),
});
