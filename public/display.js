import { createBirdSequence } from "./experience-contract.js";
import {
  createArcLengthPath,
  lifecycleProgress,
  routeHighlightSegments,
  sampleArcLengthPath,
  shouldReleaseFeather,
  shouldRevealFog,
  treeFieldSpread,
  visibleRouteSegments,
} from "./exhibition-effects.js?v=3";
import {
  createFogTexture,
  drawFog,
  drawMessage,
  drawPaperPlane,
  drawPlaneWind,
  drawRouteHighlight,
  drawRoutePath,
  drawTree,
  getTreeArtCacheKey,
} from "./display-art.js";
import {
  birdWorldAnchor,
  smoothBirdHeading,
} from "./bird-art.js";
import {
  messagePoseAt,
  messageStateAt,
} from "./message-art.js";
import {
  combinePlaneForces,
  createTreeWindIndex,
  createWindField,
  integratePlane,
} from "./flow-field.js";
import {
  DEFAULT_FEATHER_ART,
  drawFeatherArt,
  featherPoseAt,
} from "./feather-art.js?v=2";
import { createSimulation } from "./simulator-scenarios.js";
import { visualStyle } from "./visual-style.js";

const canvas = document.querySelector("#forest-canvas");
const context = canvas.getContext("2d", { alpha: true });
const treeLayerCanvas = document.createElement("canvas");
const treeLayerContext = treeLayerCanvas.getContext("2d", { alpha: true });
const connectionState = document.querySelector("#connection-state");
const connectionLight = document.querySelector("#connection-light");
const destinationState = document.querySelector("#destination-state");
const treeCount = document.querySelector("#tree-count");
const routeCount = document.querySelector("#route-count");
const emptyMessage = document.querySelector("#empty-message");
const exhibition = document.querySelector(".exhibition");
const performanceMonitor = document.querySelector("#performance-monitor");
const performanceStatus = document.querySelector("#performance-status");
const performanceFps = document.querySelector("#performance-fps");
const performanceP95 = document.querySelector("#performance-p95");
const performanceMax = document.querySelector("#performance-max");
const performanceLongTasks = document.querySelector(
  "#performance-long-tasks",
);
const performancePulse = document.querySelector("#performance-pulse");
const performanceProfile = document.querySelector("#performance-profile");

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
const searchParameters = new URLSearchParams(window.location.search);
const isDemo = searchParameters.has("demo");
const isPerformance = searchParameters.has("performance");
const simulationScenario = searchParameters.get("simulation");
const isSimulation = Boolean(simulationScenario);
const palette = visualStyle.palette;
const planePhysics = visualStyle.physics.plane;
const windField = createWindField(visualStyle.physics.wind);

const fogTexture = createFogTexture(
  document.createElement("canvas"),
  randomFrom(9041),
);

const state = {
  width: 0,
  height: 0,
  pixelRatio: 1,
  trees: new Map(),
  seenMeasurements: new Set(),
  routesSeen: 0,
  pendingFlights: [],
  flights: [],
  fogs: [],
  seeds: [],
  feathers: [],
  letters: [],
  highlights: [],
  planes: [],
  motes: [],
  lastFrame: performance.now(),
  lastDiagnosticsAt: 0,
  performance: null,
  treeLayerDirty: true,
  treeLayerCacheKey: "",
  birdVisuals: new Map(),
  planeControls: new Map(),
  endedControllers: new Set(),
  routeRegistry: new Map(),
  windIndex: createTreeWindIndex(),
  windIndexDirty: true,
  lastWindIndexAt: 0,
};

function clampedParameter(name, fallback, minimum, maximum) {
  const value = Number.parseInt(searchParameters.get(name), 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.min(maximum, value));
}

const performanceLoad = Object.freeze({
  trees: clampedParameter("trees", 220, 20, 800),
  birds: clampedParameter("birds", 8, 1, 24),
  fogs: clampedParameter("fogs", 12, 0, 30),
  planes: clampedParameter("planes", 32, 0, 120),
});

