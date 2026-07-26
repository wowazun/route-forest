import assert from "node:assert/strict";
import test from "node:test";
import { MeasurementService } from "../src/application/measurement-service.js";
import { NodeAnonymizer } from "../src/domain/anonymizer.js";
import { normalizeIpAddress } from "../src/domain/ip-address.js";

const anonymizer = new NodeAnonymizer("measurement-test-secret-at-least-32");

function createService(runner, overrides = {}) {
  const {
    resolver = {
      resolve: async () => normalizeIpAddress("8.8.8.8"),
    },
    ...configOverrides
  } = overrides;
  return new MeasurementService({
    anonymizer,
    resolver,
    runner,
    config: {
      concurrency: 1,
      queueCapacity: 2,
      cooldownMs: 60_000,
      recordTtlMs: 900_000,
      consentVersion: "v1",
      tracerouteMethods: ["icmp", "udp"],
      ...configOverrides,
    },
  });
}

async function eventually(predicate, timeoutMs = 1_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Condition was not met before timeout");
}

test("requires explicit current consent", () => {
  const service = createService({ run: async () => ({}) });
  const clientIp = normalizeIpAddress("8.8.8.8");

  assert.throws(
    () =>
      service.submit({
        clientIp,
        website: "example.com",
        consentAccepted: false,
        consentVersion: "v1",
      }),
    { code: "consent_required" },
  );
  assert.throws(
    () =>
      service.submit({
        clientIp,
        website: "example.com",
        consentAccepted: true,
        consentVersion: "old",
      }),
    { code: "consent_version_mismatch" },
  );
});

test("allows an IPv6 participant to measure an IPv4 website destination", async () => {
  let receivedTarget;
  const service = createService(
    {
      run: async (target) => {
        receivedTarget = target;
        return {
          stdout: "1  1.1.1.1  1.0 ms",
          stderr: "",
          exitCode: 0,
          signal: null,
          timedOut: false,
        };
      },
    },
  );

  const queued = service.submit({
    clientIp: normalizeIpAddress("2606:4700:4700::1111"),
    website: "https://example.com/path",
    consentAccepted: true,
    consentVersion: "v1",
  });
  const completed = await eventually(() => {
    const record = service.get(queued.measurementId);
    return record?.status === "completed" ? record : null;
  });

  assert.deepEqual(receivedTarget, { address: "8.8.8.8", family: 4 });
  assert.equal(completed.destination.hostname, "example.com");
  assert.equal(completed.addressFamily, 4);
});

test("completes a partial route without retaining raw addresses", async () => {
  const runner = {
    run: async () => ({
      stdout: ["1  192.168.1.1  1.0 ms", "2  *", "3  8.8.8.8  3.0 ms"].join(
        "\n",
      ),
      stderr: "traceroute to 8.8.8.8",
      exitCode: 0,
      signal: null,
      timedOut: false,
    }),
  };
  const service = createService(runner);
  const queued = service.submit({
    clientIp: normalizeIpAddress("8.8.8.8"),
    website: "example.com",
    consentAccepted: true,
    consentVersion: "v1",
  });

  const completed = await eventually(() => {
    const record = service.get(queued.measurementId);
    return record?.status === "completed" ? record : null;
  });

  const serialized = JSON.stringify(completed);
  assert.equal(serialized.includes("8.8.8.8"), false);
  assert.equal(serialized.includes("192.168.1.1"), false);
  assert.equal(completed.observation.termination.kind, "destination_reached");
  assert.equal(completed.observation.method, "icmp");
  assert.equal(completed.observation.steps[1].kind, "unknown-segment");
});

