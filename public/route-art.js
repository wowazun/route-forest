const TAU = Math.PI * 2;

export const ROUTE_ART_VERSION = "route-light-flow-v4";

export const DEFAULT_ROUTE_LIGHT_STYLE = Object.freeze({
  mode: "complete",
  lightCount: 4,
  lightSize: 1,
  brightness: 0.96,
  tailLength: 0.13,
  trailWidth: 1.12,
  trailPersistence: 0.72,
  afterglowSegments: 2,
  hazeStrength: 0.82,
  hazeSize: 1.15,
  trailBreakup: 0.42,
  curveWander: 1,
  treeReaction: 0.72,
  color: "#d5a24b",
});

function clamp(value, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < String(value).length; index += 1) {
    hash ^= String(value).charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFrom(seed) {
  let value = (seed >>> 0) || 1;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4_294_967_296;
  };
}

function sourceIdentity(point, fallback) {
  return (
    point?.source?.nodeId ||
    point?.source?.tree?.nodeId ||
    point?.nodeId ||
    fallback
  );
}

function isTreePoint(point) {
  return point?.source?.kind === "tree";
}

function treeCrownRadius(point) {
  if (!isTreePoint(point)) return 0;
  const size =
    point?.source?.size ??
    point?.source?.tree?.size ??
    point?.treeSize ??
    42;
  return Math.max(17, Math.min(52, 12 + Number(size) * 0.46));
}

function anchoredSegmentEndpoints(segment, routeId) {
  const deltaX = segment.to.x - segment.from.x;
  const deltaY = segment.to.y - segment.from.y;
  const length = Math.hypot(deltaX, deltaY) || 1;
  const directionX = deltaX / length;
  const directionY = deltaY / length;
  const normalX = -directionY;
  const normalY = directionX;
  const seed = hashText(
    `${routeId}:${sourceIdentity(segment.from, "from")}:` +
      `${sourceIdentity(segment.to, "to")}:${segment.index}`,
  );
  const random = randomFrom(seed);
  const fromRadius = treeCrownRadius(segment.from);
  const toRadius = treeCrownRadius(segment.to);
  const fromSide = (random() - 0.5) * fromRadius * 0.34;
  const toSide = (random() - 0.5) * toRadius * 0.34;

  return Object.freeze({
    seed,
    fromCenter: segment.from,
    toCenter: segment.to,
    from: Object.freeze({
      x:
        segment.from.x +
        directionX * fromRadius * 0.78 +
        normalX * fromSide,
      y:
        segment.from.y +
        directionY * fromRadius * 0.62 +
        normalY * fromSide -
        fromRadius * 0.28,
    }),
    to: Object.freeze({
      x:
        segment.to.x -
        directionX * toRadius * 0.78 +
        normalX * toSide,
      y:
        segment.to.y -
        directionY * toRadius * 0.62 +
        normalY * toSide -
        toRadius * 0.34,
    }),
  });
}