function hashText(value) {
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

function chooseTreePosition(nodeId) {
  const random = randomFrom(hashText(nodeId));
  const existing = [...state.trees.values()];
  const targetSpread = treeFieldSpread(existing.length);
  const centerX = 0.5;
  const centerY = 0.54;
  const radiusX = 0.46;
  const radiusY = 0.4;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const baseAngle =
    existing.length * goldenAngle + (random() - 0.5) * 0.52;
  const spacingScale = Math.max(0.7, 1 - existing.length / 720);
  const spacingX = 76 * spacingScale;
  const spacingY = 92 * spacingScale;
  let best = null;
  let bestClearance = -Infinity;

  const clearanceAt = (nx, ny) => {
    if (existing.length === 0) return Infinity;
    return existing.reduce((minimum, tree) => {
      const dx = ((tree.nx - nx) * state.width) / spacingX;
      const dy = ((tree.ny - ny) * state.height) / spacingY;
      return Math.min(minimum, Math.hypot(dx, dy));
    }, Infinity);
  };

  for (let expansion = 0; expansion < 8; expansion += 1) {
    const spread = Math.min(1, targetSpread + expansion * 0.1);
    for (let attempt = 0; attempt < 48; attempt += 1) {
      const angle =
        baseAngle + attempt * goldenAngle + (random() - 0.5) * 0.18;
      const radialBias =
        attempt === 0
          ? spread
          : spread * Math.sqrt(0.28 + random() * 0.72);
      const nx = Math.max(
        0.04,
        Math.min(0.96, centerX + Math.cos(angle) * radiusX * radialBias),
      );
      const ny = Math.max(
        0.12,
        Math.min(0.94, centerY + Math.sin(angle) * radiusY * radialBias),
      );
      const clearance = clearanceAt(nx, ny);
      if (clearance > bestClearance) {
        best = { nx, ny };
        bestClearance = clearance;
      }
      if (clearance >= 1) return { nx, ny };
    }
  }

  return best || { nx: centerX, ny: centerY };
}

function ensureTree(node) {
  let tree = state.trees.get(node.nodeId);
  if (tree) return tree;
  const position = chooseTreePosition(node.nodeId);
  const seed = hashText(node.nodeId);
  tree = {
    nodeId: node.nodeId,
    ...position,
    count: 0,
    size: 2,
    targetSize: 2,
    sway: (seed % 1000) / 1000,
    variant: seed % 3,
  };
  state.trees.set(node.nodeId, tree);
  state.treeLayerDirty = true;
  state.windIndexDirty = true;
  updateCounters();
  return tree;
}

function treePoint(tree) {
  return {
    x: tree.nx * state.width,
    y: tree.ny * state.height,
  };
}

function addTreeMemory(tree, amount = 1, immediate = false) {
  tree.count += amount;
  tree.targetSize = Math.min(58, 17 + Math.log2(tree.count + 1) * 8);
  if (immediate) tree.size = tree.targetSize;
  state.treeLayerDirty = true;
  state.windIndexDirty = true;
}

function buildRoute(sequence, immediate = false, controller = null) {
  const waypoints = [];
  const allTrees = [];

  for (const step of sequence.waypoints) {
    if (step.kind === "tree") {
      const stepTrees = step.nodes.map(ensureTree);
      allTrees.push(...stepTrees);
      waypoints.push({
        kind: "tree",
        tree: stepTrees[0],
        stepTrees,
      });
    } else if (step.kind === "fog") {
      waypoints.push({
        kind: "fog",
        hopCount: step.hopCount,
      });
    }
  }

  if (immediate) {
    for (const tree of allTrees) addTreeMemory(tree, 1, true);
  }

  if (waypoints.length === 0) return;
  if (immediate && !controller) return;
  const route = {
    id: sequence.sequenceId,
    waypoints,
    addressFamily: sequence.addressFamily,
    termination: sequence.termination,
    controller,
    registeredAt: performance.now(),
  };
  state.routeRegistry.set(sequence.sequenceId, route);
  if (!immediate) state.pendingFlights.push(route);
  return route;
}

function ingestObservation(
  observation,
  { immediate = false, controller = null } = {},
) {
  const sequence = createBirdSequence(observation);
  if (state.seenMeasurements.has(sequence.sequenceId)) return;
  state.seenMeasurements.add(sequence.sequenceId);
  state.routesSeen += 1;
  destinationState.textContent = `DESTINATION / ${sequence.destinationLabel}`;
  const route = buildRoute(sequence, immediate, controller);
  updateCounters();
  emptyMessage.classList.add("has-routes");
  return route;
}

function updateCounters() {
  treeCount.textContent = String(state.trees.size);
  routeCount.textContent = String(state.routesSeen);
}

function waypointPositions(flight) {
  const resolved = [];
  for (let index = 0; index < flight.waypoints.length; index += 1) {
    const waypoint = flight.waypoints[index];
    if (waypoint.kind === "tree") {
      resolved.push({ ...treePoint(waypoint.tree), source: waypoint });
      continue;
    }

    const previous = [...flight.waypoints]
      .slice(0, index)
      .reverse()
      .find((item) => item.kind === "tree");
    const next = flight.waypoints
      .slice(index + 1)
      .find((item) => item.kind === "tree");
    const previousPoint = previous
      ? treePoint(previous.tree)
      : { x: state.width * 0.18, y: state.height * 0.58 };
    const nextPoint = next
      ? treePoint(next.tree)
      : {
          x: Math.min(state.width * 0.94, previousPoint.x + state.width * 0.16),
          y: Math.max(state.height * 0.3, previousPoint.y - state.height * 0.04),
        };
    resolved.push({
      x: (previousPoint.x + nextPoint.x) / 2,
      y: (previousPoint.y + nextPoint.y) / 2,
      source: waypoint,
    });
  }
  return resolved;
}

function flightMotionPath(flight, points) {
  const cacheKey = `${state.width}:${state.height}`;
  if (flight.motionPath?.cacheKey !== cacheKey) {
    flight.motionPath = {
      cacheKey,
      path: createArcLengthPath(points),
    };
  }
  return flight.motionPath.path;
}

function flightPosition(
  flight,
  progress = flight.progress,
  suppliedPoints = null,
) {
  const points = suppliedPoints || waypointPositions(flight);
  if (points.length === 0) {
    return {
      x: state.width * 0.5,
      y: state.height * 0.5,
      angle: 0,
      fogAmount: 0,
      pathPosition: 0,
    };
  }
  const motionPath = flightMotionPath(flight, points);
  const sampled = sampleArcLengthPath(
    motionPath,
    motionPath.totalLength * Math.max(0, Math.min(1, progress)),
  );
  const segment = sampled.segmentIndex;
  const local = sampled.local;
  const from = points[segment] || points[0];
  const to = points[Math.min(segment + 1, points.length - 1)] || from;
  const easedFog = local * local * (3 - 2 * local);
  const fromFog = from.source?.kind === "fog";
  const toFog = to.source?.kind === "fog";
  const fogAmount =
    fromFog && toFog
      ? 1
      : toFog
        ? easedFog
        : fromFog
          ? 1 - easedFog
          : 0;
  return {
    x: sampled.x,
    y: sampled.y,
    angle: sampled.angle,
    fogAmount,
    pathPosition: sampled.pathPosition,
  };
}

function dropSeed(tree, now, flightId, waypointIndex, bird) {
  const target = treePoint(tree);
  const release = birdWorldAnchor({
    x: bird.x,
    y: bird.y,
    angle: bird.angle,
    name: "seed",
  });
  state.seeds.push({
    tree,
    x: release.x + ((hashText(`${flightId}-${waypointIndex}`) % 5) - 2),
    startY: release.y,
    targetY: target.y + 4,
    bornAt: now,
    life: prefersReducedMotion ? 120 : visualStyle.motion.seedDropMs,
    phase: (hashText(tree.nodeId) % 628) / 100,
    applied: false,
  });
}

function releaseFeather(flight, now) {
  const position = flightPosition(flight);
  state.feathers.push({
    x: position.x - Math.cos(position.angle) * 10,
    y: position.y - Math.sin(position.angle) * 10,
    bornAt: now,
    life: prefersReducedMotion ? 600 : visualStyle.motion.featherDriftMs,
    phase: (hashText(flight.id) % 628) / 100,
    seed: flight.id,
  });
}

function releasePlane(letter, now) {
  if (
    letter.controller &&
    state.endedControllers.has(letter.flightId)
  ) {
    return;
  }
  const pose = messagePoseAt(1);
  const participantPalette = letter.controller?.color
    ? {
        ...palette,
        paper: letter.controller.color,
        seed: letter.controller.color,
      }
    : palette;
  const initialVx = 24 + (hashText(letter.flightId) % 25);
  const initialVy = -8;
  state.planes.push({
    flightId: letter.flightId,
    x: letter.x + pose.xOffset,
    y: letter.y + pose.yOffset,
    vx: initialVx,
    vy: initialVy,
    bornAt: now,
    controllableAt:
      now + (prefersReducedMotion ? 0 : visualStyle.motion.planeControlDelayMs),
    controlBlend: prefersReducedMotion ? 1 : 0,
    life: letter.controller
      ? Number.POSITIVE_INFINITY
      : isSimulation
        ? 20_000
        : visualStyle.motion.planeFlightMs,
    phase: (hashText(letter.flightId) % 100) / 20,
    heading: Math.atan2(initialVy, initialVx),
    wind: { x: 0, y: 0 },
    controller: letter.controller,
    palette: participantPalette,
  });
}

function restoreControllerPlane(route, now) {
  if (
    !route?.controller ||
    state.endedControllers.has(route.id) ||
    state.planes.some((plane) => plane.flightId === route.id) ||
    state.letters.some((letter) => letter.flightId === route.id) ||
    state.flights.some((flight) => flight.id === route.id)
  ) {
    return;
  }
  const points = waypointPositions(route);
  const endpoint = points.at(-1);
  if (!endpoint) return;
  const pose = messagePoseAt(1);
  releasePlane(
    {
      flightId: route.id,
      x: endpoint.x - pose.xOffset,
      y: endpoint.y - pose.yOffset,
      controller: route.controller,
    },
    now,
  );
  const plane = state.planes.at(-1);
  if (plane?.flightId === route.id) {
    plane.controllableAt = now;
    plane.controlBlend = 1;
  }
}

function launchFlights(now) {
  const maximumFlights = isSimulation ? 8 : 3;
  while (
    state.flights.length < maximumFlights &&
    state.pendingFlights.length > 0
  ) {
    const route = state.pendingFlights.shift();
    const flight = {
      ...route,
      startedAt: now,
      visited: new Set(),
      fogged: new Set(),
    };
    const points = waypointPositions(flight);
    const motionPath = flightMotionPath(flight, points);
    const speed =
      visualStyle.motion.birdFlightSpeedPxPerSecond *
      (isSimulation ? 1.8 : 1);
    flight.duration = prefersReducedMotion
      ? 250
      : Math.max(400, (motionPath.totalLength / speed) * 1_000);
    state.flights.push(flight);
  }
}

function completeFlight(flight, now) {
  const points = waypointPositions(flight);
  const last = points.at(-1) || {
    x: state.width * 0.7,
    y: state.height * 0.5,
  };
  const previous = points.at(-2) || last;
  const arrivalAngle = Math.atan2(last.y - previous.y, last.x - previous.x);
  const letterAnchor = birdWorldAnchor({
    x: last.x,
    y: last.y,
    angle: arrivalAngle,
    name: "letter",
  });
  state.highlights.push({
    flightId: flight.id,
    points: points.map((point) => ({
      x: point.x,
      y: point.y,
      source: { kind: point.source.kind },
    })),
    bornAt: now,
    life: prefersReducedMotion ? 1_200 : visualStyle.motion.routeHighlightMs,
  });
  if (flight.controller && state.endedControllers.has(flight.id)) return;
  state.letters.push({
    flightId: flight.id,
    x: letterAnchor.x,
    y: letterAnchor.y,
    bornAt: now,
    life: prefersReducedMotion ? 180 : visualStyle.motion.letterFoldMs,
    fromFog: last.source?.kind === "fog",
    controller: flight.controller,
    released: false,
  });
}

function updateFlights(now) {
  launchFlights(now);
  const completed = [];

  for (const flight of state.flights) {
    const points = waypointPositions(flight);
    const elapsed = now - flight.startedAt;
    const progress = flight.looping
      ? (elapsed % flight.duration) / flight.duration
      : Math.min(1, elapsed / flight.duration);
    const bird = flightPosition(flight, progress, points);
    const pathPosition = bird.pathPosition;
    const reachedIndex = Math.floor(pathPosition);

    for (let index = 0; index <= reachedIndex; index += 1) {
      const point = points[index];
      if (!point) continue;
      if (point.source.kind === "tree" && !flight.visited.has(index)) {
        flight.visited.add(index);
        for (const tree of point.source.stepTrees) {
          dropSeed(tree, now, flight.id, index, bird);
        }
      }
    }

    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      if (
        point?.source.kind === "fog" &&
        !flight.fogged.has(index) &&
        shouldRevealFog(pathPosition, index)
      ) {
        flight.fogged.add(index);
        state.fogs.push({
          x: point.x,
          y: point.y,
          radius: 46 + point.source.hopCount * 12,
          bornAt: now,
          life:
            (isSimulation ? 18_000 : visualStyle.motion.fogBaseMs) +
            point.source.hopCount * 700,
          phase: index + hashText(flight.id) / 1000,
        });
      }
    }

    flight.progress = progress;
    if (
      !flight.feathered &&
      progress >= 0.38 &&
      shouldReleaseFeather(hashText(flight.id), isSimulation)
    ) {
      flight.feathered = true;
      releaseFeather(flight, now);
    }
    if (!flight.looping && progress >= 1) completed.push(flight);
  }

  for (const flight of completed) {
    completeFlight(flight, now);
    state.birdVisuals.delete(flight.id);
    state.flights.splice(state.flights.indexOf(flight), 1);
  }
}

