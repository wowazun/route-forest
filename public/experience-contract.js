const TERMINATION_KINDS = new Set([
  "destination_reached",
  "completed_without_destination",
  "partial_result",
  "partial_timeout",
  "timeout",
]);

export class ExperienceContractError extends Error {
  constructor(message) {
    super(message);
    this.name = "ExperienceContractError";
  }
}

function assertObject(value, label) {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new ExperienceContractError(`${label} must be an object`);
  }
  return value;
}

function assertString(value, label, maximumLength = 256) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumLength
  ) {
    throw new ExperienceContractError(`${label} must be a non-empty string`);
  }
  return value;
}

function assertInteger(value, label, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new ExperienceContractError(`${label} must be an integer`);
  }
  return value;
}

function readNode(value, stepIndex, nodeIndex) {
  const node = assertObject(
    value,
    `steps[${stepIndex}].nodes[${nodeIndex}]`,
  );
  if ("address" in node || "ip" in node) {
    throw new ExperienceContractError(
      `steps[${stepIndex}].nodes[${nodeIndex}] contains a raw address`,
    );
  }
  if (node.addressFamily !== 4 && node.addressFamily !== 6) {
    throw new ExperienceContractError(
      `steps[${stepIndex}].nodes[${nodeIndex}].addressFamily must be 4 or 6`,
    );
  }

  return Object.freeze({
    nodeId: assertString(
      node.nodeId,
      `steps[${stepIndex}].nodes[${nodeIndex}].nodeId`,
      128,
    ),
    addressFamily: node.addressFamily,
    reachedTarget: node.reachedTarget === true,
  });
}

function readObservedNode(step, index) {
  const hop = assertInteger(step.hop, `steps[${index}].hop`, 1);
  if (!Array.isArray(step.nodes) || step.nodes.length === 0) {
    throw new ExperienceContractError(
      `steps[${index}].nodes must contain at least one node`,
    );
  }

  return Object.freeze({
    kind: "observed-node",
    hop,
    nodes: Object.freeze(
      step.nodes.map((node, nodeIndex) => readNode(node, index, nodeIndex)),
    ),
  });
}

function readUnknownSegment(step, index) {
  const startHop = assertInteger(
    step.startHop,
    `steps[${index}].startHop`,
    1,
  );
  const endHop = assertInteger(step.endHop, `steps[${index}].endHop`, startHop);
  const hopCount = assertInteger(step.hopCount, `steps[${index}].hopCount`, 1);
  if (hopCount !== endHop - startHop + 1) {
    throw new ExperienceContractError(
      `steps[${index}] has inconsistent unknown hop bounds`,
    );
  }

  return Object.freeze({
    kind: "unknown-segment",
    startHop,
    endHop,
    hopCount,
  });
}

/**
 * Reads the system-to-director boundary. The returned value contains only
 * anonymous node identifiers and presentation-safe route metadata.
 */
export function readRouteObservation(value) {
  const observation = assertObject(value, "RouteObservation");
  if (observation.schemaVersion !== 2) {
    throw new ExperienceContractError(
      "RouteObservation.schemaVersion must be 2",
    );
  }
  if (observation.addressFamily !== 4 && observation.addressFamily !== 6) {
    throw new ExperienceContractError(
      "RouteObservation.addressFamily must be 4 or 6",
    );
  }
  if (!Array.isArray(observation.steps)) {
    throw new ExperienceContractError(
      "RouteObservation.steps must be an array",
    );
  }

  const observedAt = assertString(
    observation.observedAt,
    "RouteObservation.observedAt",
    64,
  );
  if (!Number.isFinite(Date.parse(observedAt))) {
    throw new ExperienceContractError(
      "RouteObservation.observedAt must be an ISO timestamp",
    );
  }

  const destination = assertObject(
    observation.destination,
    "RouteObservation.destination",
  );
  const termination = assertObject(
    observation.termination,
    "RouteObservation.termination",
  );
  if (!TERMINATION_KINDS.has(termination.kind)) {
    throw new ExperienceContractError(
      "RouteObservation.termination.kind is unsupported",
    );
  }

  const steps = observation.steps.map((stepValue, index) => {
    const step = assertObject(stepValue, `steps[${index}]`);
    if (step.kind === "observed-node") return readObservedNode(step, index);
    if (step.kind === "unknown-segment") return readUnknownSegment(step, index);
    throw new ExperienceContractError(
      `steps[${index}].kind is unsupported`,
    );
  });

  return Object.freeze({
    schemaVersion: 2,
    measurementId: assertString(
      observation.measurementId,
      "RouteObservation.measurementId",
      128,
    ),
    observedAt,
    destination: Object.freeze({
      hostname: assertString(
        destination.hostname,
        "RouteObservation.destination.hostname",
        253,
      ),
    }),
    addressFamily: observation.addressFamily,
    method:
      observation.method === "icmp" || observation.method === "udp"
        ? observation.method
        : "unknown",
    termination: Object.freeze({ kind: termination.kind }),
    steps: Object.freeze(steps),
  });
}

/**
 * Converts a RouteObservation into the director-to-renderer boundary.
 * Rendering code receives an ordered BirdSequence, not traceroute output.
 */
export function createBirdSequence(value) {
  const observation = readRouteObservation(value);
  const waypoints = observation.steps.map((step) => {
    if (step.kind === "unknown-segment") {
      return Object.freeze({
        kind: "fog",
        startHop: step.startHop,
        endHop: step.endHop,
        hopCount: step.hopCount,
      });
    }
    return Object.freeze({
      kind: "tree",
      hop: step.hop,
      nodes: step.nodes,
    });
  });

  return Object.freeze({
    schemaVersion: 1,
    kind: "bird-sequence",
    sequenceId: observation.measurementId,
    occurredAt: observation.observedAt,
    destinationLabel: observation.destination.hostname,
    addressFamily: observation.addressFamily,
    termination: observation.termination.kind,
    waypoints: Object.freeze(waypoints),
  });
}