test("falls back to UDP when ICMP observes no addresses without merging attempts", async () => {
  const attemptedMethods = [];
  const service = createService({
    run: async (_target, { method }) => {
      attemptedMethods.push(method);
      return {
        stdout:
          method === "icmp"
            ? ["1  *", "2  *"].join("\n")
            : "1  8.8.8.8  2.0 ms",
        stderr: "",
        exitCode: 0,
        signal: null,
        timedOut: false,
      };
    },
  });
  const queued = service.submit({
    clientIp: normalizeIpAddress("1.1.1.1"),
    website: "example.com",
    consentAccepted: true,
    consentVersion: "v1",
  });

  const completed = await eventually(() => {
    const record = service.get(queued.measurementId);
    return record?.status === "completed" ? record : null;
  });

  assert.deepEqual(attemptedMethods, ["icmp", "udp"]);
  assert.equal(completed.observation.method, "udp");
  assert.equal(completed.observation.steps.length, 1);
  assert.equal(completed.observation.steps[0].kind, "observed-node");
});

test("publishes completed observations and replays only anonymized data", async () => {
  const runner = {
    run: async () => ({
      stdout: "1  8.8.8.8  1.0 ms",
      stderr: "",
      exitCode: 0,
      signal: null,
      timedOut: false,
    }),
  };
  const service = createService(runner);
  const received = [];
  const unsubscribe = service.subscribe((event) => received.push(event));

  service.submit({
    clientIp: normalizeIpAddress("8.8.8.8"),
    website: "example.com",
    consentAccepted: true,
    consentVersion: "v1",
  });
  await eventually(() => received.length === 1);
  unsubscribe();

  assert.equal(received[0].type, "route-observed");
  assert.equal(received[0].observation.destination.hostname, "example.com");
  assert.equal(received[0].observation.termination.kind, "destination_reached");
  assert.equal(JSON.stringify(received).includes("8.8.8.8"), false);
  assert.deepEqual(service.getRecentObservations(), received);
});

test("assigns cumulative tree visit counts to anonymous route nodes", async () => {
  const service = createService({
    run: async () => ({
      stdout: "1  8.8.8.8  1.0 ms",
      stderr: "",
      exitCode: 0,
      signal: null,
      timedOut: false,
    }),
  });

  const first = service.submit({
    clientIp: normalizeIpAddress("1.1.1.1"),
    website: "example.com",
    consentAccepted: true,
    consentVersion: "v1",
  });
  const firstCompleted = await eventually(() => {
    const record = service.get(first.measurementId);
    return record?.status === "completed" ? record : null;
  });

  const second = service.submit({
    clientIp: normalizeIpAddress("9.9.9.9"),
    website: "example.com",
    consentAccepted: true,
    consentVersion: "v1",
  });
  const secondCompleted = await eventually(() => {
    const record = service.get(second.measurementId);
    return record?.status === "completed" ? record : null;
  });

  assert.equal(
    firstCompleted.observation.steps[0].nodes[0].treeVisitCount,
    1,
  );
  assert.equal(
    secondCompleted.observation.steps[0].nodes[0].treeVisitCount,
    2,
  );
});

test("classifies worker failures as system failures rather than unknown segments", async () => {
  const service = createService({
    run: async () => {
      const error = new Error("contains a sensitive destination");
      error.code = "spawn_failed";
      throw error;
    },
  });
  const queued = service.submit({
    clientIp: normalizeIpAddress("8.8.4.4"),
    website: "example.com",
    consentAccepted: true,
    consentVersion: "v1",
  });

  const failed = await eventually(() => {
    const record = service.get(queued.measurementId);
    return record?.status === "failed" ? record : null;
  });
  assert.deepEqual(failed.failure, {
    code: "spawn_failed",
    category: "system",
  });
  assert.equal("observation" in failed, true);
  assert.equal(failed.observation, null);
  assert.equal(JSON.stringify(failed).includes("sensitive destination"), false);
});

