const UINT32_MAX = 4_294_967_296;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function hashLattice(x, y, seed) {
  let value =
    Math.imul(x | 0, 0x1f123bb5) ^
    Math.imul(y | 0, 0x5f356495) ^
    Math.imul(seed | 0, 0x6c8e9cf5);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / UINT32_MAX * 2 - 1;
}

function valueNoise(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothstep(x - x0);
  const ty = smoothstep(y - y0);
  const top =
    hashLattice(x0, y0, seed) * (1 - tx) +
    hashLattice(x0 + 1, y0, seed) * tx;
  const bottom =
    hashLattice(x0, y0 + 1, seed) * (1 - tx) +
    hashLattice(x0 + 1, y0 + 1, seed) * tx;
  return top * (1 - ty) + bottom * ty;
}

export function createCurlNoise({
  seed = 411,
  scale = 0.0036,
  octaves = 3,
} = {}) {
  const safeScale = clamp(Number(scale) || 0.0036, 0.0001, 0.1);
  const safeOctaves = clamp(Math.trunc(octaves) || 3, 1, 5);

  function potential(x, y, timeSeconds) {
    let amplitude = 1;
    let frequency = 1;
    let total = 0;
    let normalization = 0;
    for (let octave = 0; octave < safeOctaves; octave += 1) {
      const drift = timeSeconds * (0.034 + octave * 0.011);
      total +=
        valueNoise(
          x * frequency + drift,
          y * frequency - drift * 0.63,
          seed + octave * 977,
        ) * amplitude;
      normalization += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return total / normalization;
  }

  return Object.freeze({
    sample(x, y, timeSeconds = 0) {
      const nx = x * safeScale;
      const ny = y * safeScale;
      const epsilon = 0.012;
      const dPotentialDy =
        (potential(nx, ny + epsilon, timeSeconds) -
          potential(nx, ny - epsilon, timeSeconds)) /
        (2 * epsilon);
      const dPotentialDx =
        (potential(nx + epsilon, ny, timeSeconds) -
          potential(nx - epsilon, ny, timeSeconds)) /
        (2 * epsilon);
      return Object.freeze({
        x: dPotentialDy * 0.72,
        y: -dPotentialDx * 0.72,
      });
    },
  });
}

function boundedVector(vector) {
  const x = Number(vector?.x) || 0;
  const y = Number(vector?.y) || 0;
  const magnitude = Math.hypot(x, y);
  if (magnitude <= 1) return { x, y };
  return { x: x / magnitude, y: y / magnitude };
}

function stableAngle(value) {
  const text = String(value ?? "tree");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / UINT32_MAX) * Math.PI * 2;
}

export function createTreeWindIndex({
  trees = [],
  cellSize = 180,
  maximumNearby = 12,
} = {}) {
  const safeCellSize = clamp(Number(cellSize) || 180, 60, 600);
  const safeMaximum = clamp(Math.trunc(maximumNearby) || 12, 1, 24);
  const cells = new Map();
  const normalizedTrees = [];
  for (const tree of trees) {
    const x = Number(tree?.x);
    const y = Number(tree?.y);
    const size = Math.max(0, Number(tree?.size) || 0);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const item = Object.freeze({
      x,
      y,
      size,
      seed: tree.seed ?? tree.nodeId ?? normalizedTrees.length,
    });
    normalizedTrees.push(item);
    const cellX = Math.floor(x / safeCellSize);
    const cellY = Math.floor(y / safeCellSize);
    const key = `${cellX}:${cellY}`;
    const cell = cells.get(key) || [];
    cell.push(item);
    cells.set(key, cell);
  }

  return Object.freeze({
    size: normalizedTrees.length,
    query(x, y, radius = safeCellSize) {
      const cellX = Math.floor((Number(x) || 0) / safeCellSize);
      const cellY = Math.floor((Number(y) || 0) / safeCellSize);
      const cellSpan = clamp(
        Math.ceil((Number(radius) || safeCellSize) / safeCellSize),
        1,
        3,
      );
      const candidates = [];
      for (let oy = -cellSpan; oy <= cellSpan; oy += 1) {
        for (let ox = -cellSpan; ox <= cellSpan; ox += 1) {
          candidates.push(...(cells.get(`${cellX + ox}:${cellY + oy}`) || []));
        }
      }
      candidates.sort(
        (left, right) =>
          Math.hypot(left.x - x, left.y - y) -
          Math.hypot(right.x - x, right.y - y),
      );
      return Object.freeze(candidates.slice(0, safeMaximum));
    },
  });
}

