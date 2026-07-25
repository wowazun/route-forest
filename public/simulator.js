import { createBirdSequence } from "./experience-contract.js";
import {
  createSimulation,
  listSimulationScenarios,
} from "./simulator-scenarios.js";

const scenarioList = document.querySelector("#scenario-list");
const scenarioGroup = document.querySelector("#scenario-group");
const scenarioTitle = document.querySelector("#scenario-title");
const scenarioDescription = document.querySelector("#scenario-description");
const rerunScenario = document.querySelector("#rerun-scenario");
const openDisplay = document.querySelector("#open-display");
const routeTape = document.querySelector("#route-tape");
const routeNote = document.querySelector("#route-note");
const observationJson = document.querySelector("#observation-json");
const sequenceJson = document.querySelector("#sequence-json");
const measureRoutes = document.querySelector("#measure-routes");
const measureTrees = document.querySelector("#measure-trees");
const measureFogs = document.querySelector("#measure-fogs");
const measureDuration = document.querySelector("#measure-duration");

const scenarios = listSimulationScenarios();
const groupLabels = Object.freeze({
  route: "経路構造 / ROUTE SHAPE",
  load: "同時参加・負荷 / FIELD LOAD",
  transport: "接続・障害 / TRANSPORT",
});
const searchParameters = new URLSearchParams(window.location.search);
let selectedId = scenarios.some(
  (scenario) => scenario.id === searchParameters.get("scenario"),
)
  ? searchParameters.get("scenario")
  : "all-new";
let runNumber = 0;

function scenarioButton(scenario, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "scenario-button";
  button.dataset.scenario = scenario.id;
  button.innerHTML = `<span>${String(index + 1).padStart(2, "0")}</span><span>${scenario.label}</span>`;
  button.addEventListener("click", () => selectScenario(scenario.id));
  return button;
}

function renderScenarioList() {
  let previousGroup = null;
  for (const [index, scenario] of scenarios.entries()) {
    if (scenario.group !== previousGroup) {
      const label = document.createElement("span");
      label.className = "scenario-list-label";
      label.textContent = groupLabels[scenario.group];
      scenarioList.append(label);
      previousGroup = scenario.group;
    }
    scenarioList.append(scenarioButton(scenario, index));
  }
}

function appendTree(waypoint) {
  const element = document.createElement("div");
  element.className = "route-step tree";
  if (waypoint.nodes.some((node) => node.reachedTarget)) {
    element.classList.add("is-target");
  }
  const label = document.createElement("span");
  label.textContent = `H${waypoint.hop}`;
  element.append(label);
  element.title = `${waypoint.nodes.length} node(s) / hop ${waypoint.hop}`;
  routeTape.append(element);
}

function appendFog(waypoint) {
  const element = document.createElement("div");
  element.className = "route-step fog";
  element.style.setProperty(
    "--fog-width",
    `${Math.min(138, 42 + waypoint.hopCount * 18)}px`,
  );
  const label = document.createElement("span");
  label.textContent = `${waypoint.hopCount} HOPS`;
  element.append(label);
  element.title = `Unknown hops ${waypoint.startHop}–${waypoint.endHop}`;
  routeTape.append(element);
}

function appendConnection(event) {
  const element = document.createElement("div");
  element.className = "connection-step";
  element.dataset.state = event.state;
  element.textContent = `${(event.atMs / 1000).toFixed(1)}s / ${event.label}`;
  routeTape.append(element);
}

function appendSeparator() {
  const separator = document.createElement("i");
  separator.className = "tape-separator";
  separator.setAttribute("aria-hidden", "true");
  routeTape.append(separator);
}

function renderTape(events) {
  routeTape.replaceChildren();
  let renderedRoutes = 0;
  for (const event of events) {
    if (event.type === "connection") {
      appendConnection(event);
      continue;
    }
    const sequence = createBirdSequence(event.observation);
    if (renderedRoutes > 0) appendSeparator();
    for (const waypoint of sequence.waypoints) {
      if (waypoint.kind === "tree") appendTree(waypoint);
      else appendFog(waypoint);
    }
    renderedRoutes += 1;
  }
  routeNote.textContent =
    events.length > 18
      ? `${events.length} EVENTS / 横にスクロールして全体を確認`
      : `${events.length} EVENTS / CONTRACT VALIDATED`;
}

function metrics(events) {
  const observations = events.filter((event) => event.type === "observation");
  const nodeIds = new Set();
  let fogs = 0;
  for (const event of observations) {
    const sequence = createBirdSequence(event.observation);
    for (const waypoint of sequence.waypoints) {
      if (waypoint.kind === "fog") fogs += 1;
      else {
        for (const node of waypoint.nodes) nodeIds.add(node.nodeId);
      }
    }
  }
  return {
    observations,
    trees: nodeIds.size,
    fogs,
    durationMs: Math.max(0, ...events.map((event) => event.atMs)),
  };
}

function renderContracts(events) {
  const event = events.find((item) => item.type === "observation");
  if (!event) {
    const timeline = {
      schemaVersion: 1,
      kind: "transport-timeline",
      events,
    };
    observationJson.textContent = JSON.stringify(timeline, null, 2);
    sequenceJson.textContent =
      "このシナリオは観測データを生成しません。\n接続状態だけを展示へ送ります。";
    return;
  }
  observationJson.textContent = JSON.stringify(event.observation, null, 2);
  sequenceJson.textContent = JSON.stringify(
    createBirdSequence(event.observation),
    null,
    2,
  );
}

function renderSelectedScenario() {
  const scenario = scenarios.find((item) => item.id === selectedId);
  runNumber += 1;
  const simulation = createSimulation(selectedId, {
    runId: `${selectedId}-preview-${runNumber}`,
    startedAt: Date.parse("2026-07-25T12:00:00.000Z"),
  });
  const summary = metrics(simulation.events);

  scenarioGroup.textContent = groupLabels[scenario.group];
  scenarioTitle.textContent = scenario.label;
  scenarioDescription.textContent = scenario.description;
  measureRoutes.textContent = String(summary.observations.length);
  measureTrees.textContent = String(summary.trees);
  measureFogs.textContent = String(summary.fogs);
  measureDuration.textContent = `${(summary.durationMs / 1000).toFixed(1)}s`;
  openDisplay.href = `/display?simulation=${encodeURIComponent(selectedId)}`;

  for (const button of scenarioList.querySelectorAll(".scenario-button")) {
    const selected = button.dataset.scenario === selectedId;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }

  renderTape(simulation.events);
  renderContracts(simulation.events);
}

function selectScenario(id) {
  if (!scenarios.some((scenario) => scenario.id === id)) return;
  selectedId = id;
  const url = new URL(window.location.href);
  url.searchParams.set("scenario", id);
  window.history.replaceState({}, "", url);
  renderSelectedScenario();
}

rerunScenario.addEventListener("click", renderSelectedScenario);
renderScenarioList();
renderSelectedScenario();

window.__routeForestSimulator = Object.freeze({
  snapshot: () => {
    const simulation = createSimulation(selectedId, {
      runId: `${selectedId}-snapshot`,
      startedAt: Date.parse("2026-07-25T12:00:00.000Z"),
    });
    return {
      selectedId,
      eventCount: simulation.events.length,
      metrics: metrics(simulation.events),
    };
  },
});