test("does not run traceroute when DNS resolves to a forbidden destination", async () => {
  let runnerCalled = false;
  const destinationError = Object.assign(
    new Error("The website resolved to a non-public address"),
    { code: "destination_not_allowed" },
  );
  const service = createService(
    {
      run: async () => {
        runnerCalled = true;
      },
    },
    {
      resolver: {
        resolve: async () => {
          throw destinationError;
        },
      },
    },
  );
  const queued = service.submit({
    clientIp: normalizeIpAddress("8.8.8.8"),
    website: "example.com",
    consentAccepted: true,
    consentVersion: "v1",
  });
  const failed = await eventually(() => {
    const record = service.get(queued.measurementId);
    return record?.status === "failed" ? record : null;
  });

  assert.equal(runnerCalled, false);
  assert.deepEqual(failed.failure, {
    code: "destination_not_allowed",
    category: "destination",
  });
});

test("applies a participant cooldown without retaining the participant address", () => {
  const service = createService({
    run: () => new Promise(() => {}),
  });
  const clientIp = normalizeIpAddress("8.8.8.8");
  service.submit({
    clientIp,
    website: "example.com",
    consentAccepted: true,
    consentVersion: "v1",
  });
  assert.throws(
    () =>
      service.submit({
        clientIp,
        website: "example.org",
        consentAccepted: true,
        consentVersion: "v1",
      }),
    { code: "rate_limited" },
  );
});

test("enforces the finite total queue capacity", () => {
  const service = createService(
    {
      run: () => new Promise(() => {}),
    },
    { queueCapacity: 1 },
  );
  service.submit({
    clientIp: normalizeIpAddress("8.8.8.8"),
    website: "example.com",
    consentAccepted: true,
    consentVersion: "v1",
  });
  assert.throws(
    () =>
      service.submit({
        clientIp: normalizeIpAddress("1.1.1.1"),
        website: "example.org",
        consentAccepted: true,
        consentVersion: "v1",
      }),
    { code: "queue_full" },
  );
});

test("resets completed observations, tree growth, and participant cooldowns", async () => {
  const service = createService({
    run: async () => ({
      stdout: "1  8.8.8.8  1.0 ms",
      stderr: "",
      exitCode: 0,
      signal: null,
      timedOut: false,
    }),
  });
  const clientIp = normalizeIpAddress("8.8.8.8");
  const events = [];
  service.subscribe((event) => events.push(event));
  const first = service.submit({
    clientIp,
    website: "example.com",
    consentAccepted: true,
    consentVersion: "v1",
  });
  await eventually(() => service.get(first.measurementId)?.status === "completed");

  const before = service.getResetSummary();
  assert.equal(before.records, 1);
  assert.equal(before.recentObservations, 1);
  assert.equal(before.treeNodes, 1);
  assert.equal(before.participantCooldowns, 1);

  const reset = service.reset();
  assert.equal(reset.before.records, 1);
  assert.equal(service.get(first.measurementId), null);
  assert.deepEqual(service.getRecentObservations(), []);
  assert.deepEqual(service.getResetSummary().statuses, {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
  });
  assert.equal(events.at(-1).type, "exhibition-reset");

  assert.doesNotThrow(() =>
    service.submit({
      clientIp,
      website: "example.com",
      consentAccepted: true,
      consentVersion: "v1",
    }),
  );
});

test("ignores a traceroute result that finishes after an exhibition reset", async () => {
  let finishRun;
  const service = createService({
    run: () =>
      new Promise((resolve) => {
        finishRun = resolve;
      }),
  });
  const events = [];
  service.subscribe((event) => events.push(event));
  const queued = service.submit({
    clientIp: normalizeIpAddress("8.8.4.4"),
    website: "example.com",
    consentAccepted: true,
    consentVersion: "v1",
  });
  await eventually(() => service.get(queued.measurementId)?.status === "running");

  service.reset();
  finishRun({
    stdout: "1  8.8.8.8  1.0 ms",
    stderr: "",
    exitCode: 0,
    signal: null,
    timedOut: false,
  });
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(service.get(queued.measurementId), null);
  assert.deepEqual(service.getRecentObservations(), []);
  assert.equal(
    events.filter((event) => event.type === "route-observed").length,
    0,
  );
  assert.equal(events.at(-1).type, "exhibition-reset");
});
