import { treeDisplaySizeForCount } from "./tree-art.js?v=2";

const CONSENT_VERSION = "route-observation-v2";
const POLL_INTERVAL_MS = 350;
const POLL_DEADLINE_MS = 30_000;

const panels = {
  intro: document.querySelector("#intro-panel"),
  measuring: document.querySelector("#measuring-panel"),
  result: document.querySelector("#result-panel"),
  error: document.querySelector("#error-panel"),
};

const consentForm = document.querySelector("#consent-form");
const websiteInput = document.querySelector("#website-input");
const consentCheckbox = document.querySelector("#consent-checkbox");
const startButton = document.querySelector("#start-button");
const formMessage = document.querySelector("#form-message");
const elapsedLabel = document.querySelector("#elapsed-label");
const resultKicker = document.querySelector("#result-kicker");
const resultTitle = document.querySelector("#result-title");
const resultMessage = document.querySelector("#result-message");
const observedCount = document.querySelector("#observed-count");
const unknownCount = document.querySelector("#unknown-count");
const destinationHost = document.querySelector("#destination-host");
const routeMap = document.querySelector("#route-map");
const errorKicker = document.querySelector("#error-kicker");
const errorTitle = document.querySelector("#error-title");
const errorMessage = document.querySelector("#error-message");
const errorGuidance = document.querySelector("#error-guidance");
const returnButton = document.querySelector("#return-button");
const errorReturnButton = document.querySelector("#error-return-button");
const controllerPanel = document.querySelector("#controller-panel");
const controllerConnection = document.querySelector("#controller-connection");
const controllerConnectionLabel = document.querySelector(
  "#controller-connection-label",
);
const controllerTitle = document.querySelector("#controller-title");
const controllerState = document.querySelector("#controller-state");
const controllerPad = document.querySelector("#controller-pad");
const controllerKnob = document.querySelector("#controller-knob");
const controllerX = document.querySelector("#controller-x");
const controllerY = document.querySelector("#controller-y");
const controllerEnded = document.querySelector("#controller-ended");
const controllerInputStatus = document.querySelector(
  "#controller-input-status",
);
const controllerColorSwatch = document.querySelector(
  "#controller-color-swatch",
);
const routeHighlightButton = document.querySelector(
  "#route-highlight-button",
);
const aboutWork = document.querySelector("#about-work");
const uiPreviewToolbar = document.querySelector("#ui-preview-toolbar");
const uiPreviewState = document.querySelector("#ui-preview-state");

let elapsedTimer = null;
let controllerCredentials = null;
let controllerStatusTimer = null;
let controllerInputTimer = null;
let controllerPointer = null;
let controllerVector = { x: 0, y: 0 };
let controllerSequence = 0;
let controllerCanControl = false;
let controllerRouteReady = false;
let lastControllerSendAt = 0;
let suppressControllerClickUntil = 0;
const CONTROLLER_STORAGE_KEY = "route-forest-controller-v1";

function setPanel(name) {
  for (const [panelName, panel] of Object.entries(panels)) {
    panel.hidden = panelName !== name;
  }
  panels[name].scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetExperience() {
  endControllerSession();
  clearInterval(elapsedTimer);
  elapsedTimer = null;
  consentCheckbox.checked = false;
  websiteInput.value = "";
  startButton.disabled = false;
  formMessage.textContent = "";
  routeMap.replaceChildren();
  controllerPanel.hidden = true;
  setPanel("intro");
}

function startElapsedClock() {
  const startedAt = Date.now();
  elapsedLabel.textContent = "観測開始から 0 秒";
  clearInterval(elapsedTimer);
  elapsedTimer = setInterval(() => {
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    elapsedLabel.textContent = `観測開始から ${seconds} 秒`;
  }, 1_000);
}

async function readResponse(response) {
  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const error = new Error(body?.error?.message || "Request failed");
    error.code = body?.error?.code || "request_failed";
    error.status = response.status;
    throw error;
  }
  return body;
}

function controllerHeaders() {
  return {
    authorization: `Bearer ${controllerCredentials?.token || ""}`,
  };
}

