import { assetContract, visualStyle } from "./visual-style.js";

export const TREE_ART_VERSION = "brush-vein-v1";

const DISPLAY_MIN_SIZE = 2;
const DISPLAY_MAX_SIZE = 58;
const MODEL_CACHE_LIMIT = 2_048;
const modelCache = new Map();

const BRANCH_TEMPLATES = Object.freeze([
  Object.freeze([
    [0.34, -1, 0.72, 0.18, 0.12],
    [0.49, 1, 0.58, 0.2, 0.2],
    [0.63, -1, 0.5, 0.18, 0.34],
    [0.75, 1, 0.4, 0.15, 0.46],
  ]),
  Object.freeze([
    [0.3, 1, 0.66, 0.16, 0.12],
    [0.45, -1, 0.52, 0.21, 0.2],
    [0.6, 1, 0.55, 0.16, 0.34],
    [0.72, -1, 0.36, 0.18, 0.46],
  ]),
  Object.freeze([
    [0.36, -1, 0.54, 0.2, 0.12],
    [0.43, 1, 0.72, 0.15, 0.2],
    [0.61, -1, 0.42, 0.18, 0.34],
    [0.69, 1, 0.38, 0.17, 0.46],
  ]),
  Object.freeze([
    [0.31, 1, 0.5, 0.22, 0.12],
    [0.48, -1, 0.7, 0.15, 0.2],
    [0.57, 1, 0.43, 0.19, 0.34],
    [0.77, -1, 0.35, 0.13, 0.46],
  ]),
  Object.freeze([
    [0.33, -1, 0.62, 0.17, 0.12],
    [0.51, 1, 0.48, 0.21, 0.2],
    [0.58, -1, 0.38, 0.18, 0.34],
    [0.7, 1, 0.56, 0.13, 0.46],
  ]),
  Object.freeze([
    [0.28, 1, 0.58, 0.2, 0.12],
    [0.42, -1, 0.46, 0.18, 0.2],
    [0.66, 1, 0.68, 0.12, 0.34],
    [0.73, -1, 0.4, 0.16, 0.46],
  ]),
]);