function updateEffects(now, deltaSeconds) {
  for (const seed of state.seeds) {
    const progress = lifecycleProgress(now, seed.bornAt, seed.life);
    if (progress >= 1 && !seed.applied) {
      seed.applied = true;
      addTreeMemory(seed.tree);
    }
  }
  state.seeds = state.seeds.filter(
    (seed) => lifecycleProgress(now, seed.bornAt, seed.life) < 1,
  );

  state.feathers = state.feathers.filter(
    (feather) => lifecycleProgress(now, feather.bornAt, feather.life) < 1,
  );

  for (const letter of state.letters) {
    const progress = lifecycleProgress(now, letter.bornAt, letter.life);
    if (progress >= 1 && !letter.released) {
      letter.released = true;
      releasePlane(letter, now);
    }
  }
  state.letters = state.letters.filter((letter) => !letter.released);
  state.highlights = state.highlights.filter(
    (highlight) =>
      lifecycleProgress(now, highlight.bornAt, highlight.life) < 1,
  );
}

function refreshWindIndex(now) {
  if (
    !state.windIndexDirty ||
    now - state.lastWindIndexAt < 500
  ) {
    return;
  }
  state.windIndex = createTreeWindIndex({
    trees: [...state.trees.values()].map((tree) => ({
      ...treePoint(tree),
      size: tree.size,
      seed: tree.nodeId,
    })),
  });
  state.windIndexDirty = false;
  state.lastWindIndexAt = now;
}

