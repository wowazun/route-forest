import { visualStyle } from "./visual-style.js";
import { drawBirdArt } from "./bird-art.js";
import { drawTreeArt } from "./tree-art.js";

const VARIANTS = Object.freeze([
  Object.freeze({
    id: "folded-grove",
    label: "折り痕",
    englishLabel: "FOLDED GROVE",
    thesis: "通信を運ぶ鳥と木を、一枚の紙が折れて生まれた形として扱う。",
    character: "静か / 明快 / 紙飛行機との連続性",
  }),
  Object.freeze({
    id: "ink-vein",
    label: "筆脈",
    englishLabel: "INK VEIN",
    thesis: "一本の筆線が鳥の羽ばたきから木の枝へ連続していく。",
    character: "有機的 / 軽い / 遠目で柔らかい",
  }),
  Object.freeze({
    id: "signal-canopy",
    label: "通信層",
    englishLabel: "SIGNAL CANOPY",
    thesis: "鳥を伝播する波、木を蓄積する等高線として描く。",
    character: "作品固有 / 精密 / 情報通信との結びつき",
  }),
  Object.freeze({
    id: "facet-wing-ink",
    label: "柔翼・筆脈",
    englishLabel: "SOFT WING / INK VEIN",
    thesis: "半透明の翼面で通信を運ぶ鳥を描き、筆脈から育つ木へ着地させる。",
    character: "有機的 / 遠距離で明快 / 旋回と霧に表情",
    birdStyle: "soft-wing",
    treeStyle: "ink-vein",
    recommended: true,
  }),
]);

const freezeTriangles = (triangles) =>
  Object.freeze(
    triangles.map((triangle) =>
      Object.freeze(triangle.map((vertex) => Object.freeze(vertex))),
    ),
  );

export const lowPolyBirdSpec = Object.freeze({
  worldScale: 1.5,
  wingFlapRadians: (34 * Math.PI) / 180,
  maxRollRadians: (30 * Math.PI) / 180,
  rollResponse: 4,
  rollLerp: 0.1,
  flapFrequencyHz: 1.15,
  triangles: freezeTriangles([
    [
      [0.0, 0.02, 0.65, 0, 1.0],
      [0.05, -0.02, -0.585, 0, 0.4],
      [-0.05, -0.02, -0.585, 0, 0.4],
    ],
    [
      [0.05, -0.02, -0.585, 0, 0.4],
      [0.0, 0.0, -0.676, 0, 0.3],
      [-0.05, -0.02, -0.585, 0, 0.4],
    ],
    [
      [0.0575, 0.0, 0.15, 1, 0.85],
      [0.483, 0.06, 0.05, 1, 0.5],
      [0.6325, 0.05, -0.22, 1, 0.3],
    ],
    [
      [0.0575, 0.0, 0.15, 1, 0.85],
      [0.6325, 0.05, -0.22, 1, 0.3],
      [0.0575, 0.0, -0.34, 1, 0.45],
    ],
    [
      [-0.0575, 0.0, 0.15, -1, 0.85],
      [-0.6325, 0.05, -0.22, -1, 0.3],
      [-0.483, 0.06, 0.05, -1, 0.5],
    ],
    [
      [-0.0575, 0.0, 0.15, -1, 0.85],
      [-0.0575, 0.0, -0.34, -1, 0.45],
      [-0.6325, 0.05, -0.22, -1, 0.3],
    ],
  ]),
});

function variantById(id) {
  const variant = VARIANTS.find((item) => item.id === id);
  if (!variant) throw new RangeError(`Unknown art variant: ${id}`);
  return variant;
}

export function listArtVariants() {
  return VARIANTS;
}

export function getArtVariant(id) {
  return variantById(id);
}

function foldedBird(context, time) {
  const flap = Math.sin(time * 0.008) * 0.2;
  context.fillStyle = visualStyle.palette.seed;
  context.strokeStyle = visualStyle.palette.seed;
  context.lineWidth = 1.1;
  context.beginPath();
  context.moveTo(-2, 1);
  context.lineTo(-30, -13 - flap * 20);
  context.lineTo(-14, 5);
  context.lineTo(0, 1);
  context.lineTo(15, 5);
  context.lineTo(31, -11 + flap * 18);
  context.lineTo(5, -1);
  context.lineTo(16, 10);
  context.lineTo(0, 4);
  context.lineTo(-17, 11);
  context.closePath();
  context.globalAlpha *= 0.78;
  context.fill();
  context.globalAlpha /= 0.78;
  context.stroke();
  context.strokeStyle = "rgba(231, 238, 240, 0.38)";
  context.beginPath();
  context.moveTo(-28, -12 - flap * 20);
  context.lineTo(0, 1);
  context.lineTo(30, -10 + flap * 18);
  context.moveTo(-14, 5);
  context.lineTo(0, 1);
  context.lineTo(15, 5);
  context.stroke();
}