const LEAF_TIERS = Object.freeze([
  0.28, 0.34, 0.4, 0.46, 0.52, 0.58, 0.64,
  0.7, 0.76, 0.82, 0.86, 0.9, 0.94, 0.97,
]);

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function hashTreeSeed(seed) {
  const value = String(seed ?? "tree");
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFrom(seed) {
  let value = seed || 1;
  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function cubicPoint(start, controlA, controlB, end, progress) {
  const inverse = 1 - progress;
  return {
    x:
      inverse ** 3 * start.x +
      3 * inverse ** 2 * progress * controlA.x +
      3 * inverse * progress ** 2 * controlB.x +
      progress ** 3 * end.x,
    y:
      inverse ** 3 * start.y +
      3 * inverse ** 2 * progress * controlA.y +
      3 * inverse * progress ** 2 * controlB.y +
      progress ** 3 * end.y,
  };
}

function curvePoint(curve, progress) {
  return cubicPoint(
    curve.start,
    curve.controlA,
    curve.controlB,
    curve.end,
    progress,
  );
}

function makeBranch(template, random, widthFactor) {
  const [baseAt, side, baseLength, baseLift, tier] = template;
  const at = clamp(baseAt + (random() - 0.5) * 0.055, 0.24, 0.82);
  const length = baseLength * (0.88 + random() * 0.24);
  const lift = baseLift * (0.84 + random() * 0.28);
  const start = { x: 0, y: -at };
  const end = {
    x: side * widthFactor * length,
    y: -at - lift - random() * 0.045,
  };
  return {
    tier,
    side,
    startAt: at,
    start,
    controlA: {
      x: side * widthFactor * length * (0.22 + random() * 0.08),
      y: start.y - lift * 0.2,
    },
    controlB: {
      x: side * widthFactor * length * (0.68 + random() * 0.12),
      y: end.y + lift * (0.2 + random() * 0.15),
    },
    end,
  };
}

function makeTwig(branch, index, random) {
  const start = curvePoint(branch, 0.52 + random() * 0.18);
  const direction = index % 2 === 0 ? -branch.side : branch.side;
  const reach = 0.08 + random() * 0.075;
  const lift = 0.06 + random() * 0.08;
  const end = {
    x: start.x + direction * reach,
    y: start.y - lift,
  };
  return {
    tier: 0.34 + index * 0.085,
    start,
    controlA: {
      x: start.x + direction * reach * 0.28,
      y: start.y - lift * 0.18,
    },
    controlB: {
      x: start.x + direction * reach * 0.75,
      y: end.y + lift * 0.22,
    },
    end,
  };
}

function leafAnchor(index, branches, twigs, trunk, random) {
  if (index === 0) return trunk.end;
  if (index <= branches.length) return branches[index - 1].end;
  if (index <= branches.length + twigs.length) {
    return twigs[index - branches.length - 1].end;
  }
  const branch = branches[index % branches.length];
  return curvePoint(branch, 0.62 + random() * 0.3);
}

function createUncachedTreeModel(seed) {
  const seedHash = hashTreeSeed(seed);
  const random = randomFrom(seedHash);
  const templateIndex = seedHash % BRANCH_TEMPLATES.length;
  const widthFactor = 0.42 + random() * 0.2;
  const lean = (random() - 0.5) * 0.19;
  const curve = lean * 0.55 + (random() - 0.5) * 0.22;
  const trunk = {
    start: { x: 0, y: 0 },
    controlA: { x: lean * 0.08, y: -0.3 },
    controlB: { x: curve, y: -0.72 },
    end: { x: lean, y: -1 },
  };
  const branches = BRANCH_TEMPLATES[templateIndex].map((template) => {
    const branch = makeBranch(template, random, widthFactor);
    branch.start = curvePoint(trunk, branch.startAt);
    return branch;
  });
  const twigs = Array.from({ length: 5 }, (_, index) =>
    makeTwig(branches[index % branches.length], index, random),
  );
  const leafDensity = 0.86 + random() * 0.26;
  const leafBias = (random() - 0.5) * widthFactor * 0.24;
  const leaves = LEAF_TIERS.map((tier, index) => {
    const anchor = leafAnchor(index, branches, twigs, trunk, random);
    const sizeClass = (index + templateIndex) % 3;
    const radius = [0.086, 0.116, 0.148][sizeClass];
    return {
      tier: clamp(tier + (1 - leafDensity) * 0.08, 0.24, 0.97),
      x: anchor.x + leafBias + (random() - 0.5) * widthFactor * 0.2,
      y: anchor.y + (random() - 0.5) * 0.11,
      radiusX: radius * (0.9 + random() * 0.28),
      radiusY: radius * (0.6 + random() * 0.18),
      hasSecondLobe: sizeClass === 2 || index % 5 === 0,
      angle:
        (random() - 0.5) * 1.15 +
        (anchor.x < 0 ? -0.14 : 0.14),
      alpha: 0.28 + random() * 0.1,
    };
  });

  return deepFreeze({
    seed: String(seed ?? "tree"),
    seedHash,
    templateIndex,
    widthFactor,
    lean,
    curve,
    leafBias,
    leafDensity,
    colorShift: Math.round((random() - 0.5) * 10),
    trunk,
    branches,
    twigs,
    leaves,
  });
}

export function createTreeModel(seed) {
  const key = String(seed ?? "tree");
  if (modelCache.has(key)) return modelCache.get(key);
  const model = createUncachedTreeModel(key);
  if (modelCache.size >= MODEL_CACHE_LIMIT) {
    modelCache.delete(modelCache.keys().next().value);
  }
  modelCache.set(key, model);
  return model;
}

export function clearTreeModelCache() {
  modelCache.clear();
}

export function treeModelCacheSize() {
  return modelCache.size;
}

export function treeGrowthFromDisplayTree({
  size = DISPLAY_MIN_SIZE,
  growth,
} = {}) {
  if (Number.isFinite(growth)) return clamp(growth, 0, 1);
  return clamp(
    (size - DISPLAY_MIN_SIZE) / (DISPLAY_MAX_SIZE - DISPLAY_MIN_SIZE),
    0,
    1,
  );
}

function revealAmount(growth, tier, duration = 0.12) {
  return clamp((growth - tier) / duration, 0, 1);
}

export function getTreeMetrics(
  modelOrSeed,
  { size = DISPLAY_MIN_SIZE, growth } = {},
) {
  const model =
    typeof modelOrSeed === "object" && modelOrSeed
      ? modelOrSeed
      : createTreeModel(modelOrSeed);
  const resolvedGrowth = treeGrowthFromDisplayTree({ size, growth });
  const height = clamp(12 + size * 1.55, 15, 102);
  const width =
    height * model.widthFactor * (0.58 + resolvedGrowth * 0.42);
  const visibleMajorBranches = model.branches.filter(
    (branch) => resolvedGrowth >= branch.tier,
  ).length;
  const visibleTwigs = model.twigs.filter(
    (twig) => resolvedGrowth >= twig.tier,
  ).length;
  const visibleLeafClusters = model.leaves.filter(
    (leaf) => resolvedGrowth >= leaf.tier,
  ).length;

  return Object.freeze({
    growth: resolvedGrowth,
    stage: Math.min(6, 1 + Math.floor(resolvedGrowth * 6)),
    height,
    width,
    trunkWidth:
      Math.max(1.5, 0.62 + size * 0.038) *
      (0.78 + resolvedGrowth * 0.22),
    visibleMajorBranches,
    visibleTwigs,
    visibleLeafClusters,
    commandBudget:
      1 + visibleMajorBranches + visibleTwigs + visibleLeafClusters,
  });
}

function parseHexColor(value) {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (!match) return [116, 169, 165];
  return [
    Number.parseInt(match[1].slice(0, 2), 16),
    Number.parseInt(match[1].slice(2, 4), 16),
    Number.parseInt(match[1].slice(4, 6), 16),
  ];
}

function shiftedRgba(hex, shift, alpha) {
  const [red, green, blue] = parseHexColor(hex);
  return `rgba(${clamp(red + shift, 0, 255)}, ${clamp(
    green + shift,
    0,
    255,
  )}, ${clamp(blue + shift, 0, 255)}, ${alpha})`;
}

function scalePoint(point, height) {
  return { x: point.x * height, y: point.y * height };
}

function drawRevealedCurve(context, curve, height, reveal) {
  const start = scalePoint(curve.start, height);
  const controlA = scalePoint(curve.controlA, height);
  const controlB = scalePoint(curve.controlB, height);
  const end = scalePoint(curve.end, height);
  const interpolate = (point) => ({
    x: start.x + (point.x - start.x) * reveal,
    y: start.y + (point.y - start.y) * reveal,
  });
  const visibleControlA = interpolate(controlA);
  const visibleControlB = interpolate(controlB);
  const visibleEnd = interpolate(end);
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.bezierCurveTo(
    visibleControlA.x,
    visibleControlA.y,
    visibleControlB.x,
    visibleControlB.y,
    visibleEnd.x,
    visibleEnd.y,
  );
  context.stroke();
}

export function drawTreeArt(
  context,
  {
    seed = "tree",
    model = createTreeModel(seed),
    x = 0,
    y = 0,
    size = DISPLAY_MIN_SIZE,
    growth,
    alpha = 1,
    palette = visualStyle.palette,
  } = {},
) {
  const metrics = getTreeMetrics(model, { size, growth });
  const resolvedGrowth = metrics.growth;
  const height = metrics.height;
  const colorShift = model.colorShift;

  context.save();
  context.translate(x, y);
  context.globalAlpha *= alpha;
  context.lineCap = "round";
  context.lineJoin = "round";

  context.strokeStyle = shiftedRgba(
    palette.mist,
    Math.round(colorShift * 0.4),
    0.5 + resolvedGrowth * 0.12,
  );
  context.lineWidth = metrics.trunkWidth;
  drawRevealedCurve(context, model.trunk, height, 1);

  context.strokeStyle = shiftedRgba(
    palette.leaf,
    colorShift,
    0.42 + resolvedGrowth * 0.1,
  );
  for (const branch of model.branches) {
    const reveal = revealAmount(resolvedGrowth, branch.tier);
    if (reveal <= 0) continue;
    context.lineWidth = Math.max(1.15, metrics.trunkWidth * 0.68);
    drawRevealedCurve(context, branch, height, reveal);
  }

  context.strokeStyle = shiftedRgba(
    palette.leaf,
    colorShift,
    0.36 + resolvedGrowth * 0.08,
  );
  for (const twig of model.twigs) {
    const reveal = revealAmount(resolvedGrowth, twig.tier, 0.1);
    if (reveal <= 0) continue;
    context.lineWidth = Math.max(0.9, metrics.trunkWidth * 0.46);
    drawRevealedCurve(context, twig, height, reveal);
  }

  for (const leaf of model.leaves) {
    const reveal = revealAmount(resolvedGrowth, leaf.tier, 0.09);
    if (reveal <= 0) continue;
    const spread = 0.72 + resolvedGrowth * 0.28;
    const radiusX = Math.max(3.8, leaf.radiusX * height * spread) * reveal;
    const radiusY = Math.max(2.6, leaf.radiusY * height * spread) * reveal;
    context.fillStyle = shiftedRgba(
      palette.leaf,
      colorShift,
      leaf.alpha * (0.62 + resolvedGrowth * 0.38) * reveal,
    );
    context.beginPath();
    context.ellipse(
      leaf.x * height,
      leaf.y * height,
      radiusX,
      radiusY,
      leaf.angle,
      0,
      Math.PI * 2,
    );
    if (leaf.hasSecondLobe) {
      context.ellipse(
        leaf.x * height + radiusX * 0.42,
        leaf.y * height - radiusY * 0.24,
        radiusX * 0.64,
        radiusY * 0.7,
        leaf.angle - 0.28,
        0,
        Math.PI * 2,
      );
    }
    context.fill();
  }

  context.restore();
  return metrics;
}

export function getTreeArtCacheKey({
  width = 0,
  height = 0,
  pixelRatio = 1,
  palette = visualStyle.palette,
  variant = "ink-vein",
  revision = 0,
} = {}) {
  return [
    TREE_ART_VERSION,
    assetContract.assets.tree.anchor,
    variant,
    palette.leaf,
    palette.mist,
    width,
    height,
    pixelRatio,
    revision,
  ].join("|");
}
