function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
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

export function routeHighlightSegments(points, plane = null) {
  const segments = [...visibleRouteSegments(points)];
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
  return force || Math.abs(Number(routeHash) || 0) % 4 === 0;
}