function updateDiagnostics(now) {
  if (now - state.lastDiagnosticsAt < 100) return;
  state.lastDiagnosticsAt = now;
  exhibition.dataset.routes = String(state.routesSeen);
  exhibition.dataset.trees = String(state.trees.size);
  exhibition.dataset.flights = String(state.flights.length);
  exhibition.dataset.seeds = String(state.seeds.length);
  exhibition.dataset.feathers = String(state.feathers.length);
  exhibition.dataset.letters = String(state.letters.length);
  const activeLetter = state.letters[0];
  exhibition.dataset.messageState = activeLetter
    ? messageStateAt(
        lifecycleProgress(now, activeLetter.bornAt, activeLetter.life),
      ).state
    : state.planes.length > 0
      ? (state.planes[0].controlBlend ?? 1) >= 1
        ? "controllable"
        : "plane"
      : "idle";
  exhibition.dataset.highlights = String(state.highlights.length);
  exhibition.dataset.planes = String(state.planes.length);
  exhibition.dataset.fogs = String(state.fogs.length);
  exhibition.dataset.controllerInputs = String(state.planeControls.size);
  const controllerPlane = state.planes.find((plane) => plane.controller);
  exhibition.dataset.controllerPlanes = String(
    state.planes.filter((plane) => plane.controller).length,
  );
  exhibition.dataset.controllerPlaneX = controllerPlane
    ? controllerPlane.x.toFixed(2)
    : "";
  exhibition.dataset.controllerPlaneY = controllerPlane
    ? controllerPlane.y.toFixed(2)
    : "";
  exhibition.dataset.windTrees = String(state.windIndex.size);
}

function updateWindMotes(now, deltaSeconds) {
  if (state.width <= 0 || state.height <= 0) return;
  const motionScale = prefersReducedMotion ? 0.22 : 1;
  const time = now / 1_000;
  const windTrees = [...state.trees.values()]
    .filter((tree) => tree.size >= 5)
    .map((tree) => ({
      id: tree.nodeId,
      size: tree.size,
      ...treePoint(tree),
    }));
  const visibleMoteCount = Math.min(
    state.motes.length,
    windTrees.length * 42,
  );

  function respawnMote(mote) {
    if (windTrees.length === 0) {
      mote.active = false;
      mote.history.length = 0;
      return;
    }

    mote.respawnCount += 1;
    const tree =
      windTrees[(mote.index + mote.respawnCount * 17) % windTrees.length];
    const random = randomFrom(
      hashText(`${tree.id}:${mote.index}:${mote.respawnCount}`),
    );
    const minimumRadius = 24 + tree.size * 0.72;
    const maximumRadius = 54 + tree.size * 1.86;
    let x = tree.x;
    let y = tree.y;
    let placed = false;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const angle = random() * Math.PI * 2;
      const radius =
        minimumRadius + random() * (maximumRadius - minimumRadius);
      x = tree.x + Math.cos(angle) * radius;
      y = tree.y + Math.sin(angle) * radius * (0.68 + random() * 0.22);
      if (
        x >= 10 &&
        x <= state.width - 10 &&
        y >= 10 &&
        y <= state.height - 10
      ) {
        placed = true;
        break;
      }
    }

    if (!placed) {
      const inwardAngle = Math.atan2(
        state.height * 0.5 - tree.y,
        state.width * 0.5 - tree.x,
      );
      x = tree.x + Math.cos(inwardAngle) * minimumRadius;
      y = tree.y + Math.sin(inwardAngle) * minimumRadius;
    }

    mote.x = x;
    mote.y = y;
    mote.vx = 0;
    mote.vy = 0;
    mote.bornAt = now;
    mote.life = 5_200 + random() * 4_800;
    mote.opacity = 0;
    mote.active = true;
    mote.treeId = tree.id;
    mote.lastTrailAt = now;
    mote.history.length = 0;
    mote.history.push({ x, y });
  }

  for (let index = 0; index < state.motes.length; index += 1) {
    const mote = state.motes[index];
    if (index >= visibleMoteCount) {
      mote.active = false;
      mote.opacity = 0;
      mote.history.length = 0;
      continue;
    }
    if (!mote.active) respawnMote(mote);
    if (!mote.active) continue;

    const age = now - mote.bornAt;
    const outside =
      mote.x < -12 ||
      mote.x > state.width + 12 ||
      mote.y < -12 ||
      mote.y > state.height + 12;
    if (outside || age >= mote.life) {
      respawnMote(mote);
      continue;
    }

    const wind = windField.sample(
      mote.x,
      mote.y,
      time,
      state.windIndex,
    );
    const windMagnitude = Math.hypot(wind.x, wind.y);
    if (windMagnitude < 0.008) {
      respawnMote(mote);
      continue;
    }
    const targetVx = wind.x * mote.speed;
    const targetVy = wind.y * mote.speed;
    const response = 1 - Math.exp(-4.8 * deltaSeconds);
    mote.vx += (targetVx - mote.vx) * response;
    mote.vy += (targetVy - mote.vy) * response;
    mote.x += mote.vx * deltaSeconds * motionScale;
    mote.y += mote.vy * deltaSeconds * motionScale;
    const fadeIn = Math.min(1, age / 420);
    const fadeOut = Math.min(1, (mote.life - age) / 900);
    const motionVisibility = Math.min(1, windMagnitude / 0.055);
    mote.opacity = Math.max(0, fadeIn * fadeOut * motionVisibility);

    if (now - mote.lastTrailAt >= 42) {
      mote.history.push({ x: mote.x, y: mote.y });
      if (mote.history.length > 7) mote.history.shift();
      mote.lastTrailAt = now;
    }
  }
}