function storeControllerCredentials(measurementId, controller) {
  if (!controller?.sessionId || !controller?.token) return;
  controllerCredentials = {
    measurementId,
    sessionId: controller.sessionId,
    token: controller.token,
    color: /^#[0-9a-f]{6}$/i.test(controller.color || "")
      ? controller.color
      : "#d5a24b",
    expiresAt: controller.expiresAt,
  };
  sessionStorage.setItem(
    CONTROLLER_STORAGE_KEY,
    JSON.stringify(controllerCredentials),
  );
}

function applyControllerColor() {
  const color = /^#[0-9a-f]{6}$/i.test(controllerCredentials?.color || "")
    ? controllerCredentials.color
    : "#d5a24b";
  controllerPanel.style.setProperty("--participant-color", color);
  controllerColorSwatch.title = color;
}

function setControllerConnection(mode, label) {
  controllerConnection.className = "controller-connection";
  if (mode) controllerConnection.classList.add(mode);
  controllerConnectionLabel.textContent = label;
}

function ensureControllerPadGeometry() {
  const viewportWidth =
    document.documentElement.clientWidth || window.innerWidth || 320;
  const viewportHeight =
    document.documentElement.clientHeight || window.innerHeight || 640;
  const size = Math.max(
    196,
    Math.min(300, viewportWidth - 52, viewportHeight * 0.48),
  );
  controllerPad.style.width = `${size}px`;
  controllerPad.style.height = `${size}px`;
}

function setControllerVector(vector, { send = false, force = false } = {}) {
  const rawX = Number(vector?.x) || 0;
  const rawY = Number(vector?.y) || 0;
  const magnitude = Math.hypot(rawX, rawY);
  const scale = magnitude > 1 ? 1 / magnitude : 1;
  controllerVector = {
    x: Math.max(-1, Math.min(1, rawX * scale)),
    y: Math.max(-1, Math.min(1, rawY * scale)),
  };
  const travel = controllerPad.clientWidth * 0.29;
  controllerKnob.style.transform = `translate(calc(-50% + ${
    controllerVector.x * travel
  }px), calc(-50% + ${controllerVector.y * travel}px))`;
  controllerX.textContent = controllerVector.x.toFixed(2);
  controllerY.textContent = controllerVector.y.toFixed(2);
  if (send) sendControllerInput({ force });
}

async function sendControllerInput({ force = false } = {}) {
  if (!controllerCredentials || !controllerCanControl) return;
  const now = Date.now();
  if (!force && now - lastControllerSendAt < 80) return;
  lastControllerSendAt = now;
  controllerSequence += 1;
  const input = { ...controllerVector };
  try {
    const response = await fetch(
      `/api/controller/sessions/${controllerCredentials.sessionId}/input`,
      {
        method: "POST",
        headers: {
          ...controllerHeaders(),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          x: input.x,
          y: input.y,
          sequence: controllerSequence,
          inputAt: now,
        }),
        keepalive: force,
      },
    );
    if (response.status === 401 || response.status === 409) {
      controllerInputStatus.className =
        "controller-input-status is-error";
      controllerInputStatus.textContent =
        response.status === 409
          ? "紙飛行機の準備完了を待っています"
          : "操作セッションが終了しました";
      await updateControllerStatus();
      return;
    }
    if (response.status === 429) return;
    await readResponse(response);
    controllerInputStatus.className =
      "controller-input-status is-sending";
    controllerInputStatus.textContent =
      input.x === 0 && input.y === 0
        ? "入力を離しました。風に流されています"
        : `入力送信済み X ${input.x.toFixed(2)} / Y ${input.y.toFixed(2)}`;
  } catch (error) {
    controllerInputStatus.className =
      "controller-input-status is-error";
    controllerInputStatus.textContent = "入力を再送しています";
    setControllerConnection("is-reconnecting", "再接続中");
  }
}

