import { drawBirdArt } from "./bird-art.js";
import {
  drawMessageArt,
  drawPaperPlaneArt,
} from "./message-art.js";
import {
  drawTreeArt,
  getTreeArtCacheKey,
} from "./tree-art.js";
import {
  drawRouteLightFlow,
  ROUTE_ART_VERSION,
} from "./route-art.js?v=3";

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

function samePoint(left, right) {
  return (
    left === right ||
    (left?.x === right?.x && left?.y === right?.y)
  );
}

function connectedRouteChains(segments) {
  const chains = [];
  for (const segment of segments) {
    const current = chains.at(-1);
    const previousSegment = current?.at(-1);
    if (
      !current ||
      !samePoint(previousSegment.to, segment.from) ||
      previousSegment.index + 1 !== segment.index
    ) {
      chains.push([segment]);
    } else {
      current.push(segment);
    }
  }
  return chains;
}

function pointTangent(points, index) {
  const point = points[index];
  if (index === 0) {
    const next = points[1];
    return {
      x: (next.x - point.x) * 0.28,
      y: (next.y - point.y) * 0.28,
    };
  }
  if (index === points.length - 1) {
    const previous = points[index - 1];
    return {
      x: (point.x - previous.x) * 0.28,
      y: (point.y - previous.y) * 0.28,
    };
  }

  const previous = points[index - 1];
  const next = points[index + 1];
  const directionX = next.x - previous.x;
  const directionY = next.y - previous.y;
  const directionLength = Math.hypot(directionX, directionY) || 1;
  const handleLength =
    Math.min(
      Math.hypot(point.x - previous.x, point.y - previous.y),
      Math.hypot(next.x - point.x, next.y - point.y),
    ) * 0.28;
  return {
    x: (directionX / directionLength) * handleLength,
    y: (directionY / directionLength) * handleLength,
  };
}

export function createSmoothRouteChains(segments, routeId = "route") {
  return Object.freeze(
    connectedRouteChains(segments).map((chain) => {
      const points = [chain[0].from, ...chain.map((segment) => segment.to)];
      const singleSegment = chain.length === 1;
      const tangents = singleSegment
        ? null
        : points.map((_, index) => pointTangent(points, index));
      const curves = chain.map((segment, index) => {
        if (singleSegment) {
          const deltaX = segment.to.x - segment.from.x;
          const deltaY = segment.to.y - segment.from.y;
          const length = Math.hypot(deltaX, deltaY) || 1;
          const bend = routeBend(routeId, segment.index) * 0.38;
          const normalX = -deltaY / length;
          const normalY = deltaX / length;
          return Object.freeze({
            from: segment.from,
            to: segment.to,
            control1: Object.freeze({
              x: segment.from.x + deltaX * 0.32 + normalX * bend,
              y: segment.from.y + deltaY * 0.32 + normalY * bend,
            }),
            control2: Object.freeze({
              x: segment.from.x + deltaX * 0.68 + normalX * bend,
              y: segment.from.y + deltaY * 0.68 + normalY * bend,
            }),
            index: segment.index,
          });
        }
        return Object.freeze({
          from: segment.from,
          to: segment.to,
          control1: Object.freeze({
            x: segment.from.x + tangents[index].x,
            y: segment.from.y + tangents[index].y,
          }),
          control2: Object.freeze({
            x: segment.to.x - tangents[index + 1].x,
            y: segment.to.y - tangents[index + 1].y,
          }),
          index: segment.index,
        });
      });
      return Object.freeze({
        start: chain[0].from,
        curves: Object.freeze(curves),
      });
    }),
  );
}

export function strokeSmoothRoute(context, { segments, routeId }) {
  for (const chain of createSmoothRouteChains(segments, routeId)) {
    context.beginPath();
    context.moveTo(chain.start.x, chain.start.y);
    for (const curve of chain.curves) {
      context.bezierCurveTo(
        curve.control1.x,
        curve.control1.y,
        curve.control2.x,
        curve.control2.y,
        curve.to.x,
        curve.to.y,
      );
    }
    context.stroke();
  }
}

export function createFogTexture(texture, random) {
  const padding = 80;
  texture.width = 256 + padding * 2;
  texture.height = 144 + padding * 2;
  const textureContext = texture.getContext("2d");

  for (let index = 0; index < 7; index += 1) {
    const x = padding + 34 + random() * 188;
    const y = padding + 34 + random() * 76;
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
  { segments, routeId, progress, color, style },
) {
  return drawRouteLightFlow(context, {
    segments,
    routeId,
    progress,
    style: {
      color: color || "#d5a24b",
      ...style,
    },
  });
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
    palette: birdPalette,
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
    palette: birdPalette,
  });
}

export function drawMessage(context, options) {
  return drawMessageArt(context, options);
}

export function drawPaperPlane(context, options) {
  return drawPaperPlaneArt(context, options);
}

export function drawPlaneWind(
  context,
  { x, y, wind, alpha = 0.16, scale = 1 },
) {
  const magnitude = Math.hypot(wind?.x || 0, wind?.y || 0);
  if (magnitude < 0.03) return;
  const directionX = wind.x / magnitude;
  const directionY = wind.y / magnitude;
  const normalX = -directionY;
  const normalY = directionX;
  context.save();
  context.lineCap = "round";
  context.lineWidth = 0.9;
  context.strokeStyle = `rgba(116, 169, 165, ${Math.min(0.24, alpha)})`;
  for (let index = -1; index <= 1; index += 1) {
    const offset = index * 8 * scale;
    const startX = x - directionX * 22 * scale + normalX * offset;
    const startY = y - directionY * 22 * scale + normalY * offset;
    context.beginPath();
    context.moveTo(startX, startY);
    context.quadraticCurveTo(
      x - directionX * 8 * scale + normalX * offset * 0.8,
      y - directionY * 8 * scale + normalY * offset * 0.8,
      x + directionX * 7 * scale + normalX * offset * 0.55,
      y + directionY * 7 * scale + normalY * offset * 0.55,
    );
    context.stroke();
  }
  context.restore();
}

export function drawRoutePath(
  context,
  { segments, routeId, bird, now },
) {
  void segments;
  void routeId;
  context.save();
  drawBird(context, { ...bird, now });
  context.restore();
}

export { ROUTE_ART_VERSION };

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
  const textureScaleX =
    Number.isFinite(texture.width) && texture.width > 0
      ? texture.width / 256
      : 1;
  const textureScaleY =
    Number.isFinite(texture.height) && texture.height > 0
      ? texture.height / 144
      : 1;
  context.save();
  context.globalAlpha = fade * 0.58;
  for (let index = 0; index < 3; index += 1) {
    const phase = fog.phase + index * 1.7;
    const x = fog.x + Math.sin(now * 0.00025 + phase) * fog.radius * 0.38;
    const y = fog.y + Math.cos(now * 0.0002 + phase) * fog.radius * 0.18;
    const width =
      fog.radius * (1.55 + index * 0.12) * textureScaleX;
    const height =
      fog.radius * (0.72 + index * 0.06) * textureScaleY;
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