export function createWindField({
  seed = 411,
  scale = 0.0036,
  octaves = 3,
  timeScale = 1,
  maximum = 1,
  treeInfluence = 0.34,
  treeRadius = 92,
} = {}) {
  const curl = createCurlNoise({ seed, scale, octaves });
  const safeMaximum = clamp(Number(maximum) || 1, 0.1, 3);
  const safeTimeScale = clamp(Number(timeScale) || 1, 0, 8);
  const safeTreeInfluence = clamp(Number(treeInfluence) || 0, 0, 2);
  const safeTreeRadius = clamp(Number(treeRadius) || 92, 24, 360);

  return Object.freeze({
    sample(x, y, timeSeconds = 0, treeIndex = null) {
      const base = curl.sample(x, y, timeSeconds * safeTimeScale);
      let windX = base.x;
      let windY = base.y;
      const nearby =
        treeIndex && typeof treeIndex.query === "function"
          ? treeIndex.query(x, y, safeTreeRadius * 1.5)
          : [];
      for (const tree of nearby) {
        let dx = x - tree.x;
        let dy = y - tree.y;
        let distance = Math.hypot(dx, dy);
        if (distance < 0.001) {
          const angle = stableAngle(tree.seed);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }
        const growth = clamp(tree.size / 58, 0, 1);
        const radius = safeTreeRadius * (0.68 + growth * 0.82);
        if (distance >= radius) continue;
        const falloff = Math.pow(1 - distance / radius, 2);
        const strength =
          safeTreeInfluence * (0.35 + growth * 0.65) * falloff;
        const normalX = dx / distance;
        const normalY = dy / distance;
        const turn = Math.sin(stableAngle(tree.seed)) >= 0 ? 1 : -1;
        windX += -normalY * strength * turn + normalX * strength * 0.12;
        windY += normalX * strength * turn + normalY * strength * 0.12;
      }
      const magnitude = Math.hypot(windX, windY);
      if (magnitude > safeMaximum) {
        windX = (windX / magnitude) * safeMaximum;
        windY = (windY / magnitude) * safeMaximum;
      }
      return Object.freeze({ x: windX, y: windY });
    },
  });
}

export function combinePlaneForces({
  wind,
  control,
  windStrength = 26,
  controlStrength = 80,
}) {
  const boundedWind = boundedVector(wind);
  const boundedControl = boundedVector(control);
  const windForce = Object.freeze({
    x: boundedWind.x * clamp(windStrength, 0, 120),
    y: boundedWind.y * clamp(windStrength, 0, 120),
  });
  const controlForce = Object.freeze({
    x: boundedControl.x * clamp(controlStrength, 0, 160),
    y: boundedControl.y * clamp(controlStrength, 0, 160),
  });
  const totalForce = Object.freeze({
    x: windForce.x + controlForce.x,
    y: windForce.y + controlForce.y,
  });
  return Object.freeze({
    windForce,
    controlForce,
    totalForce,
  });
}

export function integratePlane(
  plane,
  force,
  deltaSeconds,
  { drag = 1.15, maxSpeed = 230 } = {},
) {
  const dt = clamp(Number(deltaSeconds) || 0, 0, 0.05);
  const damping = Math.exp(-clamp(drag, 0, 10) * dt);
  let vx = ((Number(plane?.vx) || 0) + (Number(force?.x) || 0) * dt) * damping;
  let vy = ((Number(plane?.vy) || 0) + (Number(force?.y) || 0) * dt) * damping;
  const speed = Math.hypot(vx, vy);
  const speedLimit = clamp(maxSpeed, 1, 1_000);
  if (speed > speedLimit) {
    vx = (vx / speed) * speedLimit;
    vy = (vy / speed) * speedLimit;
  }
  return Object.freeze({
    x: (Number(plane?.x) || 0) + vx * dt,
    y: (Number(plane?.y) || 0) + vy * dt,
    vx,
    vy,
  });
}

export function smoothPlaneHeading(
  currentAngle,
  velocity,
  deltaSeconds,
  { response = 5, minimumSpeed = 3 } = {},
) {
  const vx = Number(velocity?.x) || 0;
  const vy = Number(velocity?.y) || 0;
  if (Math.hypot(vx, vy) < Math.max(0, minimumSpeed)) {
    return Number(currentAngle) || 0;
  }
  const target = Math.atan2(vy, vx);
  const current = Number(currentAngle) || 0;
  let delta = (target - current + Math.PI) % (Math.PI * 2);
  if (delta < 0) delta += Math.PI * 2;
  delta -= Math.PI;
  const blend = 1 - Math.exp(-Math.max(0, response) * Math.max(0, deltaSeconds));
  return current + delta * blend;
}
