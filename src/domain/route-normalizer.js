import { normalizeIpAddress } from "./ip-address.js";

function responseTokens(line) {
  return line
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/^[([]+|[)\],]+$/g, ""))
    .map((token) => token.split("%")[0])
    .filter(Boolean);
}

export function parseTracerouteOutput(stdout) {
  if (typeof stdout !== "string") {
    throw new TypeError("traceroute output must be a string");
  }

  const hops = [];
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^\s*(\d+)\s+(.*)$/.exec(line);
    if (!match) continue;

    const hop = Number.parseInt(match[1], 10);
    const payload = match[2];
    const addresses = [];
    const seen = new Set();

    for (const token of responseTokens(payload)) {
      try {
        const normalized = normalizeIpAddress(token);
        const key = `${normalized.family}:${normalized.address}`;
        if (!seen.has(key)) {
          seen.add(key);
          addresses.push(normalized);
        }
      } catch {
        // Non-address traceroute tokens such as "*", "!H", and RTTs are ignored.
      }
    }

    const rttsMs = [...payload.matchAll(/(\d+(?:\.\d+)?)\s*ms\b/g)].map(
      (item) => Number.parseFloat(item[1]),
    );
    hops.push(Object.freeze({ hop, addresses, rttsMs }));
  }

  return hops;
}

export function normalizeRouteObservation({
  measurementId,
  observedAt,
  destination,
  target,
  method,
  hops,
  anonymizer,
  termination,
}) {
  const steps = [];
  let unknownStart = null;
  let unknownEnd = null;

  const flushUnknown = () => {
    if (unknownStart === null) return;
    steps.push(
      Object.freeze({
        kind: "unknown-segment",
        startHop: unknownStart,
        endHop: unknownEnd,
        hopCount: unknownEnd - unknownStart + 1,
      }),
    );
    unknownStart = null;
    unknownEnd = null;
  };

  for (const entry of [...hops].sort((a, b) => a.hop - b.hop)) {
    if (entry.addresses.length === 0) {
      if (unknownStart === null) unknownStart = entry.hop;
      unknownEnd = entry.hop;
      continue;
    }

    flushUnknown();
    const nodes = entry.addresses.map((address) =>
      Object.freeze({
        nodeId: anonymizer.identify(address),
        addressFamily: address.family,
        reachedTarget:
          address.family === target.family && address.address === target.address,
      }),
    );
    steps.push(
      Object.freeze({
        kind: "observed-node",
        hop: entry.hop,
        nodes,
        rttsMs: Object.freeze([...entry.rttsMs]),
      }),
    );
  }
  flushUnknown();

  return Object.freeze({
    schemaVersion: 2,
    measurementId,
    observedAt,
    destination: Object.freeze({ hostname: destination.hostname }),
    addressFamily: target.family,
    method,
    termination: Object.freeze({ ...termination }),
    steps: Object.freeze(steps),
  });
}
