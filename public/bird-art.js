import { visualStyle } from "./visual-style.js";

export const BIRD_ART_VERSION = "soft-wing-v3";
export const BIRD_SILHOUETTES = Object.freeze([
  "current",
  "swallow",
  "songbird",
  "mythic",
]);

const TAU = Math.PI * 2;
const DEFAULT_PALETTE = visualStyle.palette;

function clamp(value, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function rgba(hex, alpha) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${clamp(alpha)})`;
}

function shortestAngleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function uprightBirdPose(angle, maximumPitch = Math.PI * 0.32) {
  const normalized = Math.atan2(
    Math.sin(Number(angle) || 0),
    Math.cos(Number(angle) || 0),
  );
  const facing = Math.cos(normalized) < 0 ? -1 : 1;
  const relative =
    facing === 1
      ? normalized
      : normalized > 0
        ? normalized - Math.PI
        : normalized + Math.PI;
  const pitchLimit = clamp(
    Number(maximumPitch) || 0,
    0,
    Math.PI / 2,
  );
  return Object.freeze({
    angle: clamp(relative, -pitchLimit, pitchLimit),
    facing,
  });
}

export function smoothBirdHeading(
  current,
  target,
  deltaSeconds,
  response = 7.5,
) {
  if (!Number.isFinite(current)) return target;
  const amount = 1 - Math.exp(-response * Math.max(0, deltaSeconds));
  return current + shortestAngleDelta(current, target) * amount;
}

export function birdFlapAt(time, phase = 0) {
  return Math.sin(time * 0.0115 + phase);
}

export function birdLocalAnchor(name) {
  if (name === "seed") return Object.freeze({ x: -1.5, y: 7.5 });
  if (name === "letter") return Object.freeze({ x: -7, y: 7 });
  return Object.freeze({ x: 0, y: 0 });
}

export function birdWorldAnchor({
  x,
  y,
  angle = 0,
  scale = 1,
  name = "body",
}) {
  const anchor = birdLocalAnchor(name);
  const pose = uprightBirdPose(angle);
  const localX = anchor.x * pose.facing;
  const cosine = Math.cos(pose.angle);
  const sine = Math.sin(pose.angle);
  return Object.freeze({
    x: x + (localX * cosine - anchor.y * sine) * scale,
    y: y + (localX * sine + anchor.y * cosine) * scale,
  });
}

function glowTips(silhouette, flap) {
  if (silhouette === "swallow") {
    return [
      { x: -10, y: -24 - flap * 7 },
      { x: -6, y: 15 + flap * 4.5 },
    ];
  }
  if (silhouette === "songbird") {
    return [
      { x: -2, y: -16 - flap * 5 },
      { x: -4, y: 14 + flap * 4 },
    ];
  }
  if (silhouette === "mythic") {
    return [
      { x: -8, y: -27 - flap * 8 },
      { x: -5, y: 13 + flap * 4 },
    ];
  }
  return [
    { x: -14, y: -12 - flap * 5 },
    { x: -14, y: 12 + flap * 5 },
  ];
}

function drawSoftGlow(
  context,
  flap,
  glow,
  fogAmount,
  palette,
  silhouette,
) {
  const transition = Math.sin(clamp(fogAmount) * Math.PI);
  const glowAlpha =
    0.045 + clamp(glow) * 0.09 + transition * 0.13 + fogAmount * 0.07;

  context.save();
  context.globalAlpha *= glowAlpha;
  context.fillStyle = rgba(palette.seed, 0.72);
  context.shadowColor = palette.seed;
  context.shadowBlur = 5 + glow * 7 + fogAmount * 13;

  context.beginPath();
  context.ellipse(-2, 0, 18 + fogAmount * 5, 7 + fogAmount * 4, 0, 0, TAU);
  context.fill();

  for (const tip of glowTips(silhouette, flap)) {
    context.beginPath();
    context.ellipse(
      tip.x,
      tip.y,
      5.5 + fogAmount * 3,
      2.2,
      -0.18,
      0,
      TAU,
    );
    context.fill();
  }
  context.restore();
}

function drawTrail(context, glow, fogAmount, palette) {
  context.save();
  context.globalAlpha *= 0.08 + glow * 0.07 + fogAmount * 0.06;
  context.strokeStyle = rgba(palette.seed, 0.7);
  context.lineCap = "round";
  context.lineWidth = 1.4;
  context.shadowColor = palette.seed;
  context.shadowBlur = 4 + glow * 5;
  context.beginPath();
  context.moveTo(-15, 1);
  context.bezierCurveTo(-22, 2, -27, 4, -34, 3);
  context.stroke();
  context.restore();
}

function drawTail(context, palette) {
  context.fillStyle = rgba(palette.seed, 0.46);
  context.beginPath();
  context.moveTo(-11, -2.5);
  context.bezierCurveTo(-16, -7, -21, -7.5, -24, -6);
  context.bezierCurveTo(-20, -2.5, -18, 0, -12, 1.5);
  context.closePath();
  context.fill();

  context.fillStyle = rgba(palette.seed, 0.58);
  context.beginPath();
  context.moveTo(-12, 1);
  context.bezierCurveTo(-18, 2.5, -21, 6.5, -24, 8);
  context.bezierCurveTo(-18, 8.5, -14, 5.5, -9, 3);
  context.closePath();
  context.fill();
}

function drawFarWing(context, flap, palette) {
  const tipY = 11 + flap * 7;
  context.fillStyle = rgba(palette.seed, 0.34);
  context.beginPath();
  context.moveTo(4, 0);
  context.bezierCurveTo(-3, 2, -11, 7, -19, tipY);
  context.bezierCurveTo(-23, tipY + 2, -22, tipY + 5, -18, tipY + 5.5);
  context.bezierCurveTo(-8, tipY + 4, -1, 6, 8, 2);
  context.bezierCurveTo(9, 1, 8, 0, 4, 0);
  context.closePath();
  context.fill();
}

function drawNearWing(context, flap, palette) {
  const tipY = -13 - flap * 8;
  context.fillStyle = rgba(palette.seed, 0.7);
  context.beginPath();
  context.moveTo(7, -1);
  context.bezierCurveTo(-2, -4, -10, -9, -18, tipY);
  context.bezierCurveTo(-22, tipY - 1.5, -25, tipY + 0.5, -21, tipY + 3.5);
  context.bezierCurveTo(-13, tipY + 8, -5, -2, 9, 1);
  context.bezierCurveTo(10, 0, 9, -1, 7, -1);
  context.closePath();
  context.fill();

  context.save();
  context.globalAlpha *= 0.24;
  context.strokeStyle = rgba(palette.seed, 0.74);
  context.lineCap = "round";
  context.lineWidth = 1.15;
  context.beginPath();
  context.moveTo(5, -1);
  context.bezierCurveTo(-5, -5, -12, -10, -20, tipY + 1.5);
  context.stroke();
  context.restore();
}

function drawBody(context, palette) {
  context.fillStyle = rgba(palette.seed, 0.84);
  context.beginPath();
  context.moveTo(-14, 0);
  context.bezierCurveTo(-8, -5.5, 4, -6.5, 13, -3.8);
  context.bezierCurveTo(16, -3, 18.5, -1.6, 19.5, -0.5);
  context.lineTo(24, 1);
  context.lineTo(19, 3);
  context.bezierCurveTo(14, 5.8, 3, 6.2, -7, 4.2);
  context.bezierCurveTo(-11, 3.4, -13, 2, -14, 0);
  context.closePath();
  context.fill();

  context.fillStyle = rgba(palette.seed, 0.38);
  context.beginPath();
  context.ellipse(3, 2.4, 10, 2.7, 0.04, 0, TAU);
  context.fill();

  context.fillStyle = rgba(palette.paper, 0.48);
  context.beginPath();
  context.arc(15.5, -1.2, 0.85, 0, TAU);
  context.fill();
}

function drawHeadAndBeak(
  context,
  {
    x,
    y,
    radius,
    beakLength,
    palette,
    headAlpha = 0.88,
  },
) {
  context.fillStyle = rgba(palette.seed, headAlpha);
  context.beginPath();
  context.arc(x, y, radius, 0, TAU);
  context.fill();

  context.fillStyle = rgba(palette.seed, 0.94);
  context.beginPath();
  context.moveTo(x + radius * 0.7, y - radius * 0.36);
  context.lineTo(x + radius + beakLength, y + radius * 0.08);
  context.lineTo(x + radius * 0.68, y + radius * 0.42);
  context.closePath();
  context.fill();

  context.fillStyle = rgba(palette.paper, 0.52);
  context.beginPath();
  context.arc(x + radius * 0.18, y - radius * 0.28, 0.75, 0, TAU);
  context.fill();
}

function drawSwallow(context, flap, palette) {
  const upperTipY = -24 - flap * 7;
  const lowerTipY = 15 + flap * 4.5;

  context.fillStyle = rgba(palette.seed, 0.27);
  context.beginPath();
  context.moveTo(5, 1);
  context.bezierCurveTo(2, 5, -1, 10, -6, lowerTipY);
  context.bezierCurveTo(-8.5, lowerTipY + 1.5, -10, lowerTipY, -8, lowerTipY - 3);
  context.bezierCurveTo(-5, 10, -1, 5, 6.5, 2);
  context.bezierCurveTo(7, 1.5, 6.5, 1, 5, 1);
  context.closePath();
  context.fill();

  context.fillStyle = rgba(palette.seed, 0.72);
  context.beginPath();
  context.moveTo(7, 1);
  context.bezierCurveTo(4, -5, 1, -12, -2, upperTipY + 7);
  context.bezierCurveTo(-5, upperTipY + 2, -8, upperTipY, -10, upperTipY);
  context.bezierCurveTo(-13, upperTipY - 0.5, -15, upperTipY + 2.5, -12, upperTipY + 6);
  context.bezierCurveTo(-8, upperTipY + 11, -4, -10, 0, -4);
  context.bezierCurveTo(2, -1, 5, 1, 7, 1);
  context.closePath();
  context.fill();

  context.fillStyle = rgba(palette.seed, 0.5);
  context.beginPath();
  context.moveTo(-7, -1);
  context.bezierCurveTo(-10, -3.5, -12.5, -4.5, -14, -4);
  context.lineTo(-12, 0);
  context.lineTo(-14, 4);
  context.bezierCurveTo(-12, 4.5, -9.5, 3, -6, 1);
  context.closePath();
  context.fill();

  context.fillStyle = rgba(palette.seed, 0.82);
  context.beginPath();
  context.ellipse(1.5, 0.2, 10.5, 5.8, -0.08, 0, TAU);
  context.fill();
  drawHeadAndBeak(context, {
    x: 10.5,
    y: -1.35,
    radius: 4.2,
    beakLength: 5.2,
    palette,
  });
}

function drawSongbird(context, flap, palette) {
  const upperTipY = -16 - flap * 5;
  const lowerTipY = 14 + flap * 4;

  context.fillStyle = rgba(palette.seed, 0.32);
  context.beginPath();
  context.moveTo(2, 1);
  context.bezierCurveTo(0, 6, -1, 11, -4, lowerTipY);
  context.bezierCurveTo(-6, lowerTipY + 2, -9, lowerTipY, -7, lowerTipY - 3);
  context.bezierCurveTo(-4, 8, 0, 4, 6, 2);
  context.closePath();
  context.fill();

  context.fillStyle = rgba(palette.seed, 0.68);
  context.beginPath();
  context.moveTo(4, -1);
  context.bezierCurveTo(2, -6, 1, -11, -2, upperTipY);
  context.bezierCurveTo(-4, upperTipY - 2, -7, upperTipY, -6, upperTipY + 3);
  context.bezierCurveTo(-3, -8, 0, -4, 7, 0);
  context.closePath();
  context.fill();

  context.fillStyle = rgba(palette.seed, 0.46);
  context.beginPath();
  context.moveTo(-7, -2);
  context.lineTo(-15, -5);
  context.quadraticCurveTo(-13, 0, -16, 4.5);
  context.lineTo(-7, 3);
  context.closePath();
  context.fill();

  context.fillStyle = rgba(palette.seed, 0.8);
  context.beginPath();
  context.ellipse(1, 0.8, 9.8, 6.8, 0.05, 0, TAU);
  context.fill();
  drawHeadAndBeak(context, {
    x: 9.5,
    y: -1.1,
    radius: 4.8,
    beakLength: 3.4,
    palette,
  });
}

function drawMythic(context, flap, palette) {
  const upperTipY = -27 - flap * 8;
  const lowerTipY = 13 + flap * 4;

  context.fillStyle = rgba(palette.seed, 0.3);
  context.beginPath();
  context.moveTo(2, 1);
  context.bezierCurveTo(-1, 5, -3, 9, -5, lowerTipY);
  context.bezierCurveTo(-7, lowerTipY + 2, -9, lowerTipY, -7, lowerTipY - 3);
  context.bezierCurveTo(-4, 7, 0, 3, 6, 2);
  context.closePath();
  context.fill();

  context.fillStyle = rgba(palette.seed, 0.74);
  context.beginPath();
  context.moveTo(5, -1);
  context.bezierCurveTo(0, -7, -3, -17, -8, upperTipY);
  context.bezierCurveTo(-10, upperTipY - 3, -13, upperTipY, -11, upperTipY + 5);
  context.bezierCurveTo(-8, -17, -4, -9, -1, -6);
  context.bezierCurveTo(1, -4, 5, -2, 8, 0);
  context.closePath();
  context.fill();

  context.fillStyle = rgba(palette.seed, 0.5);
  context.beginPath();
  context.moveTo(-7, -1.5);
  context.lineTo(-16, -4);
  context.lineTo(-13, 0);
  context.lineTo(-16, 4);
  context.lineTo(-6, 2);
  context.closePath();
  context.fill();

  context.fillStyle = rgba(palette.seed, 0.8);
  context.beginPath();
  context.ellipse(1, 0.5, 9.5, 5.8, 0, 0, TAU);
  context.fill();
  drawHeadAndBeak(context, {
    x: 10,
    y: -1.1,
    radius: 4,
    beakLength: 4.5,
    palette,
  });
}

function drawSilhouette(context, silhouette, flap, palette) {
  if (silhouette === "swallow") {
    drawSwallow(context, flap, palette);
    return;
  }
  if (silhouette === "songbird") {
    drawSongbird(context, flap, palette);
    return;
  }
  if (silhouette === "mythic") {
    drawMythic(context, flap, palette);
    return;
  }
  drawTail(context, palette);
  drawFarWing(context, flap, palette);
  drawNearWing(context, flap, palette);
  drawBody(context, palette);
}

export function drawBirdArt(
  context,
  {
    x = 0,
    y = 0,
    angle = 0,
    scale = 1,
    time = 0,
    flap,
    phase = 0,
    alpha = 1,
    glow = 0.35,
    fogAmount = 0,
    silhouette = "swallow",
    palette = DEFAULT_PALETTE,
  } = {},
) {
  const resolvedFlap = clamp(
    Number.isFinite(flap) ? flap : birdFlapAt(time, phase),
    -1,
    1,
  );
  const resolvedFog = clamp(fogAmount);
  const resolvedSilhouette = BIRD_SILHOUETTES.includes(silhouette)
    ? silhouette
    : "swallow";
  const bodyAlpha = clamp(alpha) * (1 - resolvedFog * 0.83);
  const pose = uprightBirdPose(angle);

  context.save();
  context.translate(x, y);
  context.rotate(pose.angle);
  context.scale(scale * pose.facing, scale);

  drawTrail(context, clamp(glow), resolvedFog, palette);
  drawSoftGlow(
    context,
    resolvedFlap,
    clamp(glow),
    resolvedFog,
    palette,
    resolvedSilhouette,
  );

  context.save();
  context.globalAlpha *= bodyAlpha;
  drawSilhouette(
    context,
    resolvedSilhouette,
    resolvedFlap,
    palette,
  );
  context.restore();

  if (resolvedFog > 0.72) {
    context.save();
    context.globalAlpha *=
      clamp(alpha) * (0.12 + (resolvedFog - 0.72) * 0.18);
    context.fillStyle = palette.seed;
    context.shadowColor = palette.seed;
    context.shadowBlur = 12 + resolvedFog * 9;
    context.beginPath();
    context.arc(1, 0, 1.7 + resolvedFog * 0.8, 0, TAU);
    context.fill();
    context.restore();
  }

  context.restore();
  return Object.freeze({
    flap: resolvedFlap,
    fogAmount: resolvedFog,
    facing: pose.facing,
    angle: pose.angle,
    bodyAlpha,
    silhouette: resolvedSilhouette,
  });
}
