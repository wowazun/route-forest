import { letterTransform } from "./exhibition-effects.js";
import { assetContract, visualStyle } from "./visual-style.js";

const field = document.querySelector("#style-field");
const fieldContext = field.getContext("2d", { alpha: true });
const paletteStrip = document.querySelector("#palette-strip");
const assetGrid = document.querySelector("#asset-grid");
const motionList = document.querySelector("#motion-list");
const principleList = document.querySelector("#principle-list");
const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

const paletteLabels = Object.freeze({
  night: "背景・深部",
  nightLift: "背景・持上げ",
  paper: "紙・文字",
  mist: "霧・補助線",
  leaf: "木・記憶",
  seed: "種・新規",
  route: "経路・到着",
  fault: "障害",
  ink: "紙面の線",
});
const assetLabels = Object.freeze({
  bird: "鳥",
  tree: "木",
  seed: "種",
  feather: "羽",
  letter: "手紙",
  plane: "紙飛行機",
  fog: "霧",
});
const motionLabels = Object.freeze({
  seedDropMs: "種が着地する",
  letterFoldMs: "手紙が折り変わる",
  featherDriftMs: "羽が漂って消える",
  routeHighlightMs: "経路光が記憶として残る",
  fogBaseMs: "霧が留まる",
  planeFlightMs: "紙飛行機が飛ぶ",
});

function populatePalette() {
  for (const [name, color] of Object.entries(visualStyle.palette)) {
    const swatch = document.createElement("div");
    swatch.className = "palette-swatch";
    swatch.style.setProperty("--swatch", color);
    if (name === "paper" || name === "mist" || name === "route") {
      swatch.style.setProperty("--swatch-ink", visualStyle.palette.ink);
    }
    const label = document.createElement("span");
    label.className = "palette-name";
    label.textContent = paletteLabels[name] || name;
    const value = document.createElement("span");
    value.className = "palette-value";
    value.textContent = color;
    swatch.append(label, value);
    paletteStrip.append(swatch);
  }
}

