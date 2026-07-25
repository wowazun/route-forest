import { visualStyle } from "./visual-style.js";

export const MESSAGE_ART_VERSION = "readable-fold-v1";

export const MESSAGE_STATES = Object.freeze([
  "dropping",
  "closed",
  "opening",
  "readable",
  "folding",
  "plane",
  "controllable",
]);

const TAU = Math.PI * 2;
const STATE_RANGES = Object.freeze([
  Object.freeze({ state: "dropping", start: 0, end: 0.15 }),
  Object.freeze({ state: "closed", start: 0.15, end: 0.24 }),
  Object.freeze({ state: "opening", start: 0.24, end: 0.4 }),
  Object.freeze({ state: "readable", start: 0.4, end: 0.58 }),
  Object.freeze({ state: "folding", start: 0.58, end: 0.88 }),
  Object.freeze({ state: "plane", start: 0.88, end: 0.96 }),
  Object.freeze({ state: "controllable", start: 0.96, end: 1 }),
]);

function clamp(value, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function smoothstep(value) {
  const resolved = clamp(value);
  return resolved * resolved * (3 - 2 * resolved);
}

function lerp(from, to, progress) {
  return from + (to - from) * progress;
}

function rgba(hex, alpha) {
  const value = hex.replace("#", "");
  const number = Number.parseInt(value, 16);
  return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${clamp(alpha)})`;
}

function interpolatePoint(from, to, progress) {
  return Object.freeze({
    x: lerp(from.x, to.x, progress),
    y: lerp(from.y, to.y, progress),
  });
}

export function messageStateAt(progressValue) {
  const progress = clamp(progressValue);
  const range =
    STATE_RANGES.find(
      (candidate) =>
        progress >= candidate.start &&
        (progress < candidate.end || candidate.end === 1),
    ) ?? STATE_RANGES.at(-1);
  return Object.freeze({
    state: range.state,
    progress,
    localProgress: clamp(
      (progress - range.start) / Math.max(0.001, range.end - range.start),
    ),
  });
}

export function messageProgressForState(state, localProgress = 0.5) {
  const range =
    STATE_RANGES.find((candidate) => candidate.state === state) ??
    STATE_RANGES[0];
  return lerp(range.start, range.end, clamp(localProgress));
}

export function messagePoseAt(progressValue, dropDistance = 26) {
  const progress = clamp(progressValue);
  const dropping = clamp(progress / 0.24);
  const settle = smoothstep(dropping);
  const rotationFade = 1 - smoothstep(progress / 0.42);
  return Object.freeze({
    xOffset: Math.sin(progress * Math.PI * 3.2) * 4.2 * rotationFade,
    yOffset: settle * dropDistance,
    angle:
      Math.sin(progress * Math.PI * 4.4) * 0.28 * rotationFade +
      smoothstep((progress - 0.58) / 0.3) * 0.08,
  });
}

function traceSoftPaper(context, halfWidth, halfHeight, skew = 0) {
  context.beginPath();
  context.moveTo(-halfWidth + 1, -halfHeight + 0.5);
  context.quadraticCurveTo(0, -halfHeight - 0.7, halfWidth, -halfHeight + 1);
  context.lineTo(halfWidth - 0.6, halfHeight - 0.5 + skew);
  context.quadraticCurveTo(0, halfHeight + 0.8, -halfWidth, halfHeight - 1);
  context.closePath();
}

function drawClosedPaper(context, palette, openness) {
  const halfWidth = lerp(8.5, 15.5, openness);
  const halfHeight = lerp(5.6, 10, openness);
  const gradient = context.createLinearGradient(
    -halfWidth,
    -halfHeight,
    halfWidth,
    halfHeight,
  );
  gradient.addColorStop(0, rgba(palette.paper, 0.74));
  gradient.addColorStop(0.58, rgba(palette.paper, 0.9));
  gradient.addColorStop(1, rgba(palette.seed, 0.24));
  context.fillStyle = gradient;
  traceSoftPaper(context, halfWidth, halfHeight, openness * 0.7);
  context.fill();

  context.strokeStyle = rgba(palette.nightLift, 0.26);
  context.lineWidth = 0.65;
  context.beginPath();
  context.moveTo(-halfWidth + 1.5, -halfHeight + 1);
  context.lineTo(0, lerp(1.8, 0.2, openness));
  context.lineTo(halfWidth - 1.5, -halfHeight + 1);
  context.stroke();

  context.save();
  context.globalAlpha *= 1 - openness * 0.72;
  context.beginPath();
  context.moveTo(-halfWidth + 1.2, halfHeight - 1);
  context.lineTo(0, 0.8);
  context.lineTo(halfWidth - 1.2, halfHeight - 1);
  context.stroke();
  context.restore();
}

function drawReadableMarks(context, palette, progress, glow) {
  const reveal = smoothstep(progress);
  const rows = [
    { y: -4.2, width: 17 },
    { y: 0, width: 12 },
    { y: 4.2, width: 15 },
  ];
  context.save();
  context.lineCap = "round";
  context.lineWidth = 1.1;
  context.strokeStyle = rgba(palette.seed, 0.42 + glow * 0.18);
  context.shadowColor = palette.seed;
  context.shadowBlur = 4 + glow * 6;
  for (let index = 0; index < rows.length; index += 1) {
    const rowReveal = smoothstep(reveal * 1.45 - index * 0.18);
    if (rowReveal <= 0) continue;
    context.beginPath();
    context.moveTo(-9, rows[index].y);
    context.lineTo(-9 + rows[index].width * rowReveal, rows[index].y);
    context.stroke();
  }
  context.fillStyle = rgba(palette.paper, 0.62);
  for (let index = 0; index < 3; index += 1) {
    const dotReveal = smoothstep(reveal * 1.5 - 0.24 - index * 0.16);
    if (dotReveal <= 0) continue;
    context.beginPath();
    context.arc(10.5 + index * 2.3, -4.2, 0.75 * dotReveal, 0, TAU);
    context.fill();
  }
  context.restore();
}

function planePoints(scale = 1) {
  return Object.freeze({
    topRear: Object.freeze({ x: -14 * scale, y: -7 * scale }),
    tip: Object.freeze({ x: 17 * scale, y: 0 }),
    lowerRear: Object.freeze({ x: -11 * scale, y: 9 * scale }),
    notch: Object.freeze({ x: -4 * scale, y: 1.3 * scale }),
    centerRear: Object.freeze({ x: -8.5 * scale, y: 0 }),
  });
}

function drawPlaneLocal(
  context,
  {
    palette,
    contrast = 0.28,
    glow = 0.3,
    controllable = 0,
    time = 0,
  },
) {
  const points = planePoints();
  const trail = smoothstep(controllable);
  if (trail > 0.02) {
    context.save();
    context.globalAlpha *= trail * 0.28;
    context.strokeStyle = rgba(palette.route, 0.42);
    context.lineCap = "round";
    context.lineWidth = 1;
    for (let index = 0; index < 2; index += 1) {
      context.beginPath();
      context.moveTo(-10 - index * 2, -2 + index * 4);
      context.quadraticCurveTo(
        -19 - index * 4,
        -5 + index * 6,
        -27 - trail * 7,
        -1 + index * 3,
      );
      context.stroke();
    }
    context.restore();
  }

  context.fillStyle = rgba(palette.paper, 0.82);
  context.beginPath();
  context.moveTo(points.topRear.x, points.topRear.y);
  context.lineTo(points.tip.x, points.tip.y);
  context.lineTo(points.notch.x, points.notch.y);
  context.lineTo(points.centerRear.x, points.centerRear.y);
  context.closePath();
  context.fill();

  context.fillStyle = rgba(palette.paper, 0.82 - contrast * 0.72);
  context.beginPath();
  context.moveTo(points.lowerRear.x, points.lowerRear.y);
  context.lineTo(points.tip.x, points.tip.y);
  context.lineTo(points.notch.x, points.notch.y);
  context.closePath();
  context.fill();

  context.fillStyle = rgba(palette.seed, 0.2 + glow * 0.12);
  context.beginPath();
  context.moveTo(points.centerRear.x, points.centerRear.y);
  context.lineTo(points.tip.x, points.tip.y);
  context.lineTo(points.notch.x, points.notch.y);
  context.closePath();
  context.fill();

  context.strokeStyle = rgba(palette.nightLift, 0.34);
  context.lineWidth = 0.65;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(points.centerRear.x, points.centerRear.y);
  context.lineTo(points.tip.x, points.tip.y);
  context.moveTo(points.notch.x, points.notch.y);
  context.lineTo(points.lowerRear.x + 1.5, points.lowerRear.y - 1);
  context.stroke();

  if (controllable > 0 && controllable < 1) {
    const pulse = Math.sin(controllable * Math.PI);
    context.save();
    context.globalAlpha *= pulse * 0.34;
    context.strokeStyle = rgba(palette.seed, 0.7);
    context.shadowColor = palette.seed;
    context.shadowBlur = 8 + glow * 8;
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(
      lerp(-7, 5, controllable),
      lerp(-3.5, -1, controllable),
    );
    context.lineTo(
      lerp(0, 15, controllable),
      lerp(-1.5, 0, controllable),
    );
    context.stroke();
    context.globalAlpha *= 0.5;
    context.beginPath();
    context.arc(0, 0, 12 + controllable * 8 + Math.sin(time * 0.003), 0, TAU);
    context.stroke();
    context.restore();
  }
}

function drawFoldingPaper(context, palette, progress, contrast, glow) {
  const fold = smoothstep(progress);
  const open = [
    { x: -15.5, y: -10 },
    { x: 15.5, y: -9 },
    { x: 15, y: 10 },
    { x: -15, y: 10 },
  ];
  const plane = planePoints();
  const target = [
    plane.topRear,
    plane.tip,
    plane.lowerRear,
    plane.notch,
  ];
  const points = open.map((point, index) =>
    interpolatePoint(point, target[index], fold),
  );

  context.fillStyle = rgba(palette.paper, 0.83);
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) context.lineTo(point.x, point.y);
  context.closePath();
  context.fill();

  if (fold < 0.74) {
    const sideFold = smoothstep(fold / 0.45);
    context.fillStyle = rgba(palette.paper, 0.24 + contrast * 0.4);
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    context.lineTo(lerp(-8, -2, sideFold), 0);
    context.lineTo(points[3].x, points[3].y);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(points[1].x, points[1].y);
    context.lineTo(lerp(8, 2, sideFold), 0);
    context.lineTo(points[2].x, points[2].y);
    context.closePath();
    context.fill();
  }

  context.strokeStyle = rgba(palette.nightLift, 0.28);
  context.lineWidth = 0.65;
  context.beginPath();
  context.moveTo(lerp(0, plane.centerRear.x, fold), lerp(-9, 0, fold));
  context.lineTo(lerp(0, plane.tip.x, fold), lerp(10, 0, fold));
  context.stroke();

  if (fold > 0.62) {
    context.save();
    context.globalAlpha *= smoothstep((fold - 0.62) / 0.38);
    drawPlaneLocal(context, { palette, contrast, glow });
    context.restore();
  }
}

function drawFogReception(context, palette, progress, glow) {
  const reveal = Math.sin(clamp(progress / 0.34) * Math.PI);
  if (reveal <= 0) return;
  context.save();
  context.globalAlpha *= reveal * (0.12 + glow * 0.08);
  context.globalCompositeOperation = "lighter";
  context.scale(1.6, 0.72);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 20);
  gradient.addColorStop(0, rgba(palette.seed, 0.48));
  gradient.addColorStop(1, rgba(palette.seed, 0));
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, 20, 0, TAU);
  context.fill();
  context.restore();
}

export function drawMessageArt(
  context,
  {
    x,
    y,
    progress = 0,
    scale = 1,
    alpha = 1,
    glow = 0.35,
    contrast = 0.28,
    dropDistance = 26,
    fromFog = false,
    time = 0,
    palette = visualStyle.palette,
  },
) {
  const visual = messageStateAt(progress);
  const pose = messagePoseAt(progress, dropDistance);
  context.save();
  context.globalAlpha *= clamp(alpha);
  context.translate(x + pose.xOffset, y + pose.yOffset);
  context.rotate(pose.angle);
  context.scale(scale, scale);

  if (fromFog) drawFogReception(context, palette, visual.progress, glow);
  context.shadowColor = palette.seed;
  context.shadowBlur =
    visual.state === "opening" || visual.state === "readable"
      ? 5 + glow * 8
      : 2 + glow * 3;

  if (visual.state === "dropping" || visual.state === "closed") {
    drawClosedPaper(context, palette, 0);
  } else if (visual.state === "opening") {
    drawClosedPaper(context, palette, smoothstep(visual.localProgress));
  } else if (visual.state === "readable") {
    drawClosedPaper(context, palette, 1);
    drawReadableMarks(context, palette, visual.localProgress, glow);
  } else if (visual.state === "folding") {
    drawFoldingPaper(
      context,
      palette,
      visual.localProgress,
      clamp(contrast),
      clamp(glow),
    );
  } else {
    drawPlaneLocal(context, {
      palette,
      contrast: clamp(contrast),
      glow: clamp(glow),
      controllable:
        visual.state === "controllable" ? visual.localProgress : 0,
      time,
    });
  }
  context.restore();

  return Object.freeze({
    ...visual,
    pose,
    x: x + pose.xOffset,
    y: y + pose.yOffset,
  });
}

export function drawPaperPlaneArt(
  context,
  {
    x,
    y,
    angle = 0,
    scale = 1,
    alpha = 1,
    glow = 0.24,
    contrast = 0.28,
    controllable = 1,
    time = 0,
    palette = visualStyle.palette,
  },
) {
  context.save();
  context.globalAlpha *= clamp(alpha);
  context.translate(x, y);
  context.rotate(angle);
  context.scale(scale, scale);
  drawPlaneLocal(context, {
    palette,
    contrast: clamp(contrast),
    glow: clamp(glow),
    controllable: clamp(controllable),
    time,
  });
  context.restore();
}

export function drawLegacyMessageArt(
  context,
  {
    x,
    y,
    plane = false,
    scale = 1,
    palette = visualStyle.palette,
  },
) {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.fillStyle = palette.paper;
  context.strokeStyle = "rgba(23, 54, 61, 0.72)";
  context.lineWidth = 0.8;
  context.beginPath();
  if (plane) {
    context.moveTo(-13, -7);
    context.lineTo(16, 0);
    context.lineTo(-11, 9);
    context.lineTo(-4, 1);
  } else {
    context.rect(-8, -5, 16, 10);
  }
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}