function updateScene(now, deltaSeconds) {
  updateFlights(now);
  updateEffects(now, deltaSeconds);
  for (const tree of state.trees.values()) {
    const previousSize = tree.size;
    tree.size +=
      (tree.targetSize - tree.size) * Math.min(1, deltaSeconds * 2.6);
    if (Math.abs(tree.size - previousSize) > 0.01) {
      state.treeLayerDirty = true;
      state.windIndexDirty = true;
    }
  }
  refreshWindIndex(now);
  updateWindMotes(now, deltaSeconds);
  state.fogs = state.fogs.filter((fog) => now - fog.bornAt < fog.life);
  state.planes = state.planes.filter((plane) => now - plane.bornAt < plane.life);
  for (const [routeId, route] of state.routeRegistry) {
    if (now - route.registeredAt > 900_000) {
      state.routeRegistry.delete(routeId);
      state.planeControls.delete(routeId);
      state.endedControllers.delete(routeId);
    }
  }

  for (const plane of state.planes) {
    const controllableAt = plane.controllableAt ?? plane.bornAt;
    const controlBlend =
      plane.controlBlend === 1
        ? 1
        : Math.max(0, Math.min(1, (now - controllableAt) / 620));
    plane.controlBlend = controlBlend;
    const controlState = state.planeControls.get(plane.flightId);
    const control =
      controlState &&
      now - controlState.receivedAt <= planePhysics.inputTimeoutMs
        ? controlState
        : { x: 0, y: 0 };
    plane.wind = windField.sample(
      plane.x,
      plane.y,
      now / 1_000 + plane.phase,
      state.windIndex,
    );
    if (controlBlend > 0) {
      const forces = combinePlaneForces({
        wind: plane.wind,
        control,
        windStrength: planePhysics.windStrength * controlBlend,
        controlStrength: planePhysics.controlStrength * controlBlend,
      });
      const integrated = integratePlane(
        plane,
        forces.totalForce,
        deltaSeconds,
        {
          drag: planePhysics.drag,
          maxSpeed: planePhysics.maxSpeed,
        },
      );
      plane.x = integrated.x;
      plane.y = integrated.y;
      plane.vx = integrated.vx;
      plane.vy = integrated.vy;
      if (Math.hypot(integrated.vx, integrated.vy) >= 0.5) {
        plane.heading = Math.atan2(integrated.vy, integrated.vx);
      }
    }
    if (plane.looping) {
      if (plane.x > state.width + 24) plane.x = -24;
      if (plane.x < -24) plane.x = state.width + 24;
      if (plane.y > state.height + 24) plane.y = -24;
      if (plane.y < -24) plane.y = state.height + 24;
    }
  }
  updateDiagnostics(now);
}

