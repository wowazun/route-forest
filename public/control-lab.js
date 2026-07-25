import {
  combinePlaneForces,
  createCurlNoise,
  integratePlane,
} from "./flow-field.js";

const canvas = document.querySelector("#wind-canvas");
const context = canvas.getContext("2d", { alpha: true });
const stage = document.querySelector(".wind-stage");
const controlPad = document.querySelector("#control-pad");
const controlKnob = document.querySelector("#control-knob");
const windNeedle = document.querySelector("#wind-needle");
const forceNeedle = document.querySelector("#force-needle");
const windStrength = document.querySelector("#wind-strength");
const controlStrength = document.querySelector("#control-strength");
const inertia = document.querySelector("#inertia");
const windStrengthOutput = document.querySelector("#wind-strength-output");
const controlStrengthOutput = document.querySelector(
  "#control-strength-output",
);
const inertiaOutput = document.querySelector("#inertia-output");
const windForceValue = document.querySelector("#wind-force-value");
const controlForceValue = document.querySelector("#control-force-value");
const speedValue = document.querySelector("#speed-value");
const balanceRatio = document.querySelector("#balance-ratio");
const balanceFill = document.querySelector("#balance-fill");
const labStatus = document.querySelector("#lab-status");
const resetPlaneButton = document.querySelector("#reset-plane");
const presetButtons = [...document.querySelectorAll("[data-preset]")];

const field = createCurlNoise({ seed: 411, scale: 0.0036, octaves: 3 });
const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
const keyState = new Set();
const palette = Object.freeze({
  night: "#0b252c",
  mist: "#9dbbc0",
  leaf: "#74a9a5",
  paper: "#e7eef0",
  seed: "#d5a24b",
});

const state = {
  width: 0,
  height: 0,
  pixelRatio: 1,
  lastFrame: performance.now(),
  lastTelemetryAt: 0,
  timeSeconds: 0,
  control: { x: 0, y: 0 },
  activePointer: null,
  plane: { x: 0, y: 0, vx: 52, vy: -4 },
  wind: { x: 0, y: 0 },
  forces: combinePlaneForces({
    wind: { x: 0, y: 0 },
    control: { x: 0, y: 0 },
  }),
  particles: [],
  trail: [],
};

function randomFrom(seed) {
  let value = seed || 1;
  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function magnitude(vector) {
  return Math.hypot(vector.x, vector.y);
}

function resetPlane() {
  state.plane = {
    x: state.width * 0.58,
    y: state.height * 0.53,
    vx: 52,
    vy: -4,
  };
  state.trail.length = 0;
}

  function seedParticles() {
    const random = randomFrom(411);
    const count = reducedMotion
      ? 54
      : Math.max(96, Math.min(180, Math.round(state.width / 7)));
    state.particles = Array.from({ length: count }, () => ({
      x: random() * state.width,
      y: random() * state.height,
      age: random() * 8,
      life: 5 + random() * 7,
      size: 1.6 + random() * 1.8,
      brightness: 0.65 + random() * 0.35,
      trail: 8 + random() * 11,
    }));
  }

function resize() {
  const rect = stage.getBoundingClientRect();
  state.width = rect.width;
  state.height = rect.height;
  state.pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(rect.width * state.pixelRatio);
  canvas.height = Math.round(rect.height * state.pixelRatio);
  context.setTransform(
    state.pixelRatio,
    0,
    0,
    state.pixelRatio,
    0,
    0,
  );
  seedParticles();
  resetPlane();
}

function setControl(vector) {
  const rawMagnitude = magnitude(vector);
  const scale = rawMagnitude > 1 ? 1 / rawMagnitude : 1;
  state.control = {
    x: vector.x * scale,
    y: vector.y * scale,
  };
  const travel = controlPad.clientWidth * 0.32;
  controlKnob.style.transform = `translate(calc(-50% + ${
    state.control.x * travel
  }px), calc(-50% + ${state.control.y * travel}px))`;
}

function setControlFromPointer(clientX, clientY) {
  const rect = controlPad.getBoundingClientRect();
  const radius = rect.width * 0.36;
  setControl({
    x: (clientX - (rect.left + rect.width / 2)) / radius,
    y: (clientY - (rect.top + rect.height / 2)) / radius,
  });
}

function releasePointer(pointerId) {
  if (state.activePointer !== pointerId) return;
  state.activePointer = null;
  controlPad.classList.remove("is-active");
  setControl({ x: 0, y: 0 });
}

controlPad.addEventListener("pointerdown", (event) => {
  state.activePointer = event.pointerId;
  controlPad.setPointerCapture(event.pointerId);
  controlPad.classList.add("is-active");
  setControlFromPointer(event.clientX, event.clientY);
});
controlPad.addEventListener("pointermove", (event) => {
  if (state.activePointer !== event.pointerId) return;
  setControlFromPointer(event.clientX, event.clientY);
});
controlPad.addEventListener("pointerup", (event) => {
  releasePointer(event.pointerId);
});
controlPad.addEventListener("pointercancel", (event) => {
  releasePointer(event.pointerId);
});

const controlledKeys = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "w",
  "a",
  "s",
  "d",
]);

