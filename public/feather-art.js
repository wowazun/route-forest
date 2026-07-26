const TAU = Math.PI * 2;

function clamp(value, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function smoothstep(value) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

function stableNumber(value) {
  const text = String(value ?? "feather");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function cubicPoint(points, t) {
  const inverse = 1 - t;
  const a = inverse * inverse * inverse;
  const b = 3 * inverse * inverse * t;
  const c = 3 * inverse * t * t;
  const d = t * t * t;
  return {
    x:
      points[0].x * a +
      points[1].x * b +
      points[2].x * c +
      points[3].x * d,
    y:
      points[0].y * a +
      points[1].y * b +
      points[2].y * c +
      points[3].y * d,
  };
}

function cubicTangent(points, t) {
  const inverse = 1 - t;
  const x =
    3 * inverse * inverse * (points[1].x - points[0].x) +
    6 * inverse * t * (points[2].x - points[1].x) +
    3 * t * t * (points[3].x - points[2].x);
  const y =
    3 * inverse * inverse * (points[1].y - points[0].y) +
    6 * inverse * t * (points[2].y - points[1].y) +
    3 * t * t * (points[3].y - points[2].y);
  const magnitude = Math.hypot(x, y) || 1;
  return { x: x / magnitude, y: y / magnitude };
}

export const DEFAULT_FEATHER_ART = Object.freeze({
  length: 32,
  width: 11,
  curve: 0.46,
  barbsPerSide: 15,
  rootTaper: 0.74,
  shaftWidth: 1.15,
  barbWidth: 0.68,
  sway: 34,
  fallDistance: 148,
  swayCycles: 2.15,
  rotation: 0.58,
});

export function createFeatherGeometry({
  length = DEFAULT_FEATHER_ART.length,
  width = DEFAULT_FEATHER_ART.width,
  curve = DEFAULT_FEATHER_ART.curve,
  barbsPerSide = DEFAULT_FEATHER_ART.barbsPerSide,
  rootTaper = DEFAULT_FEATHER_ART.rootTaper,
  seed = "feather",
} = {}) {
  const safeLength = clamp(length, 12, 90);
  const safeWidth = clamp(width, 4, 28);
  const safeCurve = clamp(curve, -1, 1);
  const safeBarbCount = Math.round(clamp(barbsPerSide, 6, 28));
  const safeRootTaper = clamp(rootTaper);
  const seedValue = stableNumber(seed);
  const bend = safeWidth * safeCurve;
  const shaft = Object.freeze([
    Object.freeze({ x: 0, y: safeLength * 0.52 }),
    Object.freeze({ x: bend * 0.2, y: safeLength * 0.2 }),
    Object.freeze({ x: bend * 1.05, y: -safeLength * 0.2 }),
    Object.freeze({ x: bend * 0.38, y: -safeLength * 0.52 }),
  ]);
  const barbs = [];

  for (const side of [-1, 1]) {
    for (let index = 0; index < safeBarbCount; index += 1) {
      const ratio = safeBarbCount <= 1 ? 0.5 : index / (safeBarbCount - 1);
      const spacingWave =
        Math.sin((index + 2) * 7.317 + seedValue * 0.00011 + side * 2.4) *
        0.006;
      const t = clamp(0.055 + ratio * 0.89 + spacingWave, 0.05, 0.95);
      const point = cubicPoint(shaft, t);
      const tangent = cubicTangent(shaft, t);
      const normal = { x: -tangent.y * side, y: tangent.x * side };
      const wave =
        Math.sin((index + 1) * 12.9898 + seedValue * 0.00017 + side * 1.7) *
        0.5;
      const rootProfile =
        1 - safeRootTaper + safeRootTaper * smoothstep((t - 0.035) / 0.5);
      const tipProfile = Math.pow(
        Math.sin(clamp((t - 0.025) / 0.95) * Math.PI),
        0.42,
      );
      const barbLength =
        safeWidth *
        rootProfile *
        tipProfile *
        (0.9 + wave * 0.18) *
        ((index + (side < 0 ? 2 : 0)) % 6 === 0 ? 0.76 : 1) *
        (side < 0 ? 0.9 : 1);
      const forward =
        safeLength *
        (0.07 + t * 0.04 + wave * 0.008) *
        (side < 0 ? 0.94 : 1.05);
      const end = Object.freeze({
        x: point.x + normal.x * barbLength + tangent.x * forward,
        y: point.y + normal.y * barbLength + tangent.y * forward,
      });
      const control = Object.freeze({
        x:
          point.x +
          normal.x * barbLength * (0.52 + wave * 0.08) +
          tangent.x * forward * 0.14,
        y:
          point.y +
          normal.y * barbLength * (0.52 + wave * 0.08) +
          tangent.y * forward * 0.14,
      });
      barbs.push(
        Object.freeze({
          side,
          t,
          length: barbLength,
          start: Object.freeze(point),
          control,
          end,
          alpha: 0.48 + tipProfile * 0.34,
        }),
      );
    }
  }

  return Object.freeze({
    shaft,
    barbs: Object.freeze(barbs),
    length: safeLength,
    width: safeWidth,
  });
}

export function featherPoseAt(
  progressValue,
  phase = 0,
  {
    sway = DEFAULT_FEATHER_ART.sway,
    fallDistance = DEFAULT_FEATHER_ART.fallDistance,
    swayCycles = DEFAULT_FEATHER_ART.swayCycles,
    rotation = DEFAULT_FEATHER_ART.rotation,
  } = {},
) {
  const progress = clamp(progressValue);
  const envelope = Math.pow(Math.sin(progress * Math.PI), 0.38);
  const wave = progress * Math.max(0, swayCycles) * TAU + Number(phase || 0);
  return Object.freeze({
    x: Math.sin(wave) * Math.max(0, sway) * envelope,
    y:
      Math.max(0, fallDistance) *
      (progress * 0.72 + progress * progress * 0.28),
    angle:
      Math.sin(wave + 0.34) * Math.max(0, rotation) * envelope +
      Math.cos(wave * 0.5) * 0.07,
    alpha: Math.pow(Math.sin(progress * Math.PI), 0.62),
  });
}

export function drawFeatherArt(
  context,
  {
    x = 0,
    y = 0,
    angle = 0,
    scale = 1,
    alpha = 1,
    color = "#e7eef0",
    glowColor = "#d5a24b",
    glow = 0.12,
    seed = "feather",
    length = DEFAULT_FEATHER_ART.length,
    width = DEFAULT_FEATHER_ART.width,
    curve = DEFAULT_FEATHER_ART.curve,
    barbsPerSide = DEFAULT_FEATHER_ART.barbsPerSide,
    rootTaper = DEFAULT_FEATHER_ART.rootTaper,
    shaftWidth = DEFAULT_FEATHER_ART.shaftWidth,
    barbWidth = DEFAULT_FEATHER_ART.barbWidth,
  } = {},
) {
  const geometry = createFeatherGeometry({
    length,
    width,
    curve,
    barbsPerSide,
    rootTaper,
    seed,
  });
  const safeScale = clamp(scale, 0.25, 5);
  const safeAlpha = clamp(alpha);
  if (safeAlpha <= 0) return geometry;

  context.save();
  context.translate(Number(x) || 0, Number(y) || 0);
  context.rotate(Number(angle) || 0);
  context.scale(safeScale, safeScale);
  const inheritedAlpha = context.globalAlpha;
  context.globalAlpha = inheritedAlpha * safeAlpha;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (glow > 0) {
    context.shadowColor = glowColor;
    context.shadowBlur = clamp(glow, 0, 1) * 7;
  }

  context.strokeStyle = color;
  context.lineWidth = clamp(barbWidth, 0.35, 2);
  for (const barb of geometry.barbs) {
    context.globalAlpha = inheritedAlpha * safeAlpha * barb.alpha;
    context.beginPath();
    context.moveTo(barb.start.x, barb.start.y);
    context.quadraticCurveTo(
      barb.control.x,
      barb.control.y,
      barb.end.x,
      barb.end.y,
    );
    context.stroke();
  }

  const shaft = geometry.shaft;
  context.globalAlpha = inheritedAlpha * safeAlpha * 0.9;
  context.lineWidth = clamp(shaftWidth, 0.65, 2.8);
  context.beginPath();
  context.moveTo(shaft[0].x, shaft[0].y);
  context.bezierCurveTo(
    shaft[1].x,
    shaft[1].y,
    shaft[2].x,
    shaft[2].y,
    shaft[3].x,
    shaft[3].y,
  );
  context.stroke();
  context.restore();
  return geometry;
}