function drawBackground(now) {
  context.save();
  context.lineWidth = 1;
  context.strokeStyle = "rgba(157, 187, 192, 0.018)";
  const drift = (now * 0.004) % 90;
  for (let y = -90 + drift; y < state.height + 90; y += 90) {
    context.beginPath();
    for (let x = -20; x <= state.width + 20; x += 28) {
      const wave = Math.sin(x * 0.007 + y * 0.011) * 14;
      if (x === -20) context.moveTo(x, y + wave);
      else context.lineTo(x, y + wave);
    }
    context.stroke();
  }

  for (const mote of state.motes) {
    if (!mote.active || mote.opacity <= 0.01) continue;
    const x = mote.x;
    const y = mote.y;
    const speed = Math.hypot(mote.vx, mote.vy);
    const directionX = speed > 0.01 ? mote.vx / speed : 1;
    const directionY = speed > 0.01 ? mote.vy / speed : 0;
    const shimmer =
      0.72 + Math.sin(now * 0.0017 + mote.phase * 2.3) * 0.28;
    const alpha = mote.alpha * shimmer * mote.opacity;
    const trail = mote.trail * Math.min(1, speed / 24);

    context.beginPath();
    if (mote.history.length >= 3) {
      const first = mote.history[0];
      context.moveTo(first.x, first.y);
      for (let index = 1; index < mote.history.length - 1; index += 1) {
        const point = mote.history[index];
        const next = mote.history[index + 1];
        context.quadraticCurveTo(
          point.x,
          point.y,
          (point.x + next.x) * 0.5,
          (point.y + next.y) * 0.5,
        );
      }
      context.lineTo(x, y);
    } else {
      context.moveTo(
        x - directionX * trail,
        y - directionY * trail,
      );
      context.lineTo(x, y);
    }
    context.lineCap = "round";
    context.lineWidth = mote.size * 0.72;
    context.strokeStyle = `rgba(184, 222, 213, ${alpha * 0.52})`;
    context.stroke();

    context.beginPath();
    context.fillStyle = `rgba(196, 231, 222, ${alpha})`;
    context.arc(x, y, mote.size, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawHighlight(highlight, now) {
  const progress = lifecycleProgress(now, highlight.bornAt, highlight.life);
  const plane = state.planes.find(
    (candidate) => candidate.flightId === highlight.flightId,
  );
  drawRouteHighlight(context, {
    segments: routeHighlightSegments(highlight.points, plane),
    routeId: highlight.flightId,
    progress,
  });
}

function drawFlightRoute(flight, now) {
  const points = waypointPositions(flight);
  if (points.length === 0) return;
  const bird = flightPosition(flight);
  const visual = state.birdVisuals.get(flight.id) || {
    angle: bird.angle,
    lastAt: now,
  };
  visual.angle = smoothBirdHeading(
    visual.angle,
    bird.angle,
    Math.min(0.05, Math.max(0, (now - visual.lastAt) / 1_000)),
  );
  visual.lastAt = now;
  state.birdVisuals.set(flight.id, visual);
  const birdPalette = flight.controller?.color
    ? {
        ...palette,
        seed: flight.controller.color,
      }
    : palette;

  drawRoutePath(context, {
    segments: visibleRouteSegments(points),
    routeId: flight.id,
    bird: {
      ...bird,
      angle: visual.angle,
      phase: (hashText(flight.id) % 628) / 100,
      glow: 0.34,
      palette: birdPalette,
    },
    now,
  });
}

function drawSeed(seed, now) {
  const progress = lifecycleProgress(now, seed.bornAt, seed.life);
  const eased = 1 - Math.pow(1 - progress, 3);
  const drift = Math.sin(progress * Math.PI * 2 + seed.phase) * 6;
  const y = seed.startY + (seed.targetY - seed.startY) * eased;

  context.save();
  context.translate(seed.x + drift, y);
  context.rotate(progress * Math.PI * 1.2 + seed.phase);
  context.fillStyle = palette.seed;
  context.shadowColor = palette.seed;
  context.shadowBlur = 13 * (1 - progress * 0.5);
  context.beginPath();
  context.ellipse(0, 0, 3.2, 5.2, -0.4, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawFeather(feather, now) {
  const progress = lifecycleProgress(now, feather.bornAt, feather.life);
  const pose = featherPoseAt(progress, feather.phase, {
    sway: prefersReducedMotion ? 5 : DEFAULT_FEATHER_ART.sway,
    fallDistance: prefersReducedMotion ? 28 : DEFAULT_FEATHER_ART.fallDistance,
    swayCycles: prefersReducedMotion ? 0.35 : DEFAULT_FEATHER_ART.swayCycles,
    rotation: prefersReducedMotion ? 0.12 : DEFAULT_FEATHER_ART.rotation,
  });
  drawFeatherArt(context, {
    x: feather.x + pose.x,
    y: feather.y + pose.y,
    angle: pose.angle,
    scale: DEFAULT_FEATHER_ART.scale,
    alpha: pose.alpha * 0.82,
    color: palette.paper,
    glowColor: palette.seed,
    glow: 0.08,
    seed: feather.seed,
  });
}

function drawLetter(letter, now) {
  const progress = lifecycleProgress(now, letter.bornAt, letter.life);
  drawMessage(context, {
    x: letter.x,
    y: letter.y,
    progress,
    time: now,
    glow: 0.38,
    fromFog: letter.fromFog,
  });
}

function drawPlane(plane, now) {
  const age = (now - plane.bornAt) / plane.life;
  drawPlaneWind(context, {
    x: plane.x,
    y: plane.y,
    wind: plane.wind,
    alpha: 0.12 * (plane.controlBlend ?? 1),
  });
  drawPaperPlane(context, {
    x: plane.x,
    y: plane.y,
    angle:
      Number.isFinite(plane.heading)
        ? plane.heading
        : Math.atan2(plane.vy, plane.vx),
    alpha: Math.min(1, (1 - age) * 2.5),
    controllable: plane.controlBlend ?? 1,
    time: now,
    palette: plane.palette || palette,
  });
}

function drawTreeLayer(now) {
  const cacheKey = getTreeArtCacheKey({
    width: state.width,
    height: state.height,
    pixelRatio: state.pixelRatio,
    palette,
  });
  if (cacheKey !== state.treeLayerCacheKey) {
    state.treeLayerDirty = true;
  }
  if (state.treeLayerDirty) {
    treeLayerContext.setTransform(1, 0, 0, 1, 0, 0);
    treeLayerContext.clearRect(
      0,
      0,
      treeLayerCanvas.width,
      treeLayerCanvas.height,
    );
    treeLayerContext.setTransform(
      state.pixelRatio,
      0,
      0,
      state.pixelRatio,
      0,
      0,
    );
    const forestAlpha = Math.max(
      0.56,
      1 - Math.max(0, state.trees.size - 36) / 420,
    );
    for (const tree of state.trees.values()) {
      drawTree(treeLayerContext, {
        tree,
        position: treePoint(tree),
        now,
        alpha: forestAlpha,
      });
    }
    state.treeLayerDirty = false;
    state.treeLayerCacheKey = cacheKey;
  }

  context.drawImage(
    treeLayerCanvas,
    0,
    0,
    treeLayerCanvas.width,
    treeLayerCanvas.height,
    0,
    0,
    state.width,
    state.height,
  );
}

function draw(now) {
  context.clearRect(0, 0, state.width, state.height);
  drawBackground(now);
  for (const highlight of state.highlights) drawHighlight(highlight, now);
  for (const flight of state.flights) drawFlightRoute(flight, now);
  drawTreeLayer(now);
  for (const seed of state.seeds) drawSeed(seed, now);
  for (const feather of state.feathers) drawFeather(feather, now);
  for (const fog of state.fogs) {
    drawFog(context, { fog, now, texture: fogTexture });
  }
  for (const letter of state.letters) drawLetter(letter, now);
  for (const plane of state.planes) drawPlane(plane, now);
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * ratio))];
}

function performanceSnapshot(now) {
  const samples = state.performance?.samples || [];
  const averageFrame =
    samples.reduce((total, value) => total + value, 0) /
    Math.max(1, samples.length);
  const p95 = percentile(samples, 0.95);
  const maximum = samples.length > 0 ? Math.max(...samples) : 0;
  const isVisible = document.visibilityState === "visible";
  const warmedUp = now - state.performance.startedAt >= 3_000;
  const fps = averageFrame > 0 ? 1000 / averageFrame : 0;
  const status = !isVisible
    ? "paused"
    : !warmedUp
    ? "warming"
    : fps >= 50 && p95 <= 25
      ? "pass"
      : "under-target";

  return Object.freeze({
    status,
    visibility: document.visibilityState,
    fps: Number(fps.toFixed(1)),
    averageFrameMs: Number(averageFrame.toFixed(2)),
    p95FrameMs: Number(p95.toFixed(2)),
    maxFrameMs: Number(maximum.toFixed(2)),
    longTasks: state.performance.longTasks,
    sampleCount: samples.length,
    resolution: Object.freeze({
      width: Math.round(state.width),
      height: Math.round(state.height),
      pixelRatio: state.pixelRatio,
    }),
    objects: Object.freeze({
      trees: state.trees.size,
      birds: state.flights.length,
      fogs: state.fogs.length,
      planes: state.planes.length,
    }),
  });
}

function updatePerformanceMonitor(now) {
  if (!state.performance || now - state.performance.lastReportAt < 500) return;
  state.performance.lastReportAt = now;
  const snapshot = performanceSnapshot(now);
  state.performance.snapshot = snapshot;

  performanceMonitor.dataset.status = snapshot.status;
  performanceStatus.textContent =
    snapshot.status === "paused"
      ? "画面を表示"
      : snapshot.status === "warming"
      ? "計測準備中"
      : snapshot.status === "pass"
        ? "基準内"
        : "要調整";
  performanceFps.textContent =
    snapshot.status === "warming" || snapshot.status === "paused"
      ? "—"
      : snapshot.fps.toFixed(1);
  performanceP95.textContent =
    snapshot.status === "warming" || snapshot.status === "paused"
      ? "—"
      : snapshot.p95FrameMs.toFixed(1);
  performanceMax.textContent =
    snapshot.status === "warming" || snapshot.status === "paused"
      ? "—"
      : snapshot.maxFrameMs.toFixed(1);
  performanceLongTasks.textContent = String(snapshot.longTasks);
  performanceProfile.textContent = [
    `${snapshot.resolution.width}×${snapshot.resolution.height}`,
    `DPR ${snapshot.resolution.pixelRatio.toFixed(1)}`,
    `木 ${snapshot.objects.trees}`,
    `鳥 ${snapshot.objects.birds}`,
    `霧 ${snapshot.objects.fogs}`,
    `紙飛行機 ${snapshot.objects.planes}`,
  ].join(" / ");

  const recent = state.performance.samples.slice(-48);
  performancePulse.replaceChildren(
    ...recent.map((frameTime) => {
      const bar = document.createElement("i");
      bar.style.setProperty(
        "--pulse-height",
        `${Math.max(8, Math.min(100, (frameTime / 34) * 100))}%`,
      );
      if (frameTime > 25) bar.classList.add("is-slow");
      return bar;
    }),
  );
}

function recordFramePerformance(now, frameTime) {
  if (!state.performance) return;
  if (document.visibilityState !== "visible") {
    state.performance.samples.length = 0;
    state.performance.startedAt = now;
    updatePerformanceMonitor(now);
    return;
  }
  if (frameTime <= 0 || frameTime > 1_000) return;
  state.performance.samples.push(frameTime);
  if (state.performance.samples.length > 300) {
    state.performance.samples.splice(
      0,
      state.performance.samples.length - 300,
    );
  }
  updatePerformanceMonitor(now);
}

function frame(now) {
  const currentPixelRatio = Math.min(2, window.devicePixelRatio || 1);
  if (currentPixelRatio !== state.pixelRatio) resize();
  const frameTime = now - state.lastFrame;
  const deltaSeconds = Math.min(0.05, frameTime / 1000);
  state.lastFrame = now;
  updateScene(now, deltaSeconds);
  draw(now);
  recordFramePerformance(now, frameTime);
  requestAnimationFrame(frame);
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  state.pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  state.width = rect.width;
  state.height = rect.height;
  canvas.width = Math.round(rect.width * state.pixelRatio);
  canvas.height = Math.round(rect.height * state.pixelRatio);
  treeLayerCanvas.width = canvas.width;
  treeLayerCanvas.height = canvas.height;
  state.treeLayerDirty = true;
  state.windIndexDirty = true;
  context.setTransform(
    state.pixelRatio,
    0,
    0,
    state.pixelRatio,
    0,
    0,
  );

  if (state.motes.length === 0) {
    const random = randomFrom(411);
    const moteCount = visualStyle.density.ambientWindMotes;
    state.motes = Array.from(
      { length: moteCount },
      (_, index) => ({
        index,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        speed: 92 + random() * 68,
        size: (0.65 + random() * 1.35) * 1.5,
        trail: 5 + random() * 11,
        alpha: 0.09 + random() * 0.17,
        phase: random() * Math.PI * 2,
        active: false,
        bornAt: 0,
        life: 0,
        opacity: 0,
        respawnCount: 0,
        treeId: null,
        lastTrailAt: 0,
        history: [],
      }),
    );
  } else {
    for (const mote of state.motes) {
      mote.active = false;
      mote.opacity = 0;
      mote.history.length = 0;
    }
  }
}

function setConnection(mode, label) {
  connectionLight.className = "connection-light";
  if (mode) connectionLight.classList.add(mode);
  connectionState.textContent = label;
}

function connectLiveEvents() {
  const source = new EventSource("/api/display/events");
  setConnection("", "接続しています");

  source.addEventListener("open", () => {
    setConnection("is-live", "LIVE");
  });
  source.addEventListener("error", () => {
    setConnection("", "再接続しています");
  });
  source.addEventListener("snapshot", (event) => {
    try {
      const payload = JSON.parse(event.data);
      const controllerByMeasurement = new Map(
        (payload.controllers || []).map((controller) => [
          controller.measurementId,
          controller,
        ]),
      );
      state.planes = state.planes.filter(
        (plane) =>
          !plane.controller || controllerByMeasurement.has(plane.flightId),
      );
      const now = performance.now();
      for (const item of payload.observations || []) {
        const measurementId = item.observation?.measurementId;
        const controller =
          controllerByMeasurement.get(measurementId) || null;
        const route =
          ingestObservation(item.observation, {
            immediate: true,
            controller,
          }) || state.routeRegistry.get(measurementId);
        if (controller) restoreControllerPlane(route, now);
      }
    } catch {
      setConnection("", "データを確認しています");
    }
  });
  source.addEventListener("route-observed", (event) => {
    try {
      const payload = JSON.parse(event.data);
      ingestObservation(payload.observation, {
        controller: payload.controller || null,
      });
    } catch {
      setConnection("", "データを確認しています");
    }
  });
  source.addEventListener("plane-control", (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (
        typeof payload.measurementId !== "string" ||
        typeof payload.x !== "number" ||
        typeof payload.y !== "number"
      ) {
        return;
      }
      state.planeControls.set(payload.measurementId, {
        x: Math.max(-1, Math.min(1, payload.x)),
        y: Math.max(-1, Math.min(1, payload.y)),
        sequence: payload.sequence,
        receivedAt: performance.now(),
      });
    } catch {
      // Invalid controller events are ignored without disturbing the artwork.
    }
  });
  source.addEventListener("route-highlight", (event) => {
    try {
      const payload = JSON.parse(event.data);
      const route = state.routeRegistry.get(payload.measurementId);
      if (!route) return;
      const now = performance.now();
      state.highlights.push({
        flightId: payload.measurementId,
        points: waypointPositions(route).map((point) => ({
          x: point.x,
          y: point.y,
          source: { kind: point.source.kind },
        })),
        bornAt: now,
        life: 4_000,
      });
    } catch {
      // Invalid highlight events are ignored.
    }
  });
  source.addEventListener("controller-ended", (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (typeof payload.measurementId !== "string") return;
      state.endedControllers.add(payload.measurementId);
      state.planeControls.delete(payload.measurementId);
      state.letters = state.letters.filter(
        (letter) => letter.flightId !== payload.measurementId,
      );
      state.planes = state.planes.filter(
        (plane) => plane.flightId !== payload.measurementId,
      );
    } catch {
      // Invalid controller lifecycle events are ignored.
    }
  });
}