function catmullRom(p0, p1, p2, p3, progress) {
  const t = clamp(progress);
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

function sampledSpline(controlPoints, samplesPerSpan = 12) {
  const samples = [];
  let distance = 0;
  let previous = null;
  for (let span = 0; span < controlPoints.length - 1; span += 1) {
    const p0 = controlPoints[Math.max(0, span - 1)];
    const p1 = controlPoints[span];
    const p2 = controlPoints[span + 1];
    const p3 = controlPoints[Math.min(controlPoints.length - 1, span + 2)];
    const start = span === 0 ? 0 : 1;
    for (let sample = start; sample <= samplesPerSpan; sample += 1) {
      const point = catmullRom(p0, p1, p2, p3, sample / samplesPerSpan);
      if (previous) {
        distance += Math.hypot(point.x - previous.x, point.y - previous.y);
      }
      samples.push(Object.freeze({ ...point, distance }));
      previous = point;
    }
  }
  return Object.freeze({
    samples: Object.freeze(samples),
    length: distance,
  });
}

export function createRouteLightPath(
  segment,
  routeId = "route",
  curveWander = 1,
) {
  const anchored = anchoredSegmentEndpoints(segment, routeId);
  const deltaX = anchored.to.x - anchored.from.x;
  const deltaY = anchored.to.y - anchored.from.y;
  const length = Math.hypot(deltaX, deltaY) || 1;
  const directionX = deltaX / length;
  const directionY = deltaY / length;
  const normalX = -directionY;
  const normalY = directionX;
  const random = randomFrom(anchored.seed ^ 0x9e3779b9);
  const middleCount = 2 + (anchored.seed % 3);
  const amplitude =
    Math.min(82, Math.max(16, length * 0.19)) *
    Math.max(0, Number(curveWander) || 0);
  const controlPoints = [anchored.from];

  for (let index = 0; index < middleCount; index += 1) {
    const progress = (index + 1) / (middleCount + 1);
    const envelope = Math.sin(progress * Math.PI);
    const normalOffset =
      (random() * 2 - 1) *
      amplitude *
      envelope *
      (0.52 + random() * 0.48);
    const tangentOffset =
      (random() * 2 - 1) * Math.min(18, length * 0.055);
    controlPoints.push(
      Object.freeze({
        x:
          anchored.from.x +
          deltaX * progress +
          normalX * normalOffset +
          directionX * tangentOffset,
        y:
          anchored.from.y +
          deltaY * progress +
          normalY * normalOffset +
          directionY * tangentOffset,
      }),
    );
  }
  controlPoints.push(anchored.to);

  return Object.freeze({
    ...anchored,
    controlPoints: Object.freeze(controlPoints),
    ...sampledSpline(controlPoints),
  });
}

export function createRouteLightModel({
  segments,
  routeId = "route",
  curveWander = 1,
}) {
  const sourceSegments = Array.isArray(segments) ? segments : [];
  const observed = [];
  for (let sourceIndex = 0; sourceIndex < sourceSegments.length; sourceIndex += 1) {
    const segment = sourceSegments[sourceIndex];
    if (segment.unobserved) continue;
    observed.push(
      Object.freeze({
        index: segment.index,
        sourceIndex,
        emergesFromFog:
          sourceIndex > 0 && sourceSegments[sourceIndex - 1].unobserved === true,
        dissolvesIntoFog:
          sourceIndex < sourceSegments.length - 1 &&
          sourceSegments[sourceIndex + 1].unobserved === true,
        path: createRouteLightPath(segment, routeId, curveWander),
      }),
    );
  }
  const events = observed.map((segment) =>
    Object.freeze({
      kind: "observed",
      order: segment.sourceIndex,
      segment,
    }),
  );
  for (let sourceIndex = 0; sourceIndex < sourceSegments.length; sourceIndex += 1) {
    if (!sourceSegments[sourceIndex].unobserved) continue;
    const firstIndex = sourceIndex;
    while (
      sourceIndex + 1 < sourceSegments.length &&
      sourceSegments[sourceIndex + 1].unobserved
    ) {
      sourceIndex += 1;
    }
    const first = sourceSegments[firstIndex];
    const last = sourceSegments[sourceIndex];
    events.push(
      Object.freeze({
        kind: "fog",
        order: firstIndex,
        seed: hashText(`${routeId}:fog:${first.index}:${last.index}`),
        fromTree: isTreePoint(first.from) ? first.from : null,
        entryFog: first.to,
        exitFog: last.from,
        toTree: isTreePoint(last.to) ? last.to : null,
      }),
    );
  }
  events.sort((left, right) => left.order - right.order);
  return Object.freeze({
    routeId,
    sourceSegmentCount: sourceSegments.length,
    segments: Object.freeze(observed),
    events: Object.freeze(events),
  });
}

export function sampleRouteLightPath(path, progress, normalOffset = 0) {
  const samples = path?.samples || [];
  if (samples.length === 0) {
    return Object.freeze({ x: 0, y: 0, angle: 0 });
  }
  const target = clamp(progress) * path.length;
  let index = 1;
  while (index < samples.length && samples[index].distance < target) {
    index += 1;
  }
  const next = samples[Math.min(samples.length - 1, index)];
  const previous = samples[Math.max(0, index - 1)];
  const span = next.distance - previous.distance || 1;
  const ratio = clamp((target - previous.distance) / span);
  const x = previous.x + (next.x - previous.x) * ratio;
  const y = previous.y + (next.y - previous.y) * ratio;
  const angle = Math.atan2(next.y - previous.y, next.x - previous.x);
  return Object.freeze({
    x: x - Math.sin(angle) * normalOffset,
    y: y + Math.cos(angle) * normalOffset,
    angle,
  });
}

function rgba(hex, alpha) {
  const value = String(hex).replace("#", "");
  const normalized =
    value.length === 3
      ? value
          .split("")
          .map((character) => character + character)
          .join("")
      : value.padEnd(6, "0").slice(0, 6);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${clamp(alpha)})`;
}

function strokePathRange(
  context,
  path,
  start,
  end,
  {
    width,
    alpha,
    color,
    breakup = 0,
    seed = 1,
    pieces = 28,
  },
) {
  const from = clamp(start);
  const to = clamp(end);
  if (to <= from || alpha <= 0) return;
  const random = randomFrom(seed);
  const count = Math.max(3, Math.round(pieces));
  for (let index = 0; index < count; index += 1) {
    const localStart = Math.max(from, index / count);
    const localEnd = Math.min(to, (index + 0.78) / count);
    const keep = random() > breakup * (0.34 + (index % 3) * 0.12);
    const widthNoise = 0.58 + random() * 0.72;
    const alphaNoise = 0.48 + random() * 0.52;
    if (!keep || localEnd <= localStart) continue;
    const pointA = sampleRouteLightPath(path, localStart);
    const pointB = sampleRouteLightPath(path, localEnd);
    context.beginPath();
    context.moveTo(pointA.x, pointA.y);
    context.lineTo(pointB.x, pointB.y);
    context.lineCap = "round";
    context.lineWidth = width * widthNoise;
    context.strokeStyle = rgba(color, alpha * alphaNoise);
    context.stroke();
  }
}

function drawLightParticle(
  context,
  path,
  progress,
  {
    seed,
    color,
    size,
    alpha,
    tailLength,
    offset,
    hazeStrength,
    hazeSize,
  },
) {
  const head = sampleRouteLightPath(path, progress, offset);
  const tailStart = Math.max(0, progress - tailLength);
  const hazeRandom = randomFrom(seed ^ 0x85ebca6b);
  if (hazeStrength > 0) {
    const hazePoints = [
      {
        point: sampleRouteLightPath(
          path,
          Math.max(0, progress - tailLength * 0.18),
          offset * 0.88,
        ),
        length: 7.2,
        width: 2.8,
        alpha: 0.14,
      },
      {
        point: sampleRouteLightPath(
          path,
          Math.max(0, progress - tailLength * 0.58),
          offset * 0.62,
        ),
        length: 5.4,
        width: 2.15,
        alpha: 0.08,
      },
    ];
    context.save();
    context.globalCompositeOperation = "screen";
    for (const haze of hazePoints) {
      context.save();
      context.translate(haze.point.x, haze.point.y);
      context.rotate(
        haze.point.angle + (hazeRandom() - 0.5) * 0.22,
      );
      context.shadowColor = rgba(color, alpha * hazeStrength * 0.72);
      context.shadowBlur = size * hazeSize * 11;
      context.fillStyle = rgba(
        color,
        alpha * hazeStrength * haze.alpha,
      );
      context.beginPath();
      context.ellipse(
        0,
        0,
        size * hazeSize * haze.length,
        size * hazeSize * haze.width,
        0,
        0,
        TAU,
      );
      context.fill();
      context.restore();
    }
    context.restore();
  }
  const tailPieces = 5;
  for (let index = 0; index < tailPieces; index += 1) {
    const pieceStart =
      tailStart + ((progress - tailStart) * index) / tailPieces;
    const pieceEnd =
      tailStart + ((progress - tailStart) * (index + 0.82)) / tailPieces;
    const pointA = sampleRouteLightPath(path, pieceStart, offset);
    const pointB = sampleRouteLightPath(path, pieceEnd, offset * 0.72);
    context.beginPath();
    context.moveTo(pointA.x, pointA.y);
    context.lineTo(pointB.x, pointB.y);
    context.lineCap = "round";
    context.lineWidth = size * (0.42 + index * 0.13);
    context.strokeStyle = rgba(
      color,
      alpha * (0.16 + (index / tailPieces) * 0.5),
    );
    context.stroke();
  }

  const random = randomFrom(seed);
  context.save();
  context.translate(head.x, head.y);
  context.rotate(head.angle + (random() - 0.5) * 0.16);
  context.shadowColor = rgba(color, alpha * 0.9);
  context.shadowBlur = 7 + size * 6;
  context.fillStyle = rgba(color, alpha);
  context.beginPath();
  context.ellipse(
    0,
    0,
    size * (1.25 + random() * 0.65),
    size * (0.34 + random() * 0.22),
    0,
    0,
    TAU,
  );
  context.fill();
  context.restore();
}

function drawTreeReaction(
  context,
  point,
  progress,
  {
    seed,
    color,
    strength,
    arriving,
  },
) {
  if (!isTreePoint(point) || strength <= 0) return;
  const intensity = Math.sin(clamp(progress) * Math.PI) * strength;
  if (intensity <= 0.001) return;
  const radius = treeCrownRadius(point);
  const random = randomFrom(seed ^ (arriving ? 0x85ebca6b : 0xc2b2ae35));

  context.save();
  context.lineCap = "round";
  for (let index = 0; index < 5; index += 1) {
    const phase = clamp(progress * 1.45 - index * 0.085);
    if (phase <= 0) continue;
    const angle =
      -Math.PI * (0.16 + random() * 0.68) +
      (arriving ? -0.1 : 0.12);
    const distance = radius * (0.38 + random() * 0.54);
    const x = point.x + Math.cos(angle) * distance;
    const y = point.y + Math.sin(angle) * distance - radius * 0.28;
    context.save();
    context.translate(x, y);
    context.rotate(angle + Math.PI * 0.5);
    context.fillStyle = rgba(
      color,
      intensity * phase * (0.18 + random() * 0.28),
    );
    context.beginPath();
    context.ellipse(
      0,
      0,
      2.2 + random() * 3,
      0.9 + random() * 1.2,
      0,
      0,
      TAU,
    );
    context.fill();
    context.restore();
  }

  const branchAngle = arriving ? -1.22 : -1.78;
  context.beginPath();
  context.moveTo(point.x, point.y - radius * 0.06);
  context.lineTo(
    point.x + Math.cos(branchAngle) * radius * 0.54,
    point.y - radius * 0.1 + Math.sin(branchAngle) * radius * 0.54,
  );
  context.lineWidth = 0.8 + intensity * 0.9;
  context.strokeStyle = rgba(color, intensity * 0.3);
  context.stroke();
  context.restore();
}

function drawFogBoundaryMotes(
  context,
  {
    tree,
    fog,
    progress,
    seed,
    color,
    brightness,
    size,
    dissolving,
  },
) {
  if (!tree || !fog) return;
  const local = clamp(progress);
  const deltaX = fog.x - tree.x;
  const deltaY = fog.y - tree.y;
  const length = Math.hypot(deltaX, deltaY) || 1;
  const directionX = deltaX / length;
  const directionY = deltaY / length;
  const normalX = -directionY;
  const normalY = directionX;
  const radius = treeCrownRadius(tree);
  const anchorX = tree.x + directionX * radius * 0.74;
  const anchorY = tree.y + directionY * radius * 0.58 - radius * 0.28;
  const travelProgress = dissolving ? local : 1 - local;
  const visibility = dissolving ? 1 - local : local;

  for (let index = 0; index < 4; index += 1) {
    const random = randomFrom(seed ^ Math.imul(index + 1, 0x9e3779b1));
    const scatter =
      (random() - 0.5) * 13 * travelProgress * (0.45 + random() * 0.55);
    const travel = (8 + random() * 17) * travelProgress;
    const x = anchorX + directionX * travel + normalX * scatter;
    const y = anchorY + directionY * travel + normalY * scatter;
    context.save();
    context.translate(x, y);
    context.rotate(Math.atan2(directionY, directionX));
    context.fillStyle = rgba(
      color,
      brightness * visibility * (0.25 + random() * 0.38),
    );
    context.beginPath();
    context.ellipse(
      0,
      0,
      size * (1.05 + random() * 0.75),
      size * (0.3 + random() * 0.2),
      0,
      0,
      TAU,
    );
    context.fill();
    context.restore();
  }
}

function drawLegacyLine(context, segments, routeId, color, brightness) {
  context.save();
  context.lineCap = "round";
  context.lineWidth = 2.2;
  context.shadowColor = color;
  context.shadowBlur = 18;
  context.strokeStyle = rgba(color, brightness * 0.78);
  for (const segment of segments) {
    const from = segment.from;
    const to = segment.to;
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    const length = Math.hypot(deltaX, deltaY) || 1;
    const normalX = -deltaY / length;
    const normalY = deltaX / length;
    const bend =
      (hashText(`${routeId}:${segment.index}`) % 55 - 27) * 0.72;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.quadraticCurveTo(
      (from.x + to.x) * 0.5 + normalX * bend,
      (from.y + to.y) * 0.5 + normalY * bend,
      to.x,
      to.y,
    );
    context.stroke();
  }
  context.restore();
}

export function drawRouteLightFlow(
  context,
  {
    segments,
    routeId = "route",
    progress = 0,
    style = {},
  },
) {
  const settings = { ...DEFAULT_ROUTE_LIGHT_STYLE, ...style };
  const observedSegments = (segments || []).filter(
    (segment) => !segment.unobserved,
  );
  if (settings.mode === "legacy") {
    drawLegacyLine(
      context,
      observedSegments,
      routeId,
      settings.color,
      settings.brightness,
    );
    return;
  }

  const model = createRouteLightModel({
    segments,
    routeId,
    curveWander: settings.curveWander,
  });
  if (model.events.length === 0) return;
  if (settings.mode === "brush") {
    context.save();
    for (const segment of model.segments) {
      strokePathRange(context, segment.path, 0, 1, {
        width: 1.8 * settings.trailWidth,
        alpha: settings.brightness * 0.52,
        color: settings.color,
        breakup: settings.trailBreakup,
        seed: segment.path.seed,
      });
    }
    context.restore();
    return;
  }
  const globalProgress = clamp(progress);
  const scaledProgress = globalProgress * model.events.length;
  const lightCount = Math.max(
    3,
    Math.min(6, Math.round(settings.lightCount)),
  );
  const afterglowSegments = Math.max(
    0,
    Math.min(2, Math.round(settings.afterglowSegments)),
  );

  context.save();
  context.lineJoin = "round";
  context.shadowBlur = 0;
  for (let index = 0; index < model.events.length; index += 1) {
    const event = model.events[index];
    const local = scaledProgress - index;
    if (local < -0.02 || local > 1.22 + afterglowSegments) continue;
    if (event.kind === "fog") {
      if (local >= 0 && local <= 0.32) {
        drawTreeReaction(context, event.fromTree, local / 0.32, {
          seed: event.seed,
          color: settings.color,
          strength: settings.treeReaction * 0.58,
          arriving: false,
        });
      }
      if (local <= 0.54) {
        drawFogBoundaryMotes(context, {
          tree: event.fromTree,
          fog: event.entryFog,
          progress: clamp(local / 0.54),
          seed: event.seed,
          color: settings.color,
          brightness: settings.brightness,
          size: settings.lightSize * 1.55,
          dissolving: true,
        });
      }
      if (local >= 0.46) {
        drawFogBoundaryMotes(context, {
          tree: event.toTree,
          fog: event.exitFog,
          progress: clamp((local - 0.46) / 0.54),
          seed: event.seed ^ 0x27d4eb2d,
          color: settings.color,
          brightness: settings.brightness,
          size: settings.lightSize * 1.55,
          dissolving: false,
        });
      }
      if (local >= 0.68 && local <= 1.2) {
        drawTreeReaction(context, event.toTree, (local - 0.68) / 0.52, {
          seed: event.seed,
          color: settings.color,
          strength: settings.treeReaction * 0.66,
          arriving: true,
        });
      }
      continue;
    }
    const segment = event.segment;

    const flow = clamp(local / 0.72);
    const persistence = 0.18 + clamp(settings.trailPersistence) * 0.64;
    const trailStart = Math.max(0, flow - persistence);
    const hasTrail =
      settings.mode === "complete" ||
      settings.mode === "particles-trail";
    const hasReaction = settings.mode === "complete";

    if (hasReaction && local >= 0 && local <= 0.28) {
      drawTreeReaction(context, segment.path.fromCenter, local / 0.28, {
        seed: segment.path.seed,
        color: settings.color,
        strength: settings.treeReaction * 0.62,
        arriving: false,
      });
    }

    if (hasTrail && flow > 0) {
      const trailFade =
        local <= 0.86
          ? 1
          : clamp(
              1 -
                (local - 0.86) /
                  (0.34 + afterglowSegments),
            );
      if (settings.hazeStrength > 0) {
        context.save();
        context.globalCompositeOperation = "screen";
        context.shadowColor = rgba(
          settings.color,
          settings.brightness * settings.hazeStrength * 0.42,
        );
        context.shadowBlur = 18 * settings.hazeSize;
        strokePathRange(context, segment.path, trailStart, flow, {
          width:
            4.6 *
            settings.trailWidth *
            settings.hazeSize,
          alpha:
            settings.brightness *
            settings.hazeStrength *
            0.13 *
            trailFade,
          color: settings.color,
          breakup: Math.min(0.82, settings.trailBreakup + 0.22),
          seed: segment.path.seed ^ 0x9e3779b1,
          pieces: 18,
        });
        context.restore();
      }
      strokePathRange(context, segment.path, trailStart, flow, {
        width: 1.55 * settings.trailWidth,
        alpha: settings.brightness * 0.46 * trailFade,
        color: settings.color,
        breakup: settings.trailBreakup,
        seed: segment.path.seed ^ 0x165667b1,
      });
    }

    for (let lightIndex = 0; lightIndex < lightCount; lightIndex += 1) {
      const random = randomFrom(
        segment.path.seed ^ Math.imul(lightIndex + 1, 0x27d4eb2d),
      );
      const delay =
        lightIndex * (0.045 + random() * 0.015) + random() * 0.012;
      const lightProgress = clamp((local - delay) / 0.7);
      if (local < delay || lightProgress >= 1) continue;
      const emerge = segment.emergesFromFog
        ? clamp(lightProgress / 0.2)
        : 1;
      const dissolve = segment.dissolvesIntoFog
        ? clamp((1 - lightProgress) / 0.2)
        : 1;
      const scatter =
        (segment.emergesFromFog ? (1 - emerge) * 8 : 0) +
        (segment.dissolvesIntoFog ? (1 - dissolve) * 10 : 0);
      const baseOffset = (random() - 0.5) * 6;
      drawLightParticle(context, segment.path, lightProgress, {
        seed: segment.path.seed + lightIndex * 101,
        color: settings.color,
        size: settings.lightSize * (1.45 + random() * 1.05),
        alpha:
          settings.brightness *
          (0.62 + random() * 0.36) *
          (1 - lightIndex * 0.06) *
          emerge *
          dissolve,
        tailLength:
          settings.tailLength * (0.7 + random() * 0.62),
        offset: baseOffset + (random() - 0.5) * scatter,
        hazeStrength: settings.hazeStrength,
        hazeSize: settings.hazeSize,
      });
    }

    if (hasReaction && local >= 0.62 && local <= 1.18) {
      drawTreeReaction(
        context,
        segment.path.toCenter,
        (local - 0.62) / 0.56,
        {
          seed: segment.path.seed,
          color: settings.color,
          strength: settings.treeReaction,
          arriving: true,
        },
      );
    }
  }
  context.restore();
}
