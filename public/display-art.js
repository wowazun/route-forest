import { visualStyle } from "./visual-style.js";
import { drawBirdArt } from "./bird-art.js";
import {
  drawTreeArt,
  getTreeArtCacheKey,
} from "./tree-art.js";

const palette = visualStyle.palette;

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function routeBend(routeId, index) {
  return Math.sin(hashText(routeId) + index) * 34;
}

export function createFogTexture(texture, random) {
  texture.width = 256;
  texture.height = 144;
  const textureContext = texture.getContext("2d");

  for (let index = 0; index < 7; index += 1) {
    const x = 34 + random() * 188;
    const y = 34 + random() * 76;
    const radius = 28 + random() * 46;
    const gradient = textureContext.createRadialGradient(
      x,
      y,
      radius * 0.08,
      x,
      y,
      radius,
    );
    gradient.addColorStop(0, "rgba(157, 187, 192, 0.38)");
    gradient.addColorStop(0.45, "rgba(157, 187, 192, 0.19)");
    gradient.addColorStop(1, "rgba(157, 187, 192, 0)");
    textureContext.fillStyle = gradient;
    textureContext.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  return texture;
}

export function drawRouteHighlight(
  context,
  { segments, routeId, progress },
) {
  const alpha = Math.pow(1 - progress, 1.7);
  const pulse = 1 + Math.sin(progress * Math.PI * 8) * 0.15;

  context.save();
  context.lineCap = "round";
  context.lineWidth = 2.2 * pulse;
  context.shadowColor = palette.route;
  context.shadowBlur = 20 * alpha;
  context.strokeStyle = `rgba(184, 222, 213, ${alpha * 0.72})`;

  for (const { from, to, index } of segments) {
    context.beginPath();
    context.moveTo(from.x, from.y);
    const bend = routeBend(routeId, index);
    context.quadraticCurveTo(
      (from.x + to.x) / 2,
      (from.y + to.y) / 2 + bend,
      to.x,
      to.y,
    );
    context.stroke();
  }
  context.restore();
}

export function drawBird(
  context,
  {
    x,
    y,
    angle,
    now,
    flap,
    alpha = 1,
    glow = 0.35,
    fogAmount = 0,
    scale = 1,
    phase = 0,
    silhouette = "swallow",
  },
) {
  return drawBirdArt(context, {
    x,
    y,
    angle,
    time: now,
    flap,
    alpha,
    glow,
    fogAmount,
    scale,
    phase,
    silhouette,
  });
}

export function drawRoutePath(
  context,
  { segments, routeId, bird, now },
) {
  context.save();
  context.lineWidth = 1.6;
  context.lineCap = "round";
  context.setLineDash([2, 8]);
  context.shadowColor = palette.route;
  context.shadowBlur = 12;

  for (const { from, to, index } of segments) {
    context.strokeStyle = "rgba(184, 222, 213, 0.75)";
    context.beginPath();
    context.moveTo(from.x, from.y);
    const bend = routeBend(routeId, index);
    context.quadraticCurveTo(
      (from.x + to.x) / 2,
      (from.y + to.y) / 2 + bend,
      to.x,
      to.y,
    );
    context.stroke();
  }

  drawBird(context, { ...bird, now });
  context.restore();
}

export function drawTree(context, { tree, position, now, alpha = 1 }) {
  void now;
  return drawTreeArt(context, {
    seed: tree.nodeId ?? `tree-${tree.variant ?? 0}`,
    x: position.x,
    y: position.y,
    size: tree.size,
    alpha,
  });
}

export { getTreeArtCacheKey };

export function drawFog(context, { fog, now, texture }) {
  const age = (now - fog.bornAt) / fog.life;
  const fade = Math.sin(Math.min(1, age) * Math.PI);
  context.save();
  context.globalAlpha = fade * 0.58;
  for (let index = 0; index < 3; index += 1) {
    const phase = fog.phase + index * 1.7;
    const x = fog.x + Math.sin(now * 0.00025 + phase) * fog.radius * 0.38;
    const y = fog.y + Math.cos(now * 0.0002 + phase) * fog.radius * 0.18;
    const width = fog.radius * (1.55 + index * 0.12);
    const height = fog.radius * (0.72 + index * 0.06);
    context.drawImage(
      texture,
      x - width / 2,
      y - height / 2,
      width,
      height,
    );
  }
  context.restore();
}