function demoObservation(sequence) {
  const random = randomFrom(sequence * 971 + 41);
  const steps = [];
  const length = 4 + Math.floor(random() * 5);
  for (let index = 0; index < length; index += 1) {
    if (index > 0 && random() < 0.24) {
      const startHop = index + 1;
      const hopCount = 1 + Math.floor(random() * 3);
      steps.push({
        kind: "unknown-segment",
        startHop,
        endHop: startHop + hopCount - 1,
        hopCount,
      });
      continue;
    }
    const shared = random() < 0.48;
    steps.push({
      kind: "observed-node",
      hop: index + 1,
      nodes: [
        {
          nodeId: shared
            ? `demo-shared-${index % 5}`
            : `demo-${sequence}-${index}`,
          addressFamily: 4,
        },
      ],
    });
  }
  return {
    schemaVersion: 2,
    measurementId: `demo-route-${sequence}`,
    observedAt: new Date().toISOString(),
    addressFamily: 4,
    method: "icmp",
    destination: {
      hostname: ["wikipedia.org", "openstreetmap.org", "archive.org"][
        sequence % 3
      ],
    },
    steps,
    termination: { kind: "completed_without_destination" },
  };
}

function startDemo() {
  setConnection("is-demo", "DEMO");
  let sequence = 1;
  ingestObservation(demoObservation(sequence));
  window.setInterval(() => {
    sequence += 1;
    ingestObservation(demoObservation(sequence));
  }, 5_400);
}