function inkBird(context, time) {
  const flap = Math.sin(time * 0.009) * 7;
  context.strokeStyle = visualStyle.palette.seed;
  context.fillStyle = visualStyle.palette.seed;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.shadowColor = visualStyle.palette.seed;
  context.shadowBlur = 10;
  context.lineWidth = 3.2;
  context.beginPath();
  context.moveTo(-2, 1);
  context.bezierCurveTo(-10, -9, -19, -13 - flap, -31, -3);
  context.moveTo(1, 1);
  context.bezierCurveTo(11, -10, 22, -12 + flap, 32, -2);
  context.stroke();
  context.shadowBlur = 0;
  context.lineWidth = 1.2;
  context.beginPath();
  context.moveTo(-14, 0);
  context.quadraticCurveTo(0, 9, 18, 1);
  context.stroke();
  context.beginPath();
  context.ellipse(0, 1, 6, 2.6, 0, 0, Math.PI * 2);
  context.fill();
}

function signalBird(context, time) {
  const pulse = 0.88 + Math.sin(time * 0.006) * 0.08;
  context.strokeStyle = visualStyle.palette.seed;
  context.fillStyle = visualStyle.palette.seed;
  context.lineCap = "round";
  for (let ring = 0; ring < 3; ring += 1) {
    context.globalAlpha *= 0.9 - ring * 0.2;
    context.lineWidth = 1.7 - ring * 0.3;
    context.beginPath();
    context.moveTo(-2, 1);
    context.quadraticCurveTo(
      -12 - ring * 5,
      -11 - ring * 3,
      -25 - ring * 5,
      -2,
    );
    context.moveTo(2, 1);
    context.quadraticCurveTo(
      12 + ring * 5,
      -11 - ring * 3,
      25 + ring * 5,
      -2,
    );
    context.stroke();
    context.globalAlpha /= 0.9 - ring * 0.2;
  }
  context.save();
  context.scale(pulse, pulse);
  context.rotate(Math.PI / 4);
  context.fillRect(-4, -4, 8, 8);
  context.restore();
  for (const x of [-30, 30]) {
    context.beginPath();
    context.arc(x, -2, 2.2, 0, Math.PI * 2);
    context.fill();
  }
}

function rotateForwardAxis([x, y, z, wing, vertexAlpha], angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [
    cosine * x - sine * y,
    sine * x + cosine * y,
    z,
    wing,
    vertexAlpha,
  ];
}

function projectLowPolyVertex(vertex, flap, roll) {
  const flapped = rotateForwardAxis(vertex, vertex[3] * flap);
  const banked = rotateForwardAxis(flapped, roll);
  const pixelsPerUnit = 38 * lowPolyBirdSpec.worldScale;
  return {
    x: banked[2] * pixelsPerUnit,
    y: (banked[0] - banked[1] * 0.72) * pixelsPerUnit,
    alpha: banked[4],
  };
}

function facetGradient(context, vertices) {
  const ordered = [...vertices].sort((a, b) => b.alpha - a.alpha);
  const brightest = ordered[0];
  const darkest = ordered.at(-1);
  const gradient = context.createLinearGradient(
    brightest.x,
    brightest.y,
    darkest.x,
    darkest.y,
  );
  gradient.addColorStop(0, "rgba(213, 162, 75, 0.98)");
  gradient.addColorStop(
    1,
    `rgba(213, 162, 75, ${Math.max(0.28, darkest.alpha * 0.82)})`,
  );
  return gradient;
}

function lowPolyBird(context, time, phase, roll) {
  const seconds = time / 1_000;
  const flap =
    lowPolyBirdSpec.wingFlapRadians *
    Math.sin(
      2 * Math.PI * lowPolyBirdSpec.flapFrequencyHz * seconds + phase,
    );
  const resolvedRoll =
    roll ??
    Math.sin(seconds * lowPolyBirdSpec.rollResponse + phase * 0.5) *
      lowPolyBirdSpec.maxRollRadians *
      0.62;

  context.lineJoin = "round";
  context.lineWidth = 0.8;
  context.shadowColor = visualStyle.palette.seed;
  context.shadowBlur = 9;

  for (const triangle of lowPolyBirdSpec.triangles) {
    const vertices = triangle.map((vertex) =>
      projectLowPolyVertex(vertex, flap, resolvedRoll),
    );
    context.beginPath();
    context.moveTo(vertices[0].x, vertices[0].y);
    context.lineTo(vertices[1].x, vertices[1].y);
    context.lineTo(vertices[2].x, vertices[2].y);
    context.closePath();
    context.fillStyle = facetGradient(context, vertices);
    context.fill();
    context.strokeStyle = "rgba(231, 238, 240, 0.26)";
    context.stroke();
  }

  context.shadowBlur = 0;
  context.fillStyle = "rgba(231, 238, 240, 0.72)";
  context.beginPath();
  context.arc(0.65 * 38 * lowPolyBirdSpec.worldScale, -1.4, 1.35, 0, Math.PI * 2);
  context.fill();
}