function drawBird(context, x, y, time) {
  const flap = Math.sin(time * 0.006) * 7;
  context.save();
  context.translate(x, y);
  context.strokeStyle = visualStyle.palette.seed;
  context.fillStyle = visualStyle.palette.seed;
  context.lineWidth = visualStyle.strokes.active;
  context.shadowColor = visualStyle.palette.seed;
  context.shadowBlur = 14;
  context.beginPath();
  context.moveTo(-2, 0);
  context.quadraticCurveTo(-13, -9 - flap, -24, -2);
  context.moveTo(2, 0);
  context.quadraticCurveTo(13, -9 + flap, 24, -1);
  context.stroke();
  context.beginPath();
  context.ellipse(0, 0, 7, 3.2, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawTree(context, x, y, variant = 0, size = 42) {
  context.save();
  context.translate(x, y);
  context.fillStyle = "rgba(116, 169, 165, 0.22)";
  context.strokeStyle = visualStyle.palette.leaf;
  context.lineWidth = visualStyle.strokes.object;
  context.beginPath();
  context.moveTo(0, 5);
  context.lineTo(0, size);
  context.stroke();
  context.beginPath();
  if (variant === 0) context.ellipse(0, -4, size * 0.55, size * 0.72, 0, 0, Math.PI * 2);
  else if (variant === 1) {
    context.moveTo(0, -size * 0.75);
    context.lineTo(size * 0.52, size * 0.45);
    context.lineTo(-size * 0.5, size * 0.46);
    context.closePath();
  } else context.ellipse(0, -2, size * 0.68, size * 0.5, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function drawSeed(context, x, y, time) {
  context.save();
  context.translate(x + Math.sin(time * 0.003) * 5, y);
  context.rotate(time * 0.002);
  context.fillStyle = visualStyle.palette.seed;
  context.shadowColor = visualStyle.palette.seed;
  context.shadowBlur = 12;
  context.beginPath();
  context.ellipse(0, 0, 3.2, 5.2, -0.4, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawFeather(context, x, y, time) {
  context.save();
  context.translate(x, y);
  context.rotate(Math.sin(time * 0.002) * 0.6);
  context.strokeStyle = visualStyle.palette.paper;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, -9);
  context.quadraticCurveTo(7, -2, 0, 11);
  context.quadraticCurveTo(-6, -1, 0, -9);
  context.moveTo(0, -7);
  context.lineTo(0, 12);
  context.stroke();
  context.restore();
}

function drawLetterOrPlane(context, x, y, time, forcePlane = false) {
  const cycle = forcePlane ? 1 : (Math.sin(time * 0.0013) + 1) / 2;
  const transform = letterTransform(cycle);
  context.save();
  context.translate(x, y);
  context.rotate(transform.angle);
  context.fillStyle = visualStyle.palette.paper;
  context.strokeStyle = visualStyle.palette.ink;
  context.lineWidth = 0.8;
  context.beginPath();
  context.moveTo(transform.points[0].x, transform.points[0].y);
  for (const point of transform.points.slice(1)) context.lineTo(point.x, point.y);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

function drawFog(context, x, y, time) {
  context.save();
  context.globalAlpha = 0.28;
  for (let index = 0; index < 5; index += 1) {
    const phase = time * 0.0002 + index * 1.7;
    const gradient = context.createRadialGradient(
      x + Math.sin(phase) * 14,
      y + Math.cos(phase) * 5,
      2,
      x + Math.sin(phase) * 14,
      y + Math.cos(phase) * 5,
      28 + index * 4,
    );
    gradient.addColorStop(0, visualStyle.palette.mist);
    gradient.addColorStop(1, "rgba(157, 187, 192, 0)");
    context.fillStyle = gradient;
    context.fillRect(x - 58, y - 36, 116, 72);
  }
  context.restore();
}

function drawAsset(name, context, width, height, time) {
  context.clearRect(0, 0, width, height);
  context.save();
  context.translate(width / 2, height / 2);
  if (name === "bird") drawBird(context, 0, 0, time);
  else if (name === "tree") {
    drawTree(context, -48, 20, 0, 34);
    drawTree(context, 0, 20, 1, 42);
    drawTree(context, 50, 20, 2, 30);
  } else if (name === "seed") drawSeed(context, 0, 0, time);
  else if (name === "feather") drawFeather(context, 0, 0, time);
  else if (name === "letter") drawLetterOrPlane(context, 0, 0, time);
  else if (name === "plane") drawLetterOrPlane(context, 0, 0, time, true);
  else drawFog(context, 0, 0, time);
  context.restore();
}

const specimenCanvases = [];

function populateAssets() {
  for (const [name, contract] of Object.entries(assetContract.assets)) {
    const article = document.createElement("article");
    article.className = "asset-specimen";
    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 190;
    const copy = document.createElement("div");
    copy.className = "asset-copy";
    const title = document.createElement("h3");
    title.textContent = assetLabels[name];
    const meta = document.createElement("p");
    meta.className = "asset-meta";
    meta.textContent = `${contract.anchor} / ${contract.nominalSize.join("×")} / ${contract.requiredStates.join(" · ")}`;
    copy.append(title, meta);
    article.append(canvas, copy);
    assetGrid.append(article);
    specimenCanvases.push({ name, canvas, context: canvas.getContext("2d") });
  }
}

function populateMotion() {
  const maximum = Math.max(
    ...Object.keys(motionLabels).map((key) => visualStyle.motion[key]),
  );
  for (const [key, label] of Object.entries(motionLabels)) {
    const duration = visualStyle.motion[key];
    const row = document.createElement("article");
    row.className = "motion-row";
    const title = document.createElement("h3");
    title.textContent = label;
    const track = document.createElement("div");
    track.className = "motion-track";
    track.style.setProperty(
      "--duration",
      `${Math.max(1.2, (duration / maximum) * 7)}s`,
    );
    const time = document.createElement("span");
    time.className = "motion-time";
    time.textContent = `${(duration / 1000).toFixed(2)} SEC`;
    row.append(title, track, time);
    motionList.append(row);
  }
}

function populatePrinciples() {
  for (const principle of visualStyle.principles) {
    const item = document.createElement("li");
    item.textContent = principle;
    principleList.append(item);
  }
}

function resizeField() {
  const rect = field.getBoundingClientRect();
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  field.width = Math.round(rect.width * ratio);
  field.height = Math.round(rect.height * ratio);
  fieldContext.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawField(time) {
  const width = field.clientWidth;
  const height = field.clientHeight;
  fieldContext.clearRect(0, 0, width, height);
  const gradient = fieldContext.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, visualStyle.palette.nightLift);
  gradient.addColorStop(1, visualStyle.palette.night);
  fieldContext.fillStyle = gradient;
  fieldContext.fillRect(0, 0, width, height);

  fieldContext.strokeStyle = "rgba(157, 187, 192, 0.08)";
  fieldContext.lineWidth = 1;
  for (let y = 80; y < height; y += 88) {
    fieldContext.beginPath();
    for (let x = -20; x < width + 20; x += 28) {
      const wave = Math.sin(x * 0.008 + y * 0.011 + time * 0.0002) * 13;
      if (x === -20) fieldContext.moveTo(x, y + wave);
      else fieldContext.lineTo(x, y + wave);
    }
    fieldContext.stroke();
  }

  const right = width * 0.78;
  drawTree(fieldContext, right - 160, height * 0.7, 0, 64);
  drawTree(fieldContext, right - 60, height * 0.72, 1, 82);
  drawTree(fieldContext, right + 58, height * 0.68, 2, 56);
  drawFog(fieldContext, right - 10, height * 0.42, time);
  drawBird(
    fieldContext,
    right + Math.sin(time * 0.00035) * 120,
    height * 0.36 + Math.cos(time * 0.0005) * 28,
    time,
  );
  drawSeed(fieldContext, right - 110, height * 0.56, time);
  drawFeather(fieldContext, right + 115, height * 0.48, time);
  drawLetterOrPlane(fieldContext, right + 130, height * 0.72, time);
}

function frame(time) {
  const displayTime = reducedMotion ? 1_800 : time;
  drawField(displayTime);
  for (const specimen of specimenCanvases) {
    drawAsset(
      specimen.name,
      specimen.context,
      specimen.canvas.width,
      specimen.canvas.height,
      displayTime,
    );
  }
  if (!reducedMotion) requestAnimationFrame(frame);
}

populatePalette();
populateAssets();
populateMotion();
populatePrinciples();
window.addEventListener("resize", resizeField);
resizeField();
requestAnimationFrame(frame);

window.__routeForestStyleGuide = Object.freeze({
  snapshot: () => ({
    schemaVersion: visualStyle.schemaVersion,
    paletteCount: Object.keys(visualStyle.palette).length,
    assetCount: Object.keys(assetContract.assets).length,
    motionCount: Object.keys(motionLabels).length,
    concept: visualStyle.concept,
  }),
});