function startSimulation() {
  let simulation;
  try {
    simulation = createSimulation(simulationScenario, {
      runId: `display-${simulationScenario}-${Date.now().toString(36)}`,
    });
  } catch {
    setConnection("is-error", "UNKNOWN SCENARIO");
    destinationState.textContent = "SIMULATION / NOT FOUND";
    return;
  }

  setConnection("is-demo", "SIMULATION");
  destinationState.textContent = `SIMULATION / ${simulation.scenario.label}`;
  exhibition.classList.add("is-simulation");
  emptyMessage.classList.add("has-routes");

  const timers = [];
  for (const event of simulation.events) {
    const timer = window.setTimeout(() => {
      if (event.type === "observation") {
        ingestObservation(event.observation, {
          immediate: event.immediate === true,
        });
        return;
      }
      const mode =
        event.state === "live"
          ? "is-live"
          : event.state === "error" || event.state === "disconnected"
            ? "is-error"
            : "";
      setConnection(mode, event.label);
    }, event.atMs);
    timers.push(timer);
  }

  window.__routeForestSimulation = Object.freeze({
    snapshot: () => ({
      scenario: simulation.scenario.id,
      scheduledEvents: simulation.events.length,
      routesSeen: state.routesSeen,
      trees: state.trees.size,
      pendingFlights: state.pendingFlights.length,
      activeFlights: state.flights.length,
      seeds: state.seeds.length,
      feathers: state.feathers.length,
      letters: state.letters.length,
      highlights: state.highlights.length,
      planes: state.planes.length,
      fogs: state.fogs.length,
    }),
    stop: () => timers.forEach((timer) => window.clearTimeout(timer)),
  });
}

function performanceTree(index, total) {
  const columns = Math.ceil(Math.sqrt(total * 1.55));
  const rows = Math.ceil(total / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);
  const random = randomFrom(index * 811 + 73);
  const nx =
    0.04 +
    ((column + 0.2 + random() * 0.6) / Math.max(1, columns)) * 0.92;
  const ny =
    0.12 + ((row + 0.2 + random() * 0.6) / Math.max(1, rows)) * 0.82;
  const count = 1 + (index % 48);
  return {
    nodeId: `performance-node-${index}`,
    nx,
    ny,
    count,
    size: Math.min(58, 17 + Math.log2(count + 1) * 8),
    targetSize: Math.min(58, 17 + Math.log2(count + 1) * 8),
    sway: random(),
    variant: index % 3,
  };
}

function seedPerformanceScene() {
  const now = performance.now();
  state.performance = {
    startedAt: now,
    lastReportAt: 0,
    samples: [],
    longTasks: 0,
    snapshot: null,
  };

  for (let index = 0; index < performanceLoad.trees; index += 1) {
    const tree = performanceTree(index, performanceLoad.trees);
    state.trees.set(tree.nodeId, tree);
  }
  const trees = [...state.trees.values()];

  for (let index = 0; index < performanceLoad.birds; index += 1) {
    const waypoints = [];
    for (let step = 0; step < 8; step += 1) {
      const tree = trees[(index * 19 + step * 13) % trees.length];
      waypoints.push({ kind: "tree", tree, stepTrees: [tree] });
    }
    state.flights.push({
      id: `performance-flight-${index}`,
      waypoints,
      addressFamily: 4,
      termination: "destination_reached",
      startedAt: now - index * 470,
      duration: 5_600 + (index % 3) * 700,
      visited: new Set(),
      fogged: new Set(),
      looping: true,
      progress: 0,
    });
  }

  for (let index = 0; index < performanceLoad.fogs; index += 1) {
    const random = randomFrom(index * 313 + 29);
    state.fogs.push({
      x: state.width * (0.05 + random() * 0.9),
      y: state.height * (0.15 + random() * 0.76),
      radius: 54 + random() * 48,
      bornAt: now - 12_000 - index * 400,
      life: 3_600_000,
      phase: random() * Math.PI * 2,
    });
  }

  for (let index = 0; index < performanceLoad.planes; index += 1) {
    const random = randomFrom(index * 557 + 11);
    state.planes.push({
      x: random() * state.width,
      y: random() * state.height,
      vx: 18 + random() * 34,
      vy: -6 + random() * 12,
      bornAt: now,
      life: 3_600_000,
      phase: random() * Math.PI * 2,
      looping: true,
      controllableAt: now,
      controlBlend: 1,
    });
  }

  state.routesSeen = performanceLoad.birds;
  updateCounters();
  emptyMessage.classList.add("has-routes");
  exhibition.classList.add("is-performance");
  performanceMonitor.hidden = false;
  destinationState.textContent = "PERFORMANCE / SYNTHETIC FIELD LOAD";
  setConnection("is-demo", "LOAD TEST");

  if ("PerformanceObserver" in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        state.performance.longTasks += list.getEntries().length;
      });
      observer.observe({ type: "longtask", buffered: true });
      state.performance.observer = observer;
    } catch {
      // Long-task reporting is supplementary and browser-dependent.
    }
  }

  window.__routeForestPerformance = Object.freeze({
    snapshot: () => state.performance.snapshot || performanceSnapshot(performance.now()),
  });
}

document.addEventListener("visibilitychange", () => {
  if (!state.performance) return;
  state.performance.samples.length = 0;
  state.performance.startedAt = performance.now();
  state.performance.lastReportAt = 0;
});
window.addEventListener("resize", resize);
resize();
requestAnimationFrame(frame);

window.__routeForestDisplay = Object.freeze({
  snapshot: () => ({
    routesSeen: state.routesSeen,
    trees: state.trees.size,
    pendingFlights: state.pendingFlights.length,
    activeFlights: state.flights.length,
    seeds: state.seeds.length,
    feathers: state.feathers.length,
    letters: state.letters.length,
    highlights: state.highlights.length,
    planes: state.planes.length,
    fogs: state.fogs.length,
    controllerInputs: state.planeControls.size,
    windTrees: state.windIndex.size,
    plane: state.planes[0]
      ? {
          flightId: state.planes[0].flightId,
          x: state.planes[0].x,
          y: state.planes[0].y,
          vx: state.planes[0].vx,
          vy: state.planes[0].vy,
          wind: { ...state.planes[0].wind },
        }
      : null,
  }),
});

if (isPerformance) seedPerformanceScene();
else if (isSimulation) startSimulation();
else if (isDemo) {
  startDemo();
  connectLiveEvents();
} else connectLiveEvents();
