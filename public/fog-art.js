import { visualStyle } from "./visual-style.js";

export const FOG_ART_VERSION = "quiet-local-fog-v1";

const TAU = Math.PI * 2;
const DEFAULT_LAYER_COUNT = 3;
const DEFAULT_VOID_AMOUNT = 0.34;
const DEFAULT_MAX_CACHE_ENTRIES = 28;

function clamp(value, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function smoothstep(value) {
  const resolved = clamp(value);
  return resolved * resolved * (3 - 2 * resolved);
}

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFrom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function rgba(hex, alpha) {
  const value = hex.replace("#", "");
  const number = Number.parseInt(value, 16);
  return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${clamp(alpha)})`;
}

function freezePoints(points) {
  return Object.freeze(
    points.map((point) => Object.freeze({ ...point })),
  );
}

function createContour(random, layerIndex) {
  const pointCount = 10 + (layerIndex % 2) * 2;
  const points = [];
  const horizontalBias = (random() - 0.5) * 0.12;
  const verticalBias = (random() - 0.5) * 0.1;

  for (let index = 0; index < pointCount; index += 1) {
    const angle = (index / pointCount) * TAU;
    const alternating = index % 2 === 0 ? 1 : -1;
    const radius =
      0.82 +
      random() * 0.24 +
      alternating * (0.025 + random() * 0.035);
    points.push({
      x:
        Math.cos(angle) * radius +
        horizontalBias * Math.sin(angle * 2.3),
      y:
        Math.sin(angle) * radius +
        verticalBias * Math.cos(angle * 1.7),
    });
  }
  return freezePoints(points);
}

function createSpots(random, count, verticalRange) {
  return freezePoints(
    Array.from({ length: count }, () => ({
      x: (random() - 0.5) * 1.35,
      y: (random() - 0.5) * verticalRange,
      radiusX: 0.2 + random() * 0.24,
      radiusY: 0.2 + random() * 0.25,
      alpha: 0.52 + random() * 0.36,
    })),
  );
}

export function createFogModel({
  seed,
  hopCount = 1,
  layerCount = DEFAULT_LAYER_COUNT,
  voidAmount = DEFAULT_VOID_AMOUNT,
} = {}) {
  const resolvedSeed = String(seed ?? "route-forest-fog");
  const resolvedHops = Math.max(1, Math.round(hopCount));
  const resolvedLayers = Math.max(2, Math.min(4, Math.round(layerCount)));
  const resolvedVoid = clamp(voidAmount, 0.08, 0.72);
  const random = randomFrom(
    hashText(
      `${resolvedSeed}|${resolvedHops}|${resolvedLayers}|${resolvedVoid.toFixed(3)}`,
    ),
  );
  const layers = [];

  for (let index = 0; index < resolvedLayers; index += 1) {
    const rear = index / Math.max(1, resolvedLayers - 1);
    layers.push(
      Object.freeze({
        contour: createContour(random, index),
        spots: createSpots(random, 3 + (index % 2), 0.72),
        voids: createSpots(
          random,
          Math.max(2, Math.round(2 + resolvedVoid * 3)),
          0.62,
        ),
        widthScale: 1.04 - rear * 0.12 + (random() - 0.5) * 0.06,
        heightScale: 0.9 + rear * 0.12 + (random() - 0.5) * 0.08,
        driftX: (3.2 + random() * 4.8) * (index % 2 === 0 ? 1 : -1),
        driftY: 1.4 + random() * 2.8,
        rotation: (random() - 0.5) * 0.045,
        frequency: 0.00012 + random() * 0.0001,
        phase: random() * TAU,
        opacity: 0.62 + random() * 0.2,
        voidAmount: resolvedVoid * (0.78 + random() * 0.42),
      }),
    );
  }

  return Object.freeze({
    seed: resolvedSeed,
    hopCount: resolvedHops,
    layerCount: resolvedLayers,
    voidAmount: resolvedVoid,
    layers: Object.freeze(layers),
  });
}

export function fogDimensions({
  radius = 58,
  hopCount = 1,
  widthScale = 1,
  heightScale = 1,
} = {}) {
  const hops = Math.max(1, Math.min(8, Math.round(hopCount)));
  const resolvedRadius = Math.max(24, radius);
  return Object.freeze({
    width:
      resolvedRadius *
      (1.34 + Math.min(6, hops) * 0.064) *
      Math.max(0.45, widthScale),
    height:
      resolvedRadius *
      (0.72 + Math.min(6, hops) * 0.022) *
      Math.max(0.45, heightScale),
  });
}

export function fogLifecycle(
  now,
  {
    bornAt = 0,
    life = 8_000,
    appearMs,
    holdMs,
    fadeMs,
  } = {},
) {
  const resolvedLife = Math.max(1, life);
  const elapsed = clamp((now - bornAt) / resolvedLife);
  const explicitTiming =
    Number.isFinite(appearMs) &&
    Number.isFinite(holdMs) &&
    Number.isFinite(fadeMs);
  const appearRatio = explicitTiming
    ? clamp(appearMs / resolvedLife, 0.04, 0.46)
    : 0.18;
  const fadeRatio = explicitTiming
    ? clamp(fadeMs / resolvedLife, 0.08, 0.56)
    : 0.28;
  const fadeStart = Math.max(appearRatio, 1 - fadeRatio);
  const appearing = smoothstep(elapsed / appearRatio);
  const fading =
    1 - smoothstep((elapsed - fadeStart) / Math.max(0.001, 1 - fadeStart));
  return Object.freeze({
    progress: elapsed,
    presence: appearing * fading,
    appearing,
    fading,
    dissolve: smoothstep(
      (elapsed - fadeStart) / Math.max(0.001, 1 - fadeStart),
    ),
  });
}

function traceContour(context, points, radiusX, radiusY) {
  const scaled = points.map((point) => ({
    x: point.x * radiusX,
    y: point.y * radiusY,
  }));
  const first = scaled[0];
  const second = scaled[1];
  context.beginPath();
  context.moveTo(
    (first.x + second.x) / 2,
    (first.y + second.y) / 2,
  );
  for (let index = 1; index <= scaled.length; index += 1) {
    const point = scaled[index % scaled.length];
    const next = scaled[(index + 1) % scaled.length];
    context.quadraticCurveTo(
      point.x,
      point.y,
      (point.x + next.x) / 2,
      (point.y + next.y) / 2,
    );
  }
  context.closePath();
}

function fillSoftSpot(
  context,
  spot,
  width,
  height,
  centerColor,
  edgeColor,
) {
  const x = spot.x * width * 0.38;
  const y = spot.y * height * 0.42;
  const radiusX = Math.max(8, spot.radiusX * width);
  const radiusY = Math.max(7, spot.radiusY * height);
  context.save();
  context.translate(x, y);
  context.scale(radiusX, radiusY);
  const gradient = context.createRadialGradient(0, 0, 0.06, 0, 0, 1);
  gradient.addColorStop(0, centerColor);
  gradient.addColorStop(0.52, edgeColor);
  gradient.addColorStop(1, "rgba(116, 169, 165, 0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, 1, 0, TAU);
  context.fill();
  context.restore();
}

function renderLayerTexture({
  createCanvas,
  model,
  layer,
  layerIndex,
  width,
  height,
  pixelRatio,
  palette,
}) {
  const padding = Math.ceil(Math.max(width, height) * 0.24);
  const logicalWidth = Math.ceil(width + padding * 2);
  const logicalHeight = Math.ceil(height + padding * 2);
  const canvas = createCanvas();
  canvas.width = Math.max(1, Math.ceil(logicalWidth * pixelRatio));
  canvas.height = Math.max(1, Math.ceil(logicalHeight * pixelRatio));
  const context = canvas.getContext("2d", { alpha: true });
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, logicalWidth, logicalHeight);
  context.save();
  context.translate(logicalWidth / 2, logicalHeight / 2);

  const radiusX = width * 0.46 * layer.widthScale;
  const radiusY = height * 0.46 * layer.heightScale;
  traceContour(context, layer.contour, radiusX, radiusY);
  context.filter = `blur(${Math.max(4, height * 0.055)}px)`;
  context.fillStyle = rgba(
    palette.mist,
    0.16 + layerIndex * 0.018,
  );
  context.fill();
  context.filter = "none";

  traceContour(context, layer.contour, radiusX, radiusY);
  context.clip();
  const wash = context.createLinearGradient(
    -width / 2,
    -height / 3,
    width / 2,
    height / 3,
  );
  wash.addColorStop(0, rgba(palette.leaf, 0.08));
  wash.addColorStop(0.48, rgba(palette.mist, 0.19));
  wash.addColorStop(1, rgba(palette.nightLift, 0.06));
  context.fillStyle = wash;
  context.fillRect(-logicalWidth / 2, -logicalHeight / 2, logicalWidth, logicalHeight);

  for (const spot of layer.spots) {
    fillSoftSpot(
      context,
      spot,
      width,
      height,
      rgba(palette.mist, 0.32 * spot.alpha),
      rgba(palette.leaf, 0.13 * spot.alpha),
    );
  }

  context.globalCompositeOperation = "destination-out";
  for (const gap of layer.voids) {
    fillSoftSpot(
      context,
      gap,
      width,
      height,
      rgba("#000000", layer.voidAmount * gap.alpha),
      rgba("#000000", layer.voidAmount * gap.alpha * 0.36),
    );
  }
  context.restore();

  return Object.freeze({
    canvas,
    logicalWidth,
    logicalHeight,
  });
}

function drawWarmDiffusion(
  context,
  warmPoint,
  opacity,
  palette,
) {
  if (!warmPoint || warmPoint.amount <= 0) return;
  const amount = clamp(warmPoint.amount);
  const radius = 18 + amount * 16;
  context.save();
  context.globalAlpha *= opacity * (0.11 + amount * 0.1);
  context.globalCompositeOperation = "lighter";
  context.translate(warmPoint.x, warmPoint.y);
  context.scale(1.45, 0.72);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, rgba(palette.seed, 0.48));
  gradient.addColorStop(0.38, rgba(palette.seed, 0.18));
  gradient.addColorStop(1, rgba(palette.seed, 0));
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, radius, 0, TAU);
  context.fill();
  context.restore();
}

export function createFogRenderer({
  createCanvas,
  palette = visualStyle.palette,
  maxCacheEntries = DEFAULT_MAX_CACHE_ENTRIES,
} = {}) {
  if (typeof createCanvas !== "function") {
    throw new TypeError("createFogRenderer requires createCanvas");
  }
  const cache = new Map();

  function texturesFor({
    seed,
    hopCount,
    layerCount,
    voidAmount,
    width,
    height,
    pixelRatio,
  }) {
    const key = [
      seed,
      hopCount,
      layerCount,
      voidAmount.toFixed(3),
      Math.round(width),
      Math.round(height),
      pixelRatio.toFixed(2),
      FOG_ART_VERSION,
    ].join("|");
    if (cache.has(key)) {
      const entry = cache.get(key);
      cache.delete(key);
      cache.set(key, entry);
      return entry;
    }

    const model = createFogModel({
      seed,
      hopCount,
      layerCount,
      voidAmount,
    });
    const textures = model.layers.map((layer, layerIndex) =>
      renderLayerTexture({
        createCanvas,
        model,
        layer,
        layerIndex,
        width,
        height,
        pixelRatio,
        palette,
      }),
    );
    const entry = Object.freeze({ key, model, textures: Object.freeze(textures) });
    cache.set(key, entry);
    while (cache.size > Math.max(4, maxCacheEntries)) {
      cache.delete(cache.keys().next().value);
    }
    return entry;
  }

  function draw(
    context,
    {
      fog,
      now,
      pass = "all",
      pixelRatio = 1,
      widthScale = 1,
      heightScale = 1,
      opacity,
      layerCount,
      voidAmount,
      speed = 1,
      crowdAlpha = 1,
      warmPoint = null,
      timing,
    },
  ) {
    const resolvedHops = Math.max(1, Math.round(fog.hopCount ?? 1));
    const resolvedLayers = Math.max(
      2,
      Math.min(4, Math.round(layerCount ?? fog.layerCount ?? DEFAULT_LAYER_COUNT)),
    );
    const resolvedVoid = clamp(
      voidAmount ?? fog.voidAmount ?? DEFAULT_VOID_AMOUNT,
      0.08,
      0.72,
    );
    const dimensions = fogDimensions({
      radius: fog.radius,
      hopCount: resolvedHops,
      widthScale: widthScale * (fog.widthScale ?? 1),
      heightScale: heightScale * (fog.heightScale ?? 1),
    });
    const seed = String(
      fog.seed ??
        `${fog.x.toFixed(2)}:${fog.y.toFixed(2)}:${resolvedHops}:${fog.phase ?? 0}`,
    );
    const entry = texturesFor({
      seed,
      hopCount: resolvedHops,
      layerCount: resolvedLayers,
      voidAmount: resolvedVoid,
      width: dimensions.width,
      height: dimensions.height,
      pixelRatio: clamp(pixelRatio, 1, 2),
    });
    const lifecycle = fogLifecycle(now, {
      bornAt: fog.bornAt,
      life: fog.life,
      ...timing,
    });
    const resolvedOpacity = clamp(opacity ?? fog.opacity ?? 0.46, 0, 0.72);
    const resolvedSpeed = Math.max(0, speed);

    if ((pass === "front" || pass === "all") && warmPoint) {
      drawWarmDiffusion(
        context,
        warmPoint,
        lifecycle.presence * resolvedOpacity,
        palette,
      );
    }

    for (let index = 0; index < entry.model.layers.length; index += 1) {
      const isFront = index === entry.model.layers.length - 1;
      if (pass === "front" && !isFront) continue;
      if (pass === "back" && isFront) continue;
      const layer = entry.model.layers[index];
      const texture = entry.textures[index];
      const layerDelay = index * 0.025;
      const appeared = smoothstep(
        (lifecycle.progress - layerDelay) / Math.max(0.05, 0.18 - layerDelay),
      );
      const frontFadeLead = isFront ? 0.055 : index === 0 ? -0.02 : 0;
      const fadeStart = 0.72 - frontFadeLead;
      const layerFade =
        1 -
        smoothstep(
          (lifecycle.progress - fadeStart) /
            Math.max(0.05, 1 - fadeStart),
        );
      const layerPresence = appeared * layerFade;
      if (layerPresence <= 0.002) continue;

      const motion = now * layer.frequency * resolvedSpeed + layer.phase;
      const x = fog.x + Math.sin(motion) * layer.driftX;
      const y =
        fog.y +
        Math.cos(motion * 0.83 + layer.phase) * layer.driftY;
      const dissolveDrift =
        lifecycle.dissolve * (index - (entry.model.layers.length - 1) / 2) * 8;
      const scale =
        (0.82 + appeared * 0.18) *
        (1 - lifecycle.dissolve * (0.025 + index * 0.01));

      context.save();
      context.translate(x + dissolveDrift, y);
      context.rotate(layer.rotation + Math.sin(motion * 0.7) * 0.012);
      context.scale(scale, scale * (1 - lifecycle.dissolve * 0.035));
      context.globalAlpha *=
        resolvedOpacity *
        clamp(crowdAlpha, 0.55, 1) *
        layer.opacity *
        layerPresence;
      context.drawImage(
        texture.canvas,
        -texture.logicalWidth / 2,
        -texture.logicalHeight / 2,
        texture.logicalWidth,
        texture.logicalHeight,
      );
      context.restore();
    }

    return Object.freeze({
      cacheKey: entry.key,
      lifecycle,
      width: dimensions.width,
      height: dimensions.height,
      layerCount: resolvedLayers,
    });
  }

  return Object.freeze({
    draw,
    clear: () => cache.clear(),
    cacheSize: () => cache.size,
  });
}

export function drawLegacyFogArt(
  context,
  {
    x,
    y,
    radius = 70,
    time = 0,
    opacity = 0.3,
  },
) {
  context.save();
  context.globalAlpha *= opacity;
  for (let index = 0; index < 4; index += 1) {
    const phase = time * 0.0002 + index * 1.6;
    const ox = Math.sin(phase) * radius * 0.22;
    const oy = Math.cos(phase) * radius * 0.08;
    const gradient = context.createRadialGradient(
      x + ox,
      y + oy,
      2,
      x + ox,
      y + oy,
      radius,
    );
    gradient.addColorStop(0, visualStyle.palette.mist);
    gradient.addColorStop(1, "rgba(157, 187, 192, 0)");
    context.fillStyle = gradient;
    context.fillRect(
      x - radius * 1.4,
      y - radius * 0.8,
      radius * 2.8,
      radius * 1.6,
    );
  }
  context.restore();
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
