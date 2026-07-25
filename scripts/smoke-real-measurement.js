import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { MeasurementService } from "../src/application/measurement-service.js";
import { NodeAnonymizer } from "../src/domain/anonymizer.js";
import { createHttpServer } from "../src/http/server.js";
import { TracerouteRunner } from "../src/infrastructure/traceroute-runner.js";
import { WebsiteResolver } from "../src/infrastructure/website-resolver.js";

const TEST_ORIGIN = "https://smoke.invalid";
const TEST_PARTICIPANT = "1.1.1.1";
const TEST_WEBSITE = "cloudflare.com";
const tracerouteBinary = process.env.TRACEROUTE_BIN || "traceroute";

const runner = new TracerouteRunner({
  binary: tracerouteBinary,
  maxHops: 24,
  hopWaitSeconds: 0.5,
  timeoutMs: 12_000,
  maxOutputBytes: 131_072,
});
const measurementService = new MeasurementService({
  anonymizer: new NodeAnonymizer(randomBytes(32).toString("hex")),
  resolver: new WebsiteResolver(),
  runner,
  config: {
    concurrency: 1,
    queueCapacity: 2,
    cooldownMs: 60_000,
    recordTtlMs: 60_000,
    consentVersion: "smoke-v1",
    tracerouteMethods: ["icmp", "udp"],
  },
});
const server = createHttpServer({
  measurementService,
  config: { publicOrigin: TEST_ORIGIN },
});

server.listen(0, "127.0.0.1");
await once(server, "listening");
const startedAt = Date.now();

try {
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/measurements`, {
    method: "POST",
    headers: {
      "cf-connecting-ip": TEST_PARTICIPANT,
      "content-type": "application/json",
      origin: TEST_ORIGIN,
    },
    body: JSON.stringify({
      website: TEST_WEBSITE,
      consentAccepted: true,
      consentVersion: "smoke-v1",
    }),
  });
  assert.equal(response.status, 202);
  const queued = await response.json();

  let record = queued;
  while (
    record.status === "queued" ||
    record.status === "running"
  ) {
    if (Date.now() - startedAt > 15_000) {
      throw new Error("Smoke measurement exceeded its deadline");
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    const statusResponse = await fetch(
      `http://127.0.0.1:${port}/api/measurements/${queued.measurementId}`,
    );
    assert.equal(statusResponse.status, 200);
    record = await statusResponse.json();
  }

  const serialized = JSON.stringify(record);
  assert.equal(serialized.includes(TEST_PARTICIPANT), false);

  const steps = record.observation?.steps || [];
  const observedSteps = steps.filter(
    (step) => step.kind === "observed-node",
  ).length;
  const unknownHops = steps
    .filter((step) => step.kind === "unknown-segment")
    .reduce((total, step) => total + step.hopCount, 0);

  process.stdout.write(
    [
      `status=${record.status}`,
      `termination=${record.observation?.termination.kind || record.failure?.code}`,
      `destination=${record.destination?.hostname}`,
      `method=${record.observation?.method || "none"}`,
      `observed_steps=${observedSteps}`,
      `unknown_hops=${unknownHops}`,
      `elapsed_ms=${Date.now() - startedAt}`,
      "raw_target_exposed=false",
    ].join("\n") + "\n",
  );
} finally {
  server.close();
  await once(server, "close");
}