function setControllerFromPointer(clientX, clientY) {
  const rect = controllerPad.getBoundingClientRect();
  const radius = rect.width * 0.36;
  setControllerVector(
    {
      x: (clientX - (rect.left + rect.width / 2)) / radius,
      y: (clientY - (rect.top + rect.height / 2)) / radius,
    },
    { send: true },
  );
}

function releaseControllerPointer(pointerId) {
  if (controllerPointer !== pointerId) return;
  controllerPointer = null;
  controllerPad.classList.remove("is-active");
  clearInterval(controllerInputTimer);
  controllerInputTimer = null;
  setControllerVector({ x: 0, y: 0 }, { send: true, force: true });
  if (
    !controllerCredentials &&
    document.body.classList.contains("is-ui-preview")
  ) {
    controllerInputStatus.className = "controller-input-status";
    controllerInputStatus.textContent = "円を押したまま動かしてください";
  }
}

const CONTROLLER_PHASE_COPY = Object.freeze({
  connecting: Object.freeze({
    title: "画面と接続しています",
    description: "そのまま少し待ってください。",
  }),
  measuring: Object.freeze({
    title: "経路を観測しています",
    description:
      "あなたが選んだサイトまでの経路を、一羽の鳥がたどっています。",
  }),
  carrying: Object.freeze({
    title: "鳥が通信の経路を進んでいます",
    description:
      "あなたが選んだサイトまでの経路を、一羽の鳥がたどっています。\n観測された中継地点は木として残り、以前通った木は少しずつ育ちます。見えない区間は霧になります。",
  }),
  opening: Object.freeze({
    title: "届いた情報を開いています",
    description: "届いた情報が、あなたの紙飛行機へ変わります。",
  }),
  preparing: Object.freeze({
    title: "紙飛行機を準備しています",
    description: "折り上がるまで、あと少しです。",
  }),
  controllable: Object.freeze({
    title: "あなたの紙飛行機",
    description:
      "指で動かしてください。\n紙飛行機は、あなたの操作と森を流れる情報の風の両方から影響を受けます。",
  }),
  reconnecting: Object.freeze({
    title: "接続を確かめています",
    description: "操作を止めて、画面との再接続を待っています。",
  }),
  ended: Object.freeze({
    title: "セッションが終了しました",
    description: "この紙飛行機は操作できなくなりました。",
  }),
});

function applyControllerStatus(status) {
  const phase = status?.phase || "connecting";
  const copy =
    CONTROLLER_PHASE_COPY[phase] || CONTROLLER_PHASE_COPY.connecting;
  controllerCanControl = status?.controllable === true;
  controllerRouteReady = status?.routeReady === true;
  controllerPanel.dataset.phase = phase;
  controllerTitle.textContent = status?.title || copy.title;
  controllerState.textContent = status?.description || copy.description;
  controllerPad.setAttribute(
    "aria-disabled",
    String(!controllerCanControl),
  );
  if (!controllerCanControl) {
    controllerInputStatus.className = "controller-input-status";
    controllerInputStatus.textContent =
      phase === "ended"
        ? "操作セッションが終了しました"
        : phase === "reconnecting"
          ? "再接続を待っています"
        : "紙飛行機の準備を待っています";
  } else if (controllerPointer === null) {
    controllerInputStatus.className = "controller-input-status";
    controllerInputStatus.textContent =
      "円を押したまま動かしてください";
  }
  routeHighlightButton.disabled = !controllerRouteReady;
  controllerEnded.hidden = phase !== "ended";
  if (phase === "ended") {
    setControllerConnection("is-ended", "終了");
    setControllerVector({ x: 0, y: 0 });
  } else if (phase === "reconnecting") {
    setControllerConnection("is-reconnecting", "再接続中");
  } else if (phase === "connecting") {
    setControllerConnection("", "接続中");
  } else {
    setControllerConnection("is-live", "接続済み");
  }
  if (phase === "controllable") {
    requestAnimationFrame(ensureControllerPadGeometry);
  }
}