export function drawBirdVariant(
  context,
  id,
  {
    x = 0,
    y = 0,
    angle = 0,
    scale = 1,
    time = 0,
    alpha = 1,
    phase = 0,
    roll,
    flap,
    glow = 0.35,
    fogAmount = 0,
    silhouette = "swallow",
  } = {},
) {
  const variant = variantById(id);
  const birdStyle = variant.birdStyle || id;
  if (birdStyle === "soft-wing") {
    return drawBirdArt(context, {
      x,
      y,
      angle,
      scale,
      time,
      alpha,
      phase,
      flap,
      glow,
      fogAmount,
      silhouette,
    });
  }
  context.save();
  context.globalAlpha = alpha;
  context.translate(x, y);
  context.rotate(angle);
  context.scale(scale, scale);
  if (birdStyle === "folded-grove") foldedBird(context, time);
  else if (birdStyle === "ink-vein") inkBird(context, time);
  else if (birdStyle === "signal-canopy") signalBird(context, time);
  else lowPolyBird(context, time, phase, roll);
  context.restore();
}

function foldedTree(context, size, variant) {
  context.strokeStyle = "rgba(231, 238, 240, 0.66)";
  context.fillStyle = "rgba(116, 169, 165, 0.23)";
  context.lineWidth = 1.1;
  context.beginPath();
  context.moveTo(0, 4);
  context.lineTo(0, -size * 0.55);
  context.stroke();
  const layers = 3;
  for (let layer = 0; layer < layers; layer += 1) {
    const y = -size * (0.42 + layer * 0.22);
    const width = size * (0.5 - layer * 0.08);
    const height = size * (0.37 - layer * 0.035);
    context.beginPath();
    if ((variant + layer) % 2 === 0) {
      context.moveTo(0, y - height);
      context.lineTo(width, y + height * 0.55);
      context.lineTo(0, y + height);
      context.lineTo(-width, y + height * 0.55);
    } else {
      context.moveTo(-width, y + height * 0.42);
      context.lineTo(-width * 0.18, y - height);
      context.lineTo(width, y + height * 0.28);
      context.lineTo(0, y + height);
    }
    context.closePath();
    context.fill();
    context.strokeStyle =
      layer === 0
        ? visualStyle.palette.leaf
        : "rgba(116, 169, 165, 0.58)";
    context.stroke();
  }
}

function signalTree(context, size, variant, count) {
  context.strokeStyle = visualStyle.palette.leaf;
  context.fillStyle = visualStyle.palette.leaf;
  context.lineCap = "round";
  context.lineWidth = 1.2;
  context.beginPath();
  context.moveTo(0, 4);
  context.lineTo(0, -size * 0.82);
  context.moveTo(0, -size * 0.35);
  context.lineTo(-size * 0.25, -size * 0.56);
  context.moveTo(0, -size * 0.52);
  context.lineTo(size * 0.3, -size * 0.7);
  context.stroke();
  const rings = Math.min(5, 2 + Math.floor(Math.log2(count + 1)));
  for (let ring = 1; ring <= rings; ring += 1) {
    const width = size * (0.16 + ring * 0.11);
    const height = size * (0.11 + ring * 0.085);
    context.globalAlpha *= 0.82 - ring * 0.08;
    context.beginPath();
    context.ellipse(
      0,
      -size * 0.72,
      width,
      height,
      variant * 0.08,
      0,
      Math.PI * 2,
    );
    context.stroke();
    context.globalAlpha /= 0.82 - ring * 0.08;
  }
  const nodes = [
    [-0.25, -0.56],
    [0.3, -0.7],
    [0, -0.82],
  ];
  for (const [nx, ny] of nodes) {
    context.beginPath();
    context.arc(nx * size, ny * size, 2.3, 0, Math.PI * 2);
    context.fill();
  }
}

export function drawTreeVariant(
  context,
  id,
  {
    x = 0,
    y = 0,
    size = 48,
    variant = 0,
    count = 1,
    time = 0,
    alpha = 1,
    seed,
    growth,
  } = {},
) {
  const artVariant = variantById(id);
  context.save();
  context.globalAlpha = alpha;
  context.translate(x, y);
  const treeStyle = artVariant.treeStyle || id;
  if (treeStyle === "folded-grove") foldedTree(context, size, variant);
  else if (treeStyle === "ink-vein") {
    drawTreeArt(context, {
      seed: seed ?? `art-lab-${variant}`,
      size,
      growth,
    });
  }
  else signalTree(context, size, variant, count);
  context.restore();
}
