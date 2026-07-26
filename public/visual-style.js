function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const visualStyle = deepFreeze({
  schemaVersion: 1,
  concept: "闇の中で、通信が育つ。",
  palette: {
    night: "#0b252c",
    nightLift: "#12333b",
    paper: "#e7eef0",
    mist: "#9dbbc0",
    leaf: "#74a9a5",
    seed: "#d5a24b",
    route: "#b8ded5",
    fault: "#c77968",
    ink: "#17363d",
  },
  typography: {
    display:
      '"Yu Mincho", "Hiragino Mincho ProN", "Hiragino Mincho Pro", "Noto Serif JP", serif',
    body:
      '"BIZ UDPGothic", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif',
    utility: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
  },
  strokes: {
    atmosphere: 1,
    object: 1.2,
    active: 2.2,
    minimumScreen: 0.8,
  },
  motion: {
    seedDropMs: 720,
    featherDriftMs: 4_200,
    letterFoldMs: 3_200,
    planeControlDelayMs: 520,
    routeHighlightMs: 5_000,
    fogBaseMs: 8_000,
    planeFlightMs: 11_000,
    routeMinimumMs: 5_200,
    routeStepMs: 1_050,
    birdFlightSpeedPxPerSecond: 160,
  },
  physics: {
    plane: {
      windStrength: 104,
      controlStrength: 80,
      drag: 1.15,
      maxSpeed: 230,
      headingResponse: 36,
      inputTimeoutMs: 360,
      calmThreshold: 0.035,
      minimumGlideSpeed: 24,
      glideStrength: 36,
      flowReturnStrength: 42,
      edgeReturnStrength: 150,
      edgeInset: 110,
    },
    wind: {
      seed: 411,
      scale: 0.0036,
      timeScale: 1,
      maximum: 1,
      baseInfluence: 0,
      treeInfluence: 0.52,
      treeRadius: 260,
    },
  },
  density: {
    activeBirds: 3,
    ambientWindMotes: 300,
    performanceTrees: 220,
    performanceFogs: 12,
    performancePlanes: 32,
  },
  principles: [
    "発光は到着と記憶にだけ使う。",
    "未観測区間を実在する線で結ばない。",
    "物体は輪郭より余白と移動で識別する。",
    "一つの経路演出の主役は常に一羽の鳥にする。",
    "霧は局所的かつ有限時間に留める。",
  ],
});

export const assetContract = deepFreeze({
  schemaVersion: 1,
  coordinateSystem: "center-origin normalized -1..1",
  assets: {
    bird: {
      anchor: "body-center",
      forwardAxis: "+x",
      nominalSize: [48, 22],
      requiredStates: ["glide", "flap"],
      replaceWith: ["procedural", "svg-path", "sprite", "rive"],
    },
    tree: {
      anchor: "trunk-ground",
      forwardAxis: "-y",
      nominalSize: [72, 116],
      requiredStates: ["seedling", "grown"],
      replaceWith: ["procedural", "svg-path", "sprite"],
    },
    seed: {
      anchor: "center",
      forwardAxis: "+y",
      nominalSize: [7, 11],
      requiredStates: ["fall"],
      replaceWith: ["procedural", "svg-path", "sprite"],
    },
    feather: {
      anchor: "shaft-center",
      forwardAxis: "+y",
      nominalSize: [12, 20],
      requiredStates: ["drift"],
      replaceWith: ["procedural", "svg-path", "sprite"],
    },
    letter: {
      anchor: "center",
      forwardAxis: "+x",
      nominalSize: [20, 14],
      requiredStates: [
        "dropping",
        "closed",
        "opening",
        "readable",
        "folding",
      ],
      replaceWith: ["procedural", "svg-path", "rive"],
    },
    plane: {
      anchor: "fold-center",
      forwardAxis: "+x",
      nominalSize: [29, 16],
      requiredStates: ["plane", "controllable", "flight"],
      replaceWith: ["procedural", "svg-path", "sprite", "rive"],
    },
    fog: {
      anchor: "center",
      forwardAxis: "none",
      nominalSize: [144, 84],
      requiredStates: ["appear", "hold", "fade"],
      replaceWith: ["procedural-texture", "sprite", "shader"],
    },
  },
});