async function updateControllerStatus() {
  if (!controllerCredentials) return;
  try {
    const response = await fetch(
      `/api/controller/sessions/${controllerCredentials.sessionId}`,
      {
        cache: "no-store",
        headers: controllerHeaders(),
      },
    );
    if (response.status === 401 || response.status === 404) {
      applyControllerStatus({ phase: "ended" });
      clearInterval(controllerStatusTimer);
      controllerStatusTimer = null;
      return;
    }
    applyControllerStatus(await readResponse(response));
  } catch {
    controllerCanControl = false;
    controllerRouteReady = false;
    controllerPanel.dataset.phase = "reconnecting";
    controllerPad.setAttribute("aria-disabled", "true");
    routeHighlightButton.disabled = true;
    setControllerConnection("is-reconnecting", "再接続中");
    controllerTitle.textContent = CONTROLLER_PHASE_COPY.reconnecting.title;
    controllerState.textContent =
      CONTROLLER_PHASE_COPY.reconnecting.description;
    controllerInputStatus.className =
      "controller-input-status is-error";
    controllerInputStatus.textContent = "再接続を待っています";
  }
}

function startControllerSession() {
  if (!controllerCredentials) return;
  applyControllerColor();
  controllerPanel.hidden = false;
  applyControllerStatus({
    phase: "connecting",
    controllable: false,
    routeReady: false,
  });
  clearInterval(controllerStatusTimer);
  updateControllerStatus();
  controllerStatusTimer = setInterval(updateControllerStatus, 750);
}

function endControllerSession() {
  clearInterval(controllerStatusTimer);
  clearInterval(controllerInputTimer);
  controllerStatusTimer = null;
  controllerInputTimer = null;
  if (controllerCredentials) {
    setControllerVector({ x: 0, y: 0 });
    fetch(
      `/api/controller/sessions/${controllerCredentials.sessionId}/end`,
      {
        method: "POST",
        headers: controllerHeaders(),
        keepalive: true,
      },
    ).catch(() => {});
  }
  controllerCredentials = null;
  controllerCanControl = false;
  sessionStorage.removeItem(CONTROLLER_STORAGE_KEY);
}

async function requestMeasurement(website) {
  const response = await fetch("/api/measurements", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      website,
      consentAccepted: true,
      consentVersion: CONSENT_VERSION,
    }),
  });
  return readResponse(response);
}

async function waitForMeasurement(measurementId) {
  const deadline = Date.now() + POLL_DEADLINE_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const response = await fetch(`/api/measurements/${measurementId}`, {
      cache: "no-store",
    });
    const record = await readResponse(response);
    if (record.status !== "queued" && record.status !== "running") {
      return record;
    }
  }
  const error = new Error("Measurement status polling timed out");
  error.code = "client_timeout";
  throw error;
}

function routeStepNode(step) {
  const item = document.createElement("li");
  item.className = "route-step";

  if (step.kind === "unknown-segment") {
    item.classList.add("fog-step");
    item.setAttribute(
      "aria-label",
      `${step.hopCount}ホップの観測できない区間`,
    );
    const fog = document.createElement("span");
    fog.className = "fog-symbol";
    fog.setAttribute("aria-hidden", "true");
    fog.append(
      document.createElement("span"),
      document.createElement("span"),
      document.createElement("span"),
    );
    const label = document.createElement("span");
    label.className = "fog-label";
    label.textContent = `見えない区間 · ${step.hopCount}`;
    item.append(fog, label);
    return item;
  }

  item.setAttribute("aria-label", `観測地点 ${step.hop}`);
  const tree = document.createElement("span");
  tree.className = "tree-symbol";
  tree.setAttribute("aria-hidden", "true");
  const treeVisitCount = step.nodes[0]?.treeVisitCount;
  const displaySize = treeDisplaySizeForCount(treeVisitCount);
  const treeScale = Math.max(0.72, Math.min(1.5, displaySize / 36));
  tree.style.setProperty("--tree-scale", treeScale.toFixed(3));
  const crown = document.createElement("span");
  crown.className = "tree-crown";
  const trunk = document.createElement("span");
  trunk.className = "tree-trunk";
  tree.append(crown, trunk);

  const label = document.createElement("span");
  label.className = "tree-hop";
  label.textContent =
    step.nodes.length > 1 ? `HOP ${step.hop} · ${step.nodes.length}` : `HOP ${step.hop}`;
  item.append(tree, label);
  return item;
}

