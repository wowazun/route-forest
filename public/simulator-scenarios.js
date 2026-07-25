const SCENARIOS = Object.freeze([
  {
    id: "all-new",
    group: "route",
    label: "全ノード新規",
    description: "初めて見るノードだけで、新しい木が連続して生まれる。",
  },
  {
    id: "all-existing",
    group: "route",
    label: "全ノード既存",
    description: "すでに育った木だけを再訪し、木の記憶を太くする。",
  },
  {
    id: "mixed",
    group: "route",
    label: "新規と既存の混在",
    description: "既存の木をたどりながら、新しい木を途中に加える。",
  },
  {
    id: "unknown-one",
    group: "route",
    label: "未観測 1ホップ",
    description: "木と木の間に、短い霧を一つだけ発生させる。",
  },
  {
    id: "unknown-three",
    group: "route",
    label: "未観測 3ホップ",
    description: "連続した三つの未観測ホップを一つの濃い霧として扱う。",
  },
  {
    id: "unknown-multiple",
    group: "route",
    label: "未観測区間が複数",
    description: "一つの経路に離れた複数の霧区間を発生させる。",
  },
  {
    id: "unknown-tail",
    group: "route",
    label: "最後まで未観測",
    description: "最後に観測できた木から霧へ入り、到達だけを成立させる。",
  },
  {
    id: "very-long",
    group: "route",
    label: "非常に長い経路",
    description: "24ホップ相当の長い経路で演出時間と密度を確認する。",
  },
  {
    id: "short",
    group: "route",
    label: "短い経路",
    description: "二つの木だけを結ぶ最短クラスの演出を確認する。",
  },
  {
    id: "repeated-node",
    group: "route",
    label: "同一ノードの再登場",
    description: "同じ木が一つの経路内へ再登場しても増殖させない。",
  },
  {
    id: "concurrent-users",
    group: "load",
    label: "複数ユーザ同時参加",
    description: "12本の経路を短い間隔で送り、演出待ち行列を作る。",
  },
  {
    id: "many-planes",
    group: "load",
    label: "大量の紙飛行機",
    description: "短い経路を36本完了させ、紙飛行機の情報量を確認する。",
  },
  {
    id: "many-fogs",
    group: "load",
    label: "大量の霧",
    description: "複数経路へ未観測区間を重ね、局所的な霧の密度を上げる。",
  },
  {
    id: "stream-disconnect",
    group: "transport",
    label: "リアルタイム切断",
    description: "経路受信後に接続が切れ、再接続表示へ移る。",
  },
  {
    id: "client-reconnect",
    group: "transport",
    label: "クライアント再接続",
    description: "切断後にスナップショットを受け、経路表示を復元する。",
  },
  {
    id: "server-error",
    group: "transport",
    label: "サーバーエラー",
    description: "観測を追加せず、障害状態を明確に表示する。",
  },
]);

const HOSTNAMES = Object.freeze([
  "wikipedia.org",
  "openstreetmap.org",
  "archive.org",
  "example.com",
]);

function node(hop, nodeIds, reachedTarget = false) {
  const ids = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
  return {
    kind: "observed-node",
    hop,
    nodes: ids.map((nodeId, index) => ({
      nodeId,
      addressFamily: 4,
      reachedTarget: reachedTarget && index === 0,
    })),
    rttsMs: [],
  };
}

function fog(startHop, hopCount) {
  return {
    kind: "unknown-segment",
    startHop,
    endHop: startHop + hopCount - 1,
    hopCount,
  };
}

function observation({
  runId,
  sequence,
  steps,
  startedAt,
  termination = "destination_reached",
}) {
  return {
    schemaVersion: 2,
    measurementId: `sim-${runId}-${sequence}`,
    observedAt: new Date(startedAt + sequence * 1_000).toISOString(),
    destination: {
      hostname: HOSTNAMES[sequence % HOSTNAMES.length],
    },
    addressFamily: 4,
    method: "icmp",
    termination: {
      kind: termination,
      exitCode: termination === "partial_timeout" ? null : 0,
    },
    steps,
  };
}

function routeNodes(prefix, count, startHop = 1) {
  return Array.from({ length: count }, (_, index) =>
    node(startHop + index, `${prefix}-${index + 1}`, index === count - 1),
  );
}

function observationEvent(atMs, route, immediate = false) {
  return Object.freeze({
    atMs,
    type: "observation",
    immediate,
    observation: route,
  });
}

function connectionEvent(atMs, state, label) {
  return Object.freeze({
    atMs,
    type: "connection",
    state,
    label,
  });
}