window.addEventListener("keydown", (event) => {
  if (!controlledKeys.has(event.key)) return;
  event.preventDefault();
  keyState.add(event.key);
});
window.addEventListener("keyup", (event) => {
  keyState.delete(event.key);
});
window.addEventListener("blur", () => {
  keyState.clear();
  if (state.activePointer !== null) releasePointer(state.activePointer);
});

function updateKeyboardControl() {
  if (state.activePointer !== null) return;
  const x =
    Number(keyState.has("ArrowRight") || keyState.has("d")) -
    Number(keyState.has("ArrowLeft") || keyState.has("a"));
  const y =
    Number(keyState.has("ArrowDown") || keyState.has("s")) -
    Number(keyState.has("ArrowUp") || keyState.has("w"));
  setControl({ x, y });
}

const presets = Object.freeze({
  calm: { wind: 12, control: 76, inertia: 1.35 },
  exhibition: { wind: 26, control: 80, inertia: 1.15 },
  strong: { wind: 44, control: 96, inertia: 0.9 },
});

function selectPreset(name) {
  const preset = presets[name];
  if (!preset) return;
  windStrength.value = String(preset.wind);
  controlStrength.value = String(preset.control);
  inertia.value = String(preset.inertia);
  for (const button of presetButtons) {
    button.classList.toggle("is-selected", button.dataset.preset === name);
  }
  updateTuningLabels();
}

for (const button of presetButtons) {
  button.addEventListener("click", () => selectPreset(button.dataset.preset));
}

for (const input of [windStrength, controlStrength, inertia]) {
  input.addEventListener("input", () => {
    for (const button of presetButtons) button.classList.remove("is-selected");
    updateTuningLabels();
  });
}

function updateTuningLabels() {
  const wind = Number(windStrength.value);
  const control = Number(controlStrength.value);
  const ratio = control / Math.max(1, wind + control);
  const passes = control >= wind * 2.4;

  windStrengthOutput.textContent = String(wind);
  controlStrengthOutput.textContent = String(control);
  inertiaOutput.textContent = Number(inertia.value).toFixed(2);
  balanceRatio.textContent = `${Math.round(ratio * 100)}%`;
  balanceFill.style.setProperty("--balance", `${ratio * 100}%`);
  labStatus.textContent = passes
    ? "操作が風に勝つ設定です"
    : "風が強く、操作が埋もれる可能性があります";
  labStatus.classList.toggle("is-warning", !passes);
}

function wrapPlane() {
  const margin = 36;
  if (state.plane.x < -margin) state.plane = { ...state.plane, x: state.width + margin };
  if (state.plane.x > state.width + margin) state.plane = { ...state.plane, x: -margin };
  if (state.plane.y < -margin) state.plane = { ...state.plane, y: state.height + margin };
  if (state.plane.y > state.height + margin) state.plane = { ...state.plane, y: -margin };
}

function updateScene(deltaSeconds) {
  updateKeyboardControl();
  state.timeSeconds += deltaSeconds * (reducedMotion ? 0.45 : 1);
  state.wind = field.sample(
    state.plane.x,
    state.plane.y,
    state.timeSeconds,
  );
  state.forces = combinePlaneForces({
    wind: state.wind,
    control: state.control,
    windStrength: Number(windStrength.value),
    controlStrength: Number(controlStrength.value),
  });
  state.plane = integratePlane(
    state.plane,
    state.forces.totalForce,
    deltaSeconds,
    {
      drag: Number(inertia.value),
      maxSpeed: 230,
    },
  );
  wrapPlane();

  state.trail.push({ x: state.plane.x, y: state.plane.y });
  if (state.trail.length > 64) state.trail.shift();

  for (const particle of state.particles) {
    const wind = field.sample(particle.x, particle.y, state.timeSeconds);
    particle.x += wind.x * deltaSeconds * 36;
    particle.y += wind.y * deltaSeconds * 36;
    particle.age += deltaSeconds;
    if (
      particle.age > particle.life ||
      particle.x < -20 ||
      particle.x > state.width + 20 ||
      particle.y < -20 ||
      particle.y > state.height + 20
    ) {
      const random = randomFrom(
        Math.floor(state.timeSeconds * 1000) + Math.floor(particle.life * 997),
      );
      particle.x = random() < 0.5 ? 0 : random() * state.width;
      particle.y = random() * state.height;
      particle.age = 0;
      particle.life = 5 + random() * 7;
    }
  }
}