function renderResult(record) {
  clearInterval(elapsedTimer);
  elapsedTimer = null;
  const observation = record.observation;
  const observedSteps = observation.steps.filter(
    (step) => step.kind === "observed-node",
  );
  const unknownSegments = observation.steps.filter(
    (step) => step.kind === "unknown-segment",
  );
  const unknownHops = unknownSegments.reduce(
    (total, segment) => total + segment.hopCount,
    0,
  );

  const copy = {
    destination_reached: {
      kicker: "ROUTE OBSERVED",
      title: "選んだサイトまで、道が見えました",
      message:
        "会場から選んだWebサイト方向へ、応答した中継点をたどりました。実際のブラウザ通信と同じ経路とは限りません。",
    },
    completed_without_destination: {
      kicker: "PARTIAL OBSERVATION",
      title: "道は、見えない先へ続いています",
      message:
        "探査は完了しましたが、選んだサイトの終点そのものからは応答がありませんでした。サイトの利用可否とは別の結果です。",
    },
    partial_timeout: {
      kicker: "PARTIAL OBSERVATION",
      title: "見える道と、見えない道",
      message:
        "応答した地点と、時間内には応答しなかった区間の両方が観測されました。",
    },
    timeout: {
      kicker: "LIMITED OBSERVATION",
      title: "今回は、道を捉えられませんでした",
      message:
        "通信は成立していますが、設定した観測時間内には中継点から応答を得られませんでした。",
    },
    partial_result: {
      kicker: "PARTIAL OBSERVATION",
      title: "道の一部が届きました",
      message:
        "計測処理は完全には終了しませんでしたが、それまでに応答した地点だけを観測結果として扱います。",
    },
  };
  const selected = copy[observation.termination.kind] || copy.partial_result;

  resultKicker.textContent = selected.kicker;
  resultTitle.textContent = selected.title;
  resultMessage.textContent = selected.message;
  observedCount.textContent = String(observedSteps.length);
  unknownCount.textContent = String(unknownHops);
  destinationHost.textContent =
    observation.destination?.hostname || record.destination?.hostname || "—";
  destinationHost.title = destinationHost.textContent;

  routeMap.replaceChildren(
    ...observation.steps.map((step) => routeStepNode(step)),
  );
  setPanel("result");
  startControllerSession();
}

