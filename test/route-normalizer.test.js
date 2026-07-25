import assert from "node:assert/strict";
import test from "node:test";
import { NodeAnonymizer } from "../src/domain/anonymizer.js";
import { normalizeIpAddress } from "../src/domain/ip-address.js";
import {
  normalizeRouteObservation,
  parseTracerouteOutput,
} from "../src/domain/route-normalizer.js";

const anonymizer = new NodeAnonymizer("test-secret-material-that-is-32-bytes");

test("parses observed, unknown, repeated, and multi-response hops", () => {
  const output = [
    "traceroute to 8.8.8.8 (8.8.8.8), 24 hops max, 60 byte packets",
    " 1  192.168.1.1  0.371 ms",
    " 2  *",
    " 3  * * *",
    " 4  1.1.1.1  7.2 ms  8.8.4.4  8.4 ms",
    " 5  8.8.8.8  9.8 ms",
  ].join("\n");

  assert.deepEqual(parseTracerouteOutput(output), [
    {
      hop: 1,
      addresses: [{ address: "192.168.1.1", family: 4 }],
      rttsMs: [0.371],
    },
    { hop: 2, addresses: [], rttsMs: [] },
    { hop: 3, addresses: [], rttsMs: [] },
    {
      hop: 4,
      addresses: [
        { address: "1.1.1.1", family: 4 },
        { address: "8.8.4.4", family: 4 },
      ],
      rttsMs: [7.2, 8.4],
    },
    {
      hop: 5,
      addresses: [{ address: "8.8.8.8", family: 4 }],
      rttsMs: [9.8],
    },
  ]);
});

test("merges consecutive unknown hops and does not expose raw addresses", () => {
  const target = normalizeIpAddress("8.8.8.8");
  const hops = parseTracerouteOutput(
    [
      "1  192.168.1.1  1.0 ms",
      "2  *",
      "3  *",
      "4  1.1.1.1  4.0 ms",
      "5  *",
      "6  *",
    ].join("\n"),
  );

  const observation = normalizeRouteObservation({
    measurementId: "measurement-1",
    observedAt: "2026-07-25T00:00:00.000Z",
    destination: { hostname: "example.com" },
    target,
    method: "udp",
    hops,
    anonymizer,
    termination: { kind: "partial_timeout", exitCode: null },
  });

  assert.deepEqual(
    observation.steps.map((step) => {
      if (step.kind === "unknown-segment") {
        return [step.kind, step.startHop, step.endHop, step.hopCount];
      }
      return [step.kind, step.hop, step.nodes.length];
    }),
    [
      ["observed-node", 1, 1],
      ["unknown-segment", 2, 3, 2],
      ["observed-node", 4, 1],
      ["unknown-segment", 5, 6, 2],
    ],
  );
  assert.equal(JSON.stringify(observation).includes("192.168.1.1"), false);
  assert.equal(JSON.stringify(observation).includes("1.1.1.1"), false);
  assert.equal(JSON.stringify(observation).includes("8.8.8.8"), false);
  assert.equal(observation.destination.hostname, "example.com");
});

test("marks only a directly observed destination as reached", () => {
  const target = normalizeIpAddress("2606:4700:4700::1111");
  const hops = parseTracerouteOutput(
    ["1  2001:4860:4860::8888  2.0 ms", "2  2606:4700:4700::1111  3.0 ms"].join(
      "\n",
    ),
  );
  const observation = normalizeRouteObservation({
    measurementId: "measurement-v6",
    observedAt: "2026-07-25T00:00:00.000Z",
    destination: { hostname: "example.com" },
    target,
    method: "udp",
    hops,
    anonymizer,
    termination: { kind: "destination_reached", exitCode: 0 },
  });

  assert.equal(observation.steps[0].nodes[0].reachedTarget, false);
  assert.equal(observation.steps[1].nodes[0].reachedTarget, true);
});
