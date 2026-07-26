import { drawBirdArt } from "./bird-art.js";
import {
  DEFAULT_FEATHER_ART,
  drawFeatherArt,
  featherPoseAt,
} from "./feather-art.js";
import {
  drawMessageArt,
  drawPaperPlaneArt,
} from "./message-art.js";
import {
  createFogTexture,
  drawFog,
} from "./display-art.js";
import {
  createTreeModel,
  drawTreeArt,
} from "./tree-art.js";
import {
  createTreeWindIndex,
  createWindField,
} from "./flow-field.js";
import { visualStyle } from "./visual-style.js";

const canvas = document.querySelector("#capture-canvas");
const context = canvas.getContext("2d");
const stageFrame = document.querySelector("#stage-frame");
const assetName = document.querySelector("#asset-name");
const stageSize = document.querySelector("#stage-size");
const togglePlay = document.querySelector("#toggle-play");

const controls = Object.freeze({
  count: document.querySelector("#count"),
  size: document.querySelector("#size"),
  spread: document.querySelector("#spread"),
  arrangement: document.querySelector("#arrangement"),
  growth: document.querySelector("#growth"),
  flap: document.querySelector("#flap"),
  messageProgress: document.querySelector("#message-progress"),
  fogOpacity: document.querySelector("#fog-opacity"),
  windDensity: document.querySelector("#wind-density"),
  resolution: document.querySelector("#resolution"),
  background: document.querySelector("#background"),
  caption: document.querySelector("#caption"),
  speed: document.querySelector("#speed"),
});

const outputs = Object.freeze({
  count: document.querySelector("#count-output"),
  size: document.querySelector("#size-output"),
  spread: document.querySelector("#spread-output"),
  growth: document.querySelector("#growth-output"),
  messageProgress: document.querySelector("#message-output"),
  fogOpacity: document.querySelector("#fog-output"),
  windDensity: document.querySelector("#wind-output"),
  speed: document.querySelector("#speed-output"),
});

const ASSET_LABELS = Object.freeze({
  all: "全体",
  bird: "鳥",
  seed: "種",
  tree: "木",
  wind: "風",
  message: "手紙",
  plane: "紙飛行機",
  feather: "羽",
  fog: "霧",
});

const DEFAULTS = Object.freeze({
  asset: "bird",
  count: 1,
  size: 100,
  spread: 100,
  arrangement: "scatter",
  growth: 86,
  flap: "auto",
  messageProgress: 46,
  fogOpacity: 82,
  windDensity: 100,
  resolution: "1920x1080",
  background: "night",
  caption: false,
  speed: 100,
});

const state = {
  ...DEFAULTS,
  playing: true,
  elapsed: 0,
  lastFrame: performance.now(),
  windMotes: [],
  windSignature: "",
};