function showError(error) {
  endControllerSession();
  clearInterval(elapsedTimer);
  elapsedTimer = null;

  const errors = {
    invalid_website: {
      kicker: "CHECK DESTINATION",
      title: "Webサイトを確認してください",
      message: "入力された文字列から、Webサイトのドメイン名を読み取れませんでした。",
      guidance: "example.com または https://example.com の形で入力してください。",
    },
    website_required: {
      kicker: "DESTINATION REQUIRED",
      title: "鳥の行き先を入力してください",
      message: "経路を観測するWebサイトが入力されていません。",
      guidance: "ドメイン名を一つ入力してください。",
    },
    website_not_allowed: {
      kicker: "DESTINATION NOT ALLOWED",
      title: "この行き先は選べません",
      message: "公開Webサイトのドメイン名だけを観測できます。",
      guidance: "IPアドレスや、組織内・家庭内の機器名は使用できません。",
    },
    unsupported_website_scheme: {
      kicker: "CHECK DESTINATION",
      title: "WebサイトのURLを入力してください",
      message: "HTTPまたはHTTPSのWebサイトだけを選べます。",
      guidance: "ftp: などで始まるアドレスは使用できません。",
    },
    destination_unavailable: {
      kicker: "DESTINATION UNAVAILABLE",
      title: "行き先を見つけられませんでした",
      message: "入力したドメイン名から、利用できる公開IPv4アドレスを確認できませんでした。",
      guidance: "綴りを確認するか、別のWebサイトを選んでください。",
    },
    destination_resolution_timeout: {
      kicker: "DESTINATION TIMEOUT",
      title: "行き先の確認に時間がかかっています",
      message: "制限時間内にWebサイトの場所を確認できませんでした。",
      guidance: "少し待つか、別のWebサイトを選んでください。",
    },
    destination_not_allowed: {
      kicker: "DESTINATION NOT ALLOWED",
      title: "この行き先は観測できません",
      message: "Webサイトが公開されていないネットワークアドレスを返しました。",
      guidance: "安全のため探査を開始していません。別のWebサイトを選んでください。",
    },
    rate_limited: {
      kicker: "PLEASE WAIT",
      title: "少し時間をおいてください",
      message: "同じ接続から、直前に経路観測が行われました。",
      guidance:
        "一分ほど待ってから、もう一度お試しください。進行中の観測はそのまま続いています。",
    },
    queue_full: {
      kicker: "OBSERVATION BUSY",
      title: "鳥たちが順番を待っています",
      message: "現在、多くの経路を同時に観測しています。",
      guidance: "少し待ってから、もう一度お試しください。",
    },
    client_timeout: {
      kicker: "CONNECTION PAUSED",
      title: "結果の受信が止まりました",
      message: "観測結果を待っている間に、スマートフォンとの接続が途切れました。",
      guidance: "通信状態を確認してから、説明画面へ戻ってください。",
    },
    traceroute_failed: {
      kicker: "SYSTEM ERROR",
      title: "観測装置が応答しませんでした",
      message: "経路が見えないのではなく、観測処理そのものが完了しませんでした。",
      guidance: "作品スタッフへお知らせください。通信障害や霧の表現とは異なる状態です。",
    },
  };
  const selected = errors[error.code] || {
    kicker: "CONNECTION ERROR",
    title: "観測を開始できませんでした",
    message: "サーバーとの通信を完了できませんでした。",
    guidance: "通信状態を確認し、少し待ってからもう一度お試しください。",
  };

  errorKicker.textContent = selected.kicker;
  errorTitle.textContent = selected.title;
  errorMessage.textContent = selected.message;
  errorGuidance.textContent = selected.guidance;
  startButton.disabled = false;
  setPanel("error");
}

consentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const website = websiteInput.value.trim();
  if (!website) {
    formMessage.textContent = "鳥の行き先となるWebサイトを入力してください。";
    websiteInput.focus();
    return;
  }
  if (!consentCheckbox.checked) {
    formMessage.textContent = "説明を確認し、同意欄にチェックしてください。";
    consentCheckbox.focus();
    return;
  }

  formMessage.textContent = "";
  startButton.disabled = true;
  setPanel("measuring");
  startElapsedClock();

  try {
    const queued = await requestMeasurement(website);
    storeControllerCredentials(queued.measurementId, queued.controller);
    startControllerSession();
    const record = await waitForMeasurement(queued.measurementId);
    if (record.status === "completed") {
      renderResult(record);
      return;
    }
    const error = new Error(record.failure?.code || "measurement_failed");
    error.code = record.failure?.code || "measurement_failed";
    throw error;
  } catch (error) {
    showError(error);
  }
});

consentCheckbox.addEventListener("change", () => {
  if (consentCheckbox.checked) formMessage.textContent = "";
});

websiteInput.addEventListener("input", () => {
  if (websiteInput.value.trim()) formMessage.textContent = "";
});

function beginControllerPointer(pointerId, clientX, clientY) {
  if (!controllerCanControl) {
    controllerInputStatus.className =
      "controller-input-status is-error";
    controllerInputStatus.textContent =
      "紙飛行機の準備完了を待っています";
    return false;
  }
  controllerPointer = pointerId;
  suppressControllerClickUntil = Date.now() + 450;
  controllerPad.classList.add("is-active");
  controllerInputStatus.className =
    "controller-input-status is-sending";
  controllerInputStatus.textContent = "入力中";
  setControllerFromPointer(clientX, clientY);
  clearInterval(controllerInputTimer);
  controllerInputTimer = setInterval(() => {
    sendControllerInput();
  }, 90);
  return true;
}