function drawField() {
  context.save();
  context.lineCap = "round";
  const spacing = Math.max(58, state.width / 17);
  for (let y = spacing * 0.7; y < state.height; y += spacing) {
    for (let x = spacing * 0.6; x < state.width; x += spacing) {
      const wind = field.sample(x, y, state.timeSeconds);
      const length = Math.min(30, 7 + magnitude(wind) * 13);
      const angle = Math.atan2(wind.y, wind.x);
      context.strokeStyle = "rgba(157, 187, 192, 0.16)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x - Math.cos(angle) * length, y - Math.sin(angle) * length);
      context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      context.stroke();
    }
  }

  for (const particle of state.particles) {
    const wind = field.sample(particle.x, particle.y, state.timeSeconds);
    const windMagnitude = Math.max(0.001, magnitude(wind));
    const alpha =
      Math.sin(Math.min(1, particle.age / particle.life) * Math.PI) *
      0.66 *
      particle.brightness;
    const directionX = wind.x / windMagnitude;
    const directionY = wind.y / windMagnitude;

    context.fillStyle = `rgba(184, 222, 213, ${alpha})`;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = `rgba(116, 169, 165, ${alpha * 0.65})`;
    context.lineWidth = Math.max(0.8, particle.size * 0.55);
    context.beginPath();
    context.moveTo(particle.x, particle.y);
    context.lineTo(
      particle.x - directionX * particle.trail,
      particle.y - directionY * particle.trail,
    );
    context.stroke();
  }
  context.restore();
}

function drawTrail() {
  if (state.trail.length < 2) return;
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  for (let index = 1; index < state.trail.length; index += 1) {
    const from = state.trail[index - 1];
    const to = state.trail[index];
    context.strokeStyle = `rgba(213, 162, 75, ${
      (index / state.trail.length) * 0.34
    })`;
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  }
  context.restore();
}

function drawPlane() {
  const angle = Math.atan2(state.plane.vy, state.plane.vx);
  context.save();
  context.translate(state.plane.x, state.plane.y);
  context.rotate(angle);
  context.shadowColor = palette.paper;
  context.shadowBlur = 18;
  context.fillStyle = palette.paper;
  context.strokeStyle = "rgba(23, 54, 61, 0.72)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(-17, -9);
  context.lineTo(21, 0);
  context.lineTo(-14, 11);
  context.lineTo(-5, 2);
  context.closePath();
  context.fill();
  context.stroke();
  context.strokeStyle = "rgba(23, 54, 61, 0.45)";
  context.beginPath();
  context.moveTo(-14, -8);
  context.lineTo(-5, 2);
  context.lineTo(20, 0);
  context.stroke();
  context.restore();
}

function draw() {
  context.clearRect(0, 0, state.width, state.height);
  drawField();
  drawTrail();
  drawPlane();
}

function setNeedle(element, vector, maximum) {
  const forceMagnitude = magnitude(vector);
  const angle = Math.atan2(vector.y, vector.x) * (180 / Math.PI);
  element.style.setProperty("--needle-angle", `${angle}deg`);
  element.style.setProperty(
    "--needle-scale",
    String(Math.min(1, forceMagnitude / Math.max(1, maximum))),
  );
}

function updateTelemetry(now) {
  if (now - state.lastTelemetryAt < 100) return;
  state.lastTelemetryAt = now;
  windForceValue.textContent = magnitude(state.forces.windForce).toFixed(0);
  controlForceValue.textContent = magnitude(
    state.forces.controlForce,
  ).toFixed(0);
  speedValue.textContent = magnitude({
    x: state.plane.vx,
    y: state.plane.vy,
  }).toFixed(0);
  setNeedle(windNeedle, state.forces.windForce, 70);
  setNeedle(forceNeedle, state.forces.totalForce, 120);
}

function frame(now) {
  const deltaSeconds = Math.min(0.05, (now - state.lastFrame) / 1000);
  state.lastFrame = now;
  updateScene(deltaSeconds);
  draw();
  updateTelemetry(now);
  requestAnimationFrame(frame);
}

resetPlaneButton.addEventListener("click", resetPlane);
window.addEventListener("resize", resize);
resize();
updateTuningLabels();
requestAnimationFrame(frame);

window.__routeForestControlLab = Object.freeze({
  snapshot: () => ({
    windStrength: Number(windStrength.value),
    controlStrength: Number(controlStrength.value),
    inertia: Number(inertia.value),
    planeSpeed: magnitude({ x: state.plane.vx, y: state.plane.vy }),
    control: { ...state.control },
  }),
});
