import assert from "node:assert/strict";

const baseUrl = process.env.ROUTE_FOREST_BASE_URL || "http://127.0.0.1:8080";
const publicOrigin =
  process.env.PUBLIC_ORIGIN || "https://route-forest.wowazun.net";
const testParticipant = "8.8.8.8";
const testWebsite = process.env.ROUTE_FOREST_TEST_WEBSITE || "cloudflare.com";
const startedAt = Date.now();

const response = await fetch(`${baseUrl}/api/measurements`, {
  method: "POST",
  headers: {
    "cf-connecting-ip": testParticipant,
    "content-type": "application/json",
    origin: publicOrigin,
  },
  body: JSON.stringify({
    website: testWebsite,
    consentAccepted: true,
    consentVersion: "route-observation-v2",
  }),
});
assert.equal(response.status, 202);
const queued = await response.json();

let record = queued;
while (record.status === "queued" || record.status === "running") {
  if (Date.now() - startedAt > 15_000) {
    throw new Error("Running service check exceeded its deadline");
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
  const statusResponse = await fetch(
    `${baseUrl}/api/measurements/${queued.measurementId}`,
  );
  assert.equal(statusResponse.status, 200);
  record = await statusResponse.json();
}

const serialized = JSON.stringify(record);
assert.equal(serialized.includes(testParticipant), false);

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