if ("PointerEvent" in window) {
  controllerPad.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (
      !beginControllerPointer(
        event.pointerId,
        event.clientX,
        event.clientY,
      )
    ) {
      return;
    }
    try {
      controllerPad.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is supplementary; document-level release still neutralizes.
    }
  });
  controllerPad.addEventListener("pointermove", (event) => {
    if (controllerPointer !== event.pointerId) return;
    event.preventDefault();
    setControllerFromPointer(event.clientX, event.clientY);
  });
  controllerPad.addEventListener("pointerup", (event) => {
    releaseControllerPointer(event.pointerId);
  });
  controllerPad.addEventListener("pointercancel", (event) => {
    releaseControllerPointer(event.pointerId);
  });
}

controllerPad.addEventListener(
  "touchstart",
  (event) => {
    if (controllerPointer !== null) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    event.preventDefault();
    beginControllerPointer(
      `touch-${touch.identifier}`,
      touch.clientX,
      touch.clientY,
    );
  },
  { passive: false },
);
controllerPad.addEventListener(
  "touchmove",
  (event) => {
    const touch = Array.from(event.touches).find(
      (item) => `touch-${item.identifier}` === controllerPointer,
    );
    if (!touch) return;
    event.preventDefault();
    setControllerFromPointer(touch.clientX, touch.clientY);
  },
  { passive: false },
);
controllerPad.addEventListener("touchend", (event) => {
  const touch = Array.from(event.changedTouches).find(
    (item) => `touch-${item.identifier}` === controllerPointer,
  );
  if (touch) releaseControllerPointer(`touch-${touch.identifier}`);
});
controllerPad.addEventListener("touchcancel", (event) => {
  const touch = Array.from(event.changedTouches).find(
    (item) => `touch-${item.identifier}` === controllerPointer,
  );
  if (touch) releaseControllerPointer(`touch-${touch.identifier}`);
});

if (!("PointerEvent" in window)) {
  controllerPad.addEventListener("mousedown", (event) => {
    if (!controllerCanControl || controllerPointer !== null) return;
    event.preventDefault();
    beginControllerPointer("mouse", event.clientX, event.clientY);
  });
  document.addEventListener("mousemove", (event) => {
    if (controllerPointer !== "mouse") return;
    event.preventDefault();
    setControllerFromPointer(event.clientX, event.clientY);
  });
  document.addEventListener("mouseup", () => {
    releaseControllerPointer("mouse");
  });
}
controllerPad.addEventListener("click", (event) => {
  if (
    Date.now() < suppressControllerClickUntil ||
    controllerPointer !== null
  ) {
    return;
  }
  if (!beginControllerPointer("tap", event.clientX, event.clientY)) return;
  window.setTimeout(() => releaseControllerPointer("tap"), 180);
});
window.addEventListener("blur", () => {
  if (controllerPointer !== null) {
    releaseControllerPointer(controllerPointer);
  }
});
window.addEventListener("resize", ensureControllerPadGeometry);
window.addEventListener("orientationchange", ensureControllerPadGeometry);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && controllerPointer !== null) {
    releaseControllerPointer(controllerPointer);
  }
});

routeHighlightButton.addEventListener("click", async () => {
  if (!controllerCredentials || !controllerRouteReady) return;
  routeHighlightButton.disabled = true;
  routeHighlightButton.classList.add("is-active");
  routeHighlightButton.textContent = "経路が光っています";
  try {
    const response = await fetch(
      `/api/controller/sessions/${controllerCredentials.sessionId}/highlight`,
      {
        method: "POST",
        headers: controllerHeaders(),
      },
    );
    await readResponse(response);
  } catch {
    routeHighlightButton.textContent = "少し待ってもう一度";
  }
  window.setTimeout(() => {
    routeHighlightButton.classList.remove("is-active");
    routeHighlightButton.textContent = "自分の経路を光らせる";
    routeHighlightButton.disabled = !controllerRouteReady;
  }, 5_000);
});