function routeScenario(id, context) {
  const { runId, startedAt } = context;
  if (id === "all-new") {
    return [
      observationEvent(
        0,
        observation({
          runId,
          sequence: 1,
          startedAt,
          steps: routeNodes(`${runId}-new`, 7),
        }),
      ),
    ];
  }

  if (id === "all-existing") {
    const steps = routeNodes(`${runId}-existing`, 6);
    return [
      observationEvent(
        0,
        observation({ runId, sequence: 1, startedAt, steps }),
        true,
      ),
      observationEvent(
        400,
        observation({ runId, sequence: 2, startedAt, steps }),
      ),
    ];
  }

  if (id === "mixed") {
    const shared = routeNodes(`${runId}-shared`, 3);
    return [
      observationEvent(
        0,
        observation({ runId, sequence: 1, startedAt, steps: shared }),
        true,
      ),
      observationEvent(
        400,
        observation({
          runId,
          sequence: 2,
          startedAt,
          steps: [
            node(1, `${runId}-shared-1`),
            node(2, `${runId}-fresh-1`),
            node(3, `${runId}-shared-2`),
            node(4, `${runId}-fresh-2`, true),
          ],
        }),
      ),
    ];
  }

  if (id === "unknown-one") {
    return [
      observationEvent(
        0,
        observation({
          runId,
          sequence: 1,
          startedAt,
          steps: [
            node(1, `${runId}-a`),
            fog(2, 1),
            node(3, `${runId}-b`, true),
          ],
        }),
      ),
    ];
  }

  if (id === "unknown-three") {
    return [
      observationEvent(
        0,
        observation({
          runId,
          sequence: 1,
          startedAt,
          steps: [
            node(1, `${runId}-a`),
            fog(2, 3),
            node(5, `${runId}-b`, true),
          ],
        }),
      ),
    ];
  }

  if (id === "unknown-multiple") {
    return [
      observationEvent(
        0,
        observation({
          runId,
          sequence: 1,
          startedAt,
          steps: [
            node(1, `${runId}-a`),
            fog(2, 1),
            node(3, `${runId}-b`),
            fog(4, 2),
            node(6, `${runId}-c`),
            fog(7, 1),
            node(8, `${runId}-d`, true),
          ],
        }),
      ),
    ];
  }

  if (id === "unknown-tail") {
    return [
      observationEvent(
        0,
        observation({
          runId,
          sequence: 1,
          startedAt,
          termination: "partial_timeout",
          steps: [
            node(1, `${runId}-a`),
            node(2, `${runId}-b`),
            fog(3, 5),
          ],
        }),
      ),
    ];
  }

  if (id === "very-long") {
    const steps = [];
    let hop = 1;
    while (hop <= 24) {
      if (hop === 6 || hop === 15) {
        steps.push(fog(hop, 2));
        hop += 2;
      } else {
        steps.push(
          node(hop, `${runId}-long-${hop}`, hop === 24),
        );
        hop += 1;
      }
    }
    return [
      observationEvent(
        0,
        observation({ runId, sequence: 1, startedAt, steps }),
      ),
    ];
  }

  if (id === "short") {
    return [
      observationEvent(
        0,
        observation({
          runId,
          sequence: 1,
          startedAt,
          steps: [
            node(1, `${runId}-near`),
            node(2, `${runId}-destination`, true),
          ],
        }),
      ),
    ];
  }

  return [
    observationEvent(
      0,
      observation({
        runId,
        sequence: 1,
        startedAt,
        steps: [
          node(1, `${runId}-loop`),
          node(2, `${runId}-middle-a`),
          node(3, `${runId}-middle-b`),
          node(4, `${runId}-loop`),
          node(5, `${runId}-destination`, true),
        ],
      }),
    ),
  ];
}

function loadScenario(id, context) {
  const { runId, startedAt } = context;
  const count = id === "many-planes" ? 36 : id === "concurrent-users" ? 12 : 8;
  const interval = id === "many-planes" ? 120 : id === "concurrent-users" ? 260 : 210;
  const events = [];

  for (let sequence = 1; sequence <= count; sequence += 1) {
    let steps;
    if (id === "many-fogs") {
      steps = [];
      let hop = 1;
      for (let segment = 0; segment < 6; segment += 1) {
        steps.push(node(hop, `${runId}-fog-tree-${sequence}-${segment}`));
        hop += 1;
        steps.push(fog(hop, 1 + ((sequence + segment) % 3)));
        hop += steps.at(-1).hopCount;
      }
      steps.push(node(hop, `${runId}-fog-end-${sequence}`, true));
    } else {
      steps = routeNodes(`${runId}-${sequence}`, id === "many-planes" ? 2 : 5);
    }
    events.push(
      observationEvent(
        (sequence - 1) * interval,
        observation({ runId, sequence, startedAt, steps }),
      ),
    );
  }
  return events;
}

function transportScenario(id, context) {
  const seedRoute = observation({
    runId: context.runId,
    sequence: 1,
    startedAt: context.startedAt,
    steps: routeNodes(`${context.runId}-transport`, 4),
  });

  if (id === "stream-disconnect") {
    return [
      connectionEvent(0, "live", "LIVE"),
      observationEvent(200, seedRoute),
      connectionEvent(1_800, "disconnected", "再接続しています"),
    ];
  }
  if (id === "client-reconnect") {
    return [
      connectionEvent(0, "disconnected", "接続が切れました"),
      connectionEvent(1_200, "connecting", "再接続しています"),
      connectionEvent(2_400, "live", "LIVE / RESTORED"),
      observationEvent(2_500, seedRoute, true),
    ];
  }
  return [
    connectionEvent(0, "connecting", "受信を待っています"),
    connectionEvent(900, "error", "SYSTEM ERROR"),
  ];
}

export function listSimulationScenarios() {
  return SCENARIOS.map((scenario) => Object.freeze({ ...scenario }));
}

export function createSimulation(
  id,
  {
    runId = `${id}-${Date.now().toString(36)}`,
    startedAt = Date.now(),
  } = {},
) {
  const scenario = SCENARIOS.find((item) => item.id === id);
  if (!scenario) throw new RangeError(`Unknown simulation scenario: ${id}`);

  let events;
  if (scenario.group === "route") events = routeScenario(id, { runId, startedAt });
  else if (scenario.group === "load") {
    events = loadScenario(id, { runId, startedAt });
  } else {
    events = transportScenario(id, { runId, startedAt });
  }

  return Object.freeze({
    schemaVersion: 1,
    simulationId: runId,
    scenario: Object.freeze({ ...scenario }),
    events: Object.freeze(events),
  });
}
