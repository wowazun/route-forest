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