returnButton.addEventListener("click", resetExperience);
errorReturnButton.addEventListener("click", resetExperience);

async function restoreControllerSession() {
  let stored;
  try {
    stored = JSON.parse(sessionStorage.getItem(CONTROLLER_STORAGE_KEY));
  } catch {
    stored = null;
  }
  if (!stored?.measurementId || !stored?.sessionId || !stored?.token) return;
  controllerCredentials = stored;
  applyControllerColor();
  startControllerSession();
  setPanel("measuring");
  startElapsedClock();
  try {
    const response = await fetch(
      `/api/measurements/${stored.measurementId}`,
      { cache: "no-store" },
    );
    const record = await readResponse(response);
    const completed =
      record.status === "completed"
        ? record
        : await waitForMeasurement(stored.measurementId);
    if (completed.status === "completed") {
      renderResult(completed);
      return;
    }
  } catch {
    sessionStorage.removeItem(CONTROLLER_STORAGE_KEY);
    controllerCredentials = null;
    setPanel("intro");
  }
}

const UI_PREVIEW_STATES = new Set([
  "measuring",
  "carrying",
  "fog",
  "opening",
  "controllable",
  "reconnecting",
  "ended",
  "about",
]);

function populatePreviewRoute() {
  observedCount.textContent = "3";
  unknownCount.textContent = "2";
  destinationHost.textContent = "example.com";
  routeMap.replaceChildren(
    routeStepNode({
      kind: "observed-node",
      hop: 1,
      nodes: [{ nodeId: "preview-a", treeVisitCount: 1 }],
    }),
    routeStepNode({
      kind: "unknown-segment",
      startHop: 2,
      endHop: 3,
      hopCount: 2,
    }),
    routeStepNode({
      kind: "observed-node",
      hop: 4,
      nodes: [{ nodeId: "preview-b", treeVisitCount: 7 }],
    }),
    routeStepNode({
      kind: "observed-node",
      hop: 5,
      nodes: [{ nodeId: "preview-c", treeVisitCount: 3 }],
    }),
  );
}

function applyUiPreview(state) {
  const previewState = UI_PREVIEW_STATES.has(state) ? state : "measuring";
  uiPreviewState.value = previewState;
  aboutWork.open = previewState === "about";
  controllerPanel.style.setProperty("--participant-color", "#d5a24b");
  controllerPanel.hidden = false;
  populatePreviewRoute();

  if (previewState === "measuring") {
    setPanel("measuring");
    return;
  }
  if (previewState === "about") {
    setPanel("intro");
    aboutWork.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  setPanel("result");
  const statusByPreview = {
    carrying: {
      phase: "carrying",
      controllable: false,
      routeReady: true,
    },
    fog: {
      phase: "carrying",
      controllable: false,
      routeReady: true,
      title: "観測できない区間を通っています",
      description:
        "通信は続いていますが、この区間は見えません。鳥は霧の中を進んでいます。",
    },
    opening: {
      phase: "opening",
      controllable: false,
      routeReady: true,
    },
    controllable: {
      phase: "controllable",
      controllable: true,
      routeReady: true,
    },
    reconnecting: {
      phase: "reconnecting",
      controllable: false,
      routeReady: false,
    },
    ended: {
      phase: "ended",
      controllable: false,
      routeReady: false,
    },
  };
  applyControllerStatus(statusByPreview[previewState]);
}

const requestedPreview = new URLSearchParams(window.location.search).get(
  "ui-preview",
);
if (UI_PREVIEW_STATES.has(requestedPreview)) {
  document.body.classList.add("is-ui-preview");
  uiPreviewToolbar.hidden = false;
  uiPreviewState.addEventListener("change", () => {
    const url = new URL(window.location.href);
    url.searchParams.set("ui-preview", uiPreviewState.value);
    history.replaceState(null, "", url);
    applyUiPreview(uiPreviewState.value);
  });
  applyUiPreview(requestedPreview);
} else {
  restoreControllerSession();
  ensureControllerPadGeometry();
}
