function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function arcPoint(from, to, local, arcHeight) {
  return {
    x: from.x + (to.x - from.x) * local,
    y:
      from.y +
      (to.y - from.y) * local -
      Math.sin(local * Math.PI) * arcHeight,
  };
}

export function createArcLengthPath(points, samplesPerSegment = 16) {
  const sampleCount = Math.max(
    4,
    Math.min(64, Math.floor(Number(samplesPerSegment) || 16)),
  );
  const segments = [];
  let totalLength = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const arcHeight = Math.min(42, Math.abs(to.x - from.x) * 0.12);
    const samples = [{ local: 0, distance: 0 }];
    let previous = arcPoint(from, to, 0, arcHeight);
    let segmentLength = 0;

    for (let sampleIndex = 1; sampleIndex <= sampleCount; sampleIndex += 1) {
      const local = sampleIndex / sampleCount;
      const point = arcPoint(from, to, local, arcHeight);
      segmentLength += Math.hypot(
        point.x - previous.x,
        point.y - previous.y,
      );
      samples.push({ local, distance: segmentLength });
      previous = point;
    }

    segments.push(
      Object.freeze({
        index,
        from,
        to,
        arcHeight,
        startDistance: totalLength,
        length: segmentLength,
        samples: Object.freeze(
          samples.map((sample) => Object.freeze(sample)),
        ),
      }),
    );
    totalLength += segmentLength;
  }

  return Object.freeze({
    points: Object.freeze([...points]),
    segments: Object.freeze(segments),
    totalLength,
  });
}

export function sampleArcLengthPath(path, distance) {
  const segments = path?.segments || [];
  if (segments.length === 0) {
    const point = path?.points?.[0] || { x: 0, y: 0 };
    return Object.freeze({
      x: point.x,
      y: point.y,
      angle: 0,
      local: 0,
      segmentIndex: 0,
      pathPosition: 0,
    });
  }

  const targetDistance = Math.max(
    0,
    Math.min(path.totalLength, Number(distance) || 0),
  );
  const segment =
    segments.find(
      (candidate) =>
        targetDistance <= candidate.startDistance + candidate.length,
    ) || segments.at(-1);
  const localDistance = Math.max(
    0,
    targetDistance - segment.startDistance,
  );
  let local = 1;

  for (let index = 1; index < segment.samples.length; index += 1) {
    const current = segment.samples[index];
    if (localDistance > current.distance) continue;
    const previous = segment.samples[index - 1];
    const span = current.distance - previous.distance || 1;
    const ratio = (localDistance - previous.distance) / span;
    local =
      previous.local + (current.local - previous.local) * ratio;
    break;
  }

  const point = arcPoint(segment.from, segment.to, local, segment.arcHeight);
  const tangentX = segment.to.x - segment.from.x;
  const tangentY =
    segment.to.y -
    segment.from.y -
    Math.cos(local * Math.PI) * Math.PI * segment.arcHeight;
  return Object.freeze({
    ...point,
    angle:
      Math.abs(tangentX) + Math.abs(tangentY) > 0.001
        ? Math.atan2(tangentY, tangentX)
        : 0,
    local,
    segmentIndex: segment.index,
    pathPosition: segment.index + local,
  });
}

export function lifecycleProgress(now, bornAt, life) {
  if (!Number.isFinite(life) || life <= 0) return 1;
  return clamp01((now - bornAt) / life);
}

export function letterTransform(progressValue) {
  const progress = clamp01(progressValue);
  const fold = clamp01((progress - 0.34) / 0.66);
  const letterPoints = [
    { x: -10, y: -7 },
    { x: 10, y: -7 },
    { x: 10, y: 7 },
    { x: -10, y: 7 },
  ];
  const planePoints = [
    { x: -13, y: -7 },
    { x: 16, y: 0 },
    { x: -11, y: 9 },
    { x: -4, y: 1 },
  ];
  const points = letterPoints.map((point, index) =>
    Object.freeze({
      x: point.x + (planePoints[index].x - point.x) * fold,
      y: point.y + (planePoints[index].y - point.y) * fold,
    }),
  );

  return Object.freeze({
    fold,
    yOffset: progress * 22,
    angle: progress * 0.28,
    points: Object.freeze(points),
  });
}

export function visibleRouteSegments(points) {
  const segments = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (from?.source?.kind === "fog" || to?.source?.kind === "fog") continue;
    segments.push(Object.freeze({ from, to, index }));
  }
  return Object.freeze(segments);
}

export function travelRouteSegments(points) {
  const segments = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    segments.push(
      Object.freeze({
        from,
        to,
        index,
        unobserved:
          from?.source?.kind === "fog" || to?.source?.kind === "fog",
      }),
    );
  }
  return Object.freeze(segments);
}

export function routeHighlightSegments(points, plane = null) {
  const segments = [...travelRouteSegments(points)];
  const endpoint = points.at(-1);
  if (
    !endpoint ||
    endpoint.source?.kind === "fog" ||
    !Number.isFinite(plane?.x) ||
    !Number.isFinite(plane?.y)
  ) {
    return Object.freeze(segments);
  }
  segments.push(
    Object.freeze({
      from: endpoint,
      to: Object.freeze({
        x: plane.x,
        y: plane.y,
        source: Object.freeze({ kind: "plane" }),
      }),
      index: Math.max(0, points.length - 1),
      unobserved: false,
    }),
  );
  return Object.freeze(segments);
}

export function shouldRevealFog(
  pathPosition,
  fogIndex,
  leadSegments = 1.25,
) {
  const position = Math.max(0, Number(pathPosition) || 0);
  const index = Math.max(0, Number(fogIndex) || 0);
  const lead = Math.max(0, Number(leadSegments) || 0);
  return position >= Math.max(0, index - lead);
}

export function shouldReleaseFeather(routeHash, force = false) {
  return force || Math.abs(Number(routeHash) || 0) % 2 === 0;
}

export function treeFieldSpread(treeCount) {
  const count = Math.max(0, Number(treeCount) || 0);
  return Math.min(1, Math.sqrt((count + 1) / 64));
}