const palette = visualStyle.palette;
const fogTexture = createFogTexture(
  document.createElement("canvas"),
  randomFrom(hashText("presentation-fog")),
);

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function hashText(value) {
  const text = String(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFrom(seed) {
  let value = seed || 1;
  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function rgba(hex, alpha) {
  const value = hex.replace("#", "");
  return `rgba(${Number.parseInt(value.slice(0, 2), 16)}, ${Number.parseInt(
    value.slice(2, 4),
    16,
  )}, ${Number.parseInt(value.slice(4, 6), 16)}, ${alpha})`;
}

function resolutionScale() {
  return Math.min(canvas.width / 1920, canvas.height / 1080);
}

function visualScale() {
  return resolutionScale() * (state.size / 100);
}

function parseResolution(value) {
  const [width, height] = value.split("x").map(Number);
  return { width, height };
}

function setResolution() {
  const { width, height } = parseResolution(state.resolution);
  canvas.width = width;
  canvas.height = height;
  stageSize.textContent = `${width} × ${height}`;
  state.windSignature = "";
}

function drawBackground() {
  if (state.background === "transparent") {
    context.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const colors =
    state.background === "paper"
      ? ["#dce7e4", "#c6d9d5"]
      : state.background === "lift"
        ? [palette.nightLift, "#18404a"]
        : [palette.night, "#071b20"];
  const gradient = context.createLinearGradient(
    0,
    0,
    canvas.width,
    canvas.height,
  );
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const random = randomFrom(714);
  context.save();
  for (let index = 0; index < 52; index += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const radius = (0.5 + random() * 1.1) * resolutionScale();
    context.fillStyle =
      state.background === "paper"
        ? "rgba(23, 54, 61, 0.045)"
        : "rgba(157, 187, 192, 0.055)";
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function layoutPositions(count, asset, arrangement = state.arrangement) {
  const safeCount = clamp(Math.trunc(count), 1, 24);
  const spread = state.spread / 100;
  const centerX = canvas.width * 0.5;
  const centerY = canvas.height * 0.5;
  const usableWidth = canvas.width * 0.72 * spread;
  const usableHeight = canvas.height * 0.56 * spread;
  const points = [];

  if (safeCount === 1) {
    return [{ x: centerX, y: centerY, angle: 0, phase: 0 }];
  }

  if (arrangement === "row") {
    for (let index = 0; index < safeCount; index += 1) {
      const progress = safeCount === 1 ? 0.5 : index / (safeCount - 1);
      points.push({
        x: centerX + (progress - 0.5) * usableWidth,
        y: centerY + Math.sin(index * 1.7) * 14 * resolutionScale(),
        angle: (index % 2 === 0 ? -1 : 1) * 0.045,
        phase: index * 0.73,
      });
    }
    return points;
  }

  const columns = Math.ceil(Math.sqrt(safeCount * (16 / 9)));
  const rows = Math.ceil(safeCount / columns);
  const random = randomFrom(hashText(`layout:${asset}:${safeCount}`));
  for (let index = 0; index < safeCount; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const nx = columns === 1 ? 0.5 : column / (columns - 1);
    const ny = rows === 1 ? 0.5 : row / (rows - 1);
    const jitter =
      arrangement === "scatter"
        ? {
            x: (random() - 0.5) * usableWidth / Math.max(4, columns),
            y: (random() - 0.5) * usableHeight / Math.max(4, rows),
          }
        : { x: 0, y: 0 };
    points.push({
      x: centerX + (nx - 0.5) * usableWidth + jitter.x,
      y: centerY + (ny - 0.5) * usableHeight + jitter.y,
      angle: (random() - 0.5) * 0.16,
      phase: random() * Math.PI * 2,
    });
  }
  return points;
}

function fitForCount(count) {
  return clamp(Math.sqrt(5 / Math.max(5, count)), 0.52, 1);
}

function drawBirds(count, time, positions = null) {
  const points = positions || layoutPositions(count, "bird");
  const scale = visualScale() * 4.8 * fitForCount(count);
  const flap =
    state.flap === "auto" ? undefined : Number.parseFloat(state.flap);
  for (let index = 0; index < count; index += 1) {
    const point = points[index % points.length];
    drawBirdArt(context, {
      x: point.x,
      y: point.y,
      angle: point.angle,
      scale,
      time,
      phase: point.phase,
      flap,
      glow: 0.46,
      silhouette: "swallow",
    });
  }
}

function drawSeedShape(x, y, scale, angle, alpha = 1) {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.scale(scale, scale);
  context.globalAlpha *= alpha;
  context.fillStyle = palette.seed;
  context.shadowColor = palette.seed;
  context.shadowBlur = 13;
  context.beginPath();
  context.ellipse(0, 0, 3.2, 5.2, -0.4, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawSeeds(count, time, positions = null) {
  const points = positions || layoutPositions(count, "seed");
  const scale = visualScale() * 5.8 * fitForCount(count);
  for (let index = 0; index < count; index += 1) {
    const point = points[index % points.length];
    const sway = Math.sin(time * 0.0015 + point.phase) * 18 * resolutionScale();
    drawSeedShape(
      point.x + sway,
      point.y + Math.sin(time * 0.0009 + point.phase) * 9 * resolutionScale(),
      scale,
      point.angle + time * 0.00028 + point.phase,
      0.96,
    );
  }
}

function drawTrees(count, positions = null, alpha = 1) {
  const points = positions || layoutPositions(count, "tree");
  const scale = visualScale() * 2.6 * fitForCount(count);
  const growth = state.growth / 100;
  for (let index = 0; index < count; index += 1) {
    const point = points[index % points.length];
    context.save();
    context.translate(point.x, point.y + 51 * scale);
    context.scale(scale, scale);
    drawTreeArt(context, {
      model: createTreeModel(`presentation-tree-${index}`),
      x: 0,
      y: 0,
      size: 58,
      growth,
      alpha,
    });
    context.restore();
  }
}

function windTrees() {
  const scale = resolutionScale();
  return [
    {
      seed: "presentation-wind-left",
      x: canvas.width * 0.33,
      y: canvas.height * 0.6,
      size: 48,
      drawScale: scale * 2.15,
    },
    {
      seed: "presentation-wind-right",
      x: canvas.width * 0.67,
      y: canvas.height * 0.57,
      size: 58,
      drawScale: scale * 2.55,
    },
  ];
}

function resetWindMotes() {
  const trees = windTrees();
  const count = clamp(
    Math.round(state.count * 24 * (state.windDensity / 100)),
    16,
    420,
  );
  const random = randomFrom(hashText(`wind:${count}:${canvas.width}`));
  state.windMotes = Array.from({ length: count }, (_, index) => {
    const tree = trees[index % trees.length];
    const angle = random() * Math.PI * 2;
    const radius =
      (80 + random() * 210) * resolutionScale() * (state.spread / 100);
    return {
      x: tree.x + Math.cos(angle) * radius,
      y: tree.y + Math.sin(angle) * radius * 0.68,
      vx: 0,
      vy: 0,
      speed: (82 + random() * 74) * resolutionScale(),
      size: (1.1 + random() * 2.1) * resolutionScale() * (state.size / 100),
      alpha: 0.15 + random() * 0.22,
      phase: random() * Math.PI * 2,
      treeIndex: index % trees.length,
      history: [],
    };
  });
}

function drawWind(time, deltaSeconds) {
  const trees = windTrees();
  const signature = [
    state.count,
    state.size,
    state.spread,
    state.windDensity,
    canvas.width,
  ].join(":");
  if (signature !== state.windSignature) {
    state.windSignature = signature;
    resetWindMotes();
  }
  const treeIndex = createTreeWindIndex({ trees });
  const field = createWindField({
    ...visualStyle.physics.wind,
    treeInfluence: 0.78,
    treeRadius: 310 * resolutionScale(),
  });

  for (const tree of trees) {
    context.save();
    context.translate(tree.x, tree.y + 51 * tree.drawScale);
    context.scale(tree.drawScale, tree.drawScale);
    drawTreeArt(context, {
      seed: tree.seed,
      size: tree.size,
      growth: 0.88,
      alpha: 0.16,
    });
    context.restore();
  }

  context.save();
  context.globalCompositeOperation =
    state.background === "paper" ? "source-over" : "lighter";
  for (const mote of state.windMotes) {
    const wind = field.sample(mote.x, mote.y, time / 1000, treeIndex);
    const magnitude = Math.hypot(wind.x, wind.y);
    const response = 1 - Math.exp(-5.2 * Math.min(0.05, deltaSeconds));
    mote.vx += (wind.x * mote.speed - mote.vx) * response;
    mote.vy += (wind.y * mote.speed - mote.vy) * response;
    mote.x += mote.vx * deltaSeconds;
    mote.y += mote.vy * deltaSeconds;
    mote.history.push({ x: mote.x, y: mote.y });
    if (mote.history.length > 8) mote.history.shift();

    const tree = trees[mote.treeIndex];
    const far =
      Math.hypot(mote.x - tree.x, mote.y - tree.y) >
        430 * resolutionScale() * (state.spread / 100) ||
      mote.x < 0 ||
      mote.x > canvas.width ||
      mote.y < 0 ||
      mote.y > canvas.height ||
      magnitude < 0.006;
    if (far) {
      const random = randomFrom(
        hashText(`${mote.phase}:${Math.floor(time / 2600)}`),
      );
      const angle = random() * Math.PI * 2;
      const radius = (74 + random() * 150) * resolutionScale();
      mote.x = tree.x + Math.cos(angle) * radius;
      mote.y = tree.y + Math.sin(angle) * radius * 0.7;
      mote.history.length = 0;
    }

    if (mote.history.length > 1) {
      context.beginPath();
      context.moveTo(mote.history[0].x, mote.history[0].y);
      for (let index = 1; index < mote.history.length - 1; index += 1) {
        const point = mote.history[index];
        const next = mote.history[index + 1];
        context.quadraticCurveTo(
          point.x,
          point.y,
          (point.x + next.x) * 0.5,
          (point.y + next.y) * 0.5,
        );
      }
      context.lineTo(mote.x, mote.y);
      context.lineCap = "round";
      context.lineWidth = mote.size * 0.62;
      context.strokeStyle = rgba(
        state.background === "paper" ? palette.ink : palette.route,
        mote.alpha * 0.48,
      );
      context.stroke();
    }
    context.fillStyle = rgba(
      state.background === "paper" ? palette.ink : "#c4e7de",
      mote.alpha,
    );
    context.beginPath();
    context.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawMessages(count, time, positions = null) {
  const points = positions || layoutPositions(count, "message");
  const scale = visualScale() * 5.4 * fitForCount(count);
  for (let index = 0; index < count; index += 1) {
    const point = points[index % points.length];
    drawMessageArt(context, {
      x: point.x,
      y: point.y,
      progress: state.messageProgress / 100,
      scale,
      time,
      glow: 0.46,
      dropDistance: 18,
    });
  }
}

function drawPlanes(count, time, positions = null) {
  const points = positions || layoutPositions(count, "plane");
  const scale = visualScale() * 5.6 * fitForCount(count);
  for (let index = 0; index < count; index += 1) {
    const point = points[index % points.length];
    drawPaperPlaneArt(context, {
      x: point.x,
      y: point.y,
      angle: point.angle - 0.08,
      scale,
      time,
      glow: 0.42,
      controllable: 1,
    });
  }
}

function drawFeathers(count, time, positions = null) {
  const points = positions || layoutPositions(count, "feather");
  const scale = visualScale() * 3.1 * fitForCount(count);
  for (let index = 0; index < count; index += 1) {
    const point = points[index % points.length];
    const progress = (time * 0.00012 + index / Math.max(1, count)) % 1;
    const pose = featherPoseAt(progress, point.phase, {
      ...DEFAULT_FEATHER_ART,
      fallDistance: 22 * resolutionScale(),
      sway: 14 * resolutionScale(),
    });
    drawFeatherArt(context, {
      x: point.x + pose.x,
      y: point.y + pose.y,
      angle: point.angle + pose.angle,
      scale,
      alpha: 0.35 + pose.alpha * 0.65,
      color: palette.paper,
      glowColor: palette.seed,
      glow: 0.1,
      seed: `presentation-feather-${index}`,
      length: 70,
      width: 20,
      curve: -0.8,
      rootTaper: 0,
      barbsPerSide: 22,
    });
  }
}

function drawFogs(count, time, positions = null) {
  const points = positions || layoutPositions(count, "fog");
  const scale = visualScale() * fitForCount(count);
  context.save();
  context.globalAlpha *= state.fogOpacity / 100;
  for (let index = 0; index < count; index += 1) {
    const point = points[index % points.length];
    drawFog(context, {
      fog: {
        x: point.x,
        y: point.y,
        radius: 230 * scale,
        phase: point.phase,
        bornAt: time - 4_000,
        life: 8_000,
      },
      now: time,
      texture: fogTexture,
    });
  }
  context.restore();
}

function drawAll(time, deltaSeconds) {
  const repeat = clamp(state.count, 1, 5);
  const anchors = [
    { x: 0.19, y: 0.29 },
    { x: 0.5, y: 0.2 },
    { x: 0.8, y: 0.29 },
    { x: 0.2, y: 0.69 },
    { x: 0.43, y: 0.65 },
    { x: 0.66, y: 0.67 },
    { x: 0.84, y: 0.7 },
    { x: 0.5, y: 0.43 },
  ];
  const makePoints = (anchorIndex, amount = repeat) =>
    Array.from({ length: amount }, (_, index) => ({
      x:
        canvas.width * anchors[anchorIndex].x +
        (index - (amount - 1) / 2) * 46 * resolutionScale(),
      y:
        canvas.height * anchors[anchorIndex].y +
        Math.sin(index * 1.7) * 22 * resolutionScale(),
      angle: (index - (amount - 1) / 2) * 0.055,
      phase: index * 0.83,
    }));

  drawBirds(repeat, time, makePoints(0));
  drawSeeds(repeat, time, makePoints(1));
  drawTrees(repeat, makePoints(3));
  drawMessages(repeat, time, makePoints(4));
  drawPlanes(repeat, time, makePoints(5));
  drawFeathers(repeat, time, makePoints(6));
  drawFogs(repeat, time, makePoints(7));

  context.save();
  const oldCount = state.count;
  const oldSpread = state.spread;
  state.count = Math.max(1, Math.ceil(repeat / 2));
  state.spread = 58;
  drawWind(time, deltaSeconds);
  state.count = oldCount;
  state.spread = oldSpread;
  context.restore();
}

function drawCaption() {
  if (!state.caption) return;
  const scale = resolutionScale();
  context.save();
  const foreground =
    state.background === "paper" ? palette.ink : palette.paper;
  context.fillStyle = rgba(foreground, 0.9);
  context.font = `${26 * scale}px "Yu Mincho", "Noto Serif JP", serif`;
  context.letterSpacing = `${3 * scale}px`;
  context.fillText(
    ASSET_LABELS[state.asset],
    64 * scale,
    canvas.height - 66 * scale,
  );
  context.fillStyle = rgba(foreground, 0.42);
  context.font = `${11 * scale}px "SFMono-Regular", Consolas, monospace`;
  context.letterSpacing = `${1.8 * scale}px`;
  context.fillText(
    "WATARIMICHI / VISUAL ELEMENT",
    64 * scale,
    canvas.height - 39 * scale,
  );
  context.restore();
}

function drawFrame(time, deltaSeconds) {
  drawBackground();
  if (state.asset === "bird") drawBirds(state.count, time);
  else if (state.asset === "seed") drawSeeds(state.count, time);
  else if (state.asset === "tree") drawTrees(state.count);
  else if (state.asset === "wind") drawWind(time, deltaSeconds);
  else if (state.asset === "message") drawMessages(state.count, time);
  else if (state.asset === "plane") drawPlanes(state.count, time);
  else if (state.asset === "feather") drawFeathers(state.count, time);
  else if (state.asset === "fog") drawFogs(state.count, time);
  else drawAll(time, deltaSeconds);
  drawCaption();
}

function updateOutputs() {
  outputs.count.textContent = String(state.count);
  outputs.size.textContent = `${state.size}%`;
  outputs.spread.textContent = `${state.spread}%`;
  outputs.growth.textContent = `${state.growth}%`;
  outputs.messageProgress.textContent = `${state.messageProgress}%`;
  outputs.fogOpacity.textContent = `${state.fogOpacity}%`;
  outputs.windDensity.textContent = `${state.windDensity}%`;
  outputs.speed.textContent = `${state.speed}%`;
  assetName.textContent = ASSET_LABELS[state.asset];
}

function setControlValues() {
  for (const [key, control] of Object.entries(controls)) {
    if (control.type === "checkbox") control.checked = Boolean(state[key]);
    else control.value = String(state[key]);
  }
  for (const button of document.querySelectorAll("[data-asset]")) {
    button.classList.toggle("is-active", button.dataset.asset === state.asset);
  }
  updateOutputs();
}

function readControl(key, control) {
  if (control.type === "range") return Number.parseFloat(control.value);
  if (control.type === "checkbox") return control.checked;
  return control.value;
}

for (const [key, control] of Object.entries(controls)) {
  control.addEventListener("input", () => {
    state[key] = readControl(key, control);
    if (
      ["count", "size", "spread", "windDensity"].includes(key)
    ) {
      state.windSignature = "";
    }
    if (key === "resolution") setResolution();
    updateOutputs();
  });
}

for (const button of document.querySelectorAll("[data-asset]")) {
  button.addEventListener("click", () => {
    state.asset = button.dataset.asset;
    state.windSignature = "";
    setControlValues();
  });
}

togglePlay.addEventListener("click", () => {
  state.playing = !state.playing;
  togglePlay.textContent = state.playing ? "一時停止" : "再生";
});

document.querySelector("#reset-settings").addEventListener("click", () => {
  Object.assign(state, DEFAULTS, {
    playing: true,
    elapsed: 0,
    windSignature: "",
  });
  togglePlay.textContent = "一時停止";
  setResolution();
  setControlValues();
});

function setCaptureMode(enabled) {
  document.body.classList.toggle("is-capture-mode", enabled);
}

document
  .querySelector("#capture-mode")
  .addEventListener("click", () => setCaptureMode(true));
document
  .querySelector("#leave-capture")
  .addEventListener("click", () => setCaptureMode(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setCaptureMode(false);
});

document.querySelector("#save-png").addEventListener("click", () => {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replaceAll(":", "-");
    link.href = URL.createObjectURL(blob);
    link.download = `watarimichi-${state.asset}-${timestamp}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1_000);
  }, "image/png");
});

function frame(now) {
  const deltaSeconds = clamp((now - state.lastFrame) / 1000, 0, 0.05);
  state.lastFrame = now;
  if (state.playing) {
    state.elapsed += deltaSeconds * (state.speed / 100) * 1000;
  }
  drawFrame(state.elapsed, state.playing ? deltaSeconds : 0);
  requestAnimationFrame(frame);
}

setResolution();
setControlValues();
requestAnimationFrame(frame);

window.__routeForestPresentationLab = {
  getState: () => ({ ...state }),
  setAsset(asset) {
    if (!Object.hasOwn(ASSET_LABELS, asset)) return false;
    state.asset = asset;
    setControlValues();
    return true;
  },
  canvas,
  stageFrame,
};
